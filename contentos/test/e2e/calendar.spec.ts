import { expect, type Page, test } from '@playwright/test';

async function fetchMagicLink(page: Page, email: string): Promise<string> {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Magic link not found');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Magic link email never arrived');
}

async function signup(page: Page, email: string): Promise<void> {
  await page.request.delete('/api/__test__/emails');
  const maxAttempts = 8;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await page.goto('/signin');
    await page.fill('input[type="email"]', email);
    await page.click('button[type="submit"]');
    const verifyReached = await page
      .waitForURL(/\/verify/, { timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
    if (verifyReached) break;
    const rateLimited = await page
      .getByText(/Too many requests/i)
      .isVisible()
      .catch(() => false);
    if (!rateLimited) throw new Error('Signup form did not navigate to /verify');
    if (attempt === maxAttempts - 1) throw new Error('Rate-limited beyond retry budget');
    await new Promise((r) => setTimeout(r, 11_000));
  }
  const magicUrl = await fetchMagicLink(page, email);
  await page.goto(magicUrl);
  await expect(page).toHaveURL('/');
}

async function connectLinkedIn(page: Page): Promise<void> {
  await page.goto('/settings/connections');
  await page.getByRole('link', { name: 'Connecter LinkedIn' }).click();
  await expect(page.getByText(/Compte LinkedIn \(stub\)/)).toBeVisible({ timeout: 10_000 });
}

async function createPost(page: Page, title: string): Promise<string> {
  await page.goto('/posts');
  await page.fill('input[placeholder="Titre du post"]', title);
  await page.click('button:has-text("Créer un post")');
  await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
    timeout: 10_000,
  });
  const url = new URL(page.url());
  return url.pathname.split('/').pop()!;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

test.describe('Calendrier', () => {
  test.describe.configure({ timeout: 180_000 });

  test('planifier un post puis le prévisualiser en modale LinkedIn', async ({ page }) => {
    await signup(page, `pw-cal-${Date.now()}@test.invalid`);
    await connectLinkedIn(page);
    const postId = await createPost(page, 'Idée calendrier');

    // Contenu long (multi-lignes) pour déclencher le « voir plus ».
    const longContent = Array.from({ length: 12 }, (_, i) => `Ligne ${i + 1} du post de test`).join(
      '\n',
    );
    const textarea = page.locator('textarea.font-mono');
    await textarea.fill(longContent);
    await textarea.blur();

    // Planifie le 15 du mois prochain à 10:00 (mi-journée → robuste aux fuseaux).
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + 1, 15, 10, 0);
    const local = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-15T10:00`;
    const monthParam = `${target.getFullYear()}-${pad(target.getMonth() + 1)}`;

    await page.fill('input[type="datetime-local"]', local);
    await page.getByRole('button', { name: 'Planifier' }).click();
    await expect(page.getByText(/Planifié pour le/)).toBeVisible({ timeout: 10_000 });

    // Le calendrier affiche une vignette liant vers la modale d'aperçu.
    await page.goto(`/calendar?month=${monthParam}`);
    const chip = page.locator(`a[href="/calendar/preview/${postId}"]`);
    await expect(chip.first()).toBeVisible({ timeout: 10_000 });
    await chip.first().click();

    // La modale s'ouvre (URL interceptée) et montre le skin LinkedIn.
    await expect(page).toHaveURL(new RegExp(`/calendar/preview/${postId}`));
    await expect(page.getByText('Ligne 1 du post de test')).toBeVisible({ timeout: 10_000 });

    // « voir plus » déplie le texte.
    const seeMore = page.getByRole('button', { name: /voir plus/ });
    await expect(seeMore).toBeVisible();
    await seeMore.click();
    await expect(page.getByText('Ligne 12 du post de test')).toBeVisible();

    // Bouton Modifier → page d'édition du post.
    await page.getByRole('link', { name: 'Modifier' }).click();
    await expect(page).toHaveURL(new RegExp(`/posts/${postId}`));
  });
});
