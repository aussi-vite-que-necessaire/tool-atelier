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

async function createPost(page: Page, title: string): Promise<void> {
  await page.goto('/posts');
  await page.fill('input[placeholder="Titre du post"]', title);
  await page.click('button:has-text("Créer un post")');
  await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('Publication LinkedIn', () => {
  test.describe.configure({ timeout: 180_000 });

  test('publier maintenant puis planifier/annuler', async ({ page }) => {
    await signup(page, `pw-pub-${Date.now()}@test.invalid`);
    await connectLinkedIn(page);

    // 1. Publier maintenant → statut publié + lien LinkedIn.
    await createPost(page, 'Idée publish-now');
    await page.getByRole('button', { name: 'Publier maintenant' }).click();
    await expect(page.getByText(/^Publié/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('link', { name: 'Voir le post sur LinkedIn' })).toBeVisible();
    // One-shot : plus de bouton publier.
    await expect(page.getByRole('button', { name: 'Publier maintenant' })).toHaveCount(0);

    // 2. Planifier un autre post puis annuler.
    await createPost(page, 'Idée schedule');
    await page.fill('input[type="datetime-local"]', '2030-01-01T10:00');
    await page.getByRole('button', { name: 'Planifier' }).click();
    await expect(page.getByText(/Planifié pour le/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole('button', { name: 'Annuler la planification' }).click();
    await expect(page.getByRole('button', { name: 'Publier maintenant' })).toBeVisible({
      timeout: 10_000,
    });
  });
});
