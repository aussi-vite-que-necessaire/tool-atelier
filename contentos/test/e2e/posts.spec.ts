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

test.describe('/posts/[id]', () => {
  test.describe.configure({ timeout: 120_000 });

  test('crée un post, ouvre le détail, édite, valide, supprime', async ({ page }) => {
    await signup(page, `pw-posts-${Date.now()}@test.invalid`);

    // 1. Créer un post via le formulaire de /posts.
    await page.goto('/posts');
    await page.fill('input[placeholder="Titre du post"]', 'Mon premier post');
    await page.click('button:has-text("Créer un post")');

    // 2. La création navigue vers l'éditeur.
    await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
      timeout: 10_000,
    });

    // 3. Page détail : titre éditable = titre saisi, badge draft, bouton "Ajouter
    // un visuel" (Spec 5 a remplacé la pastille "Pas de visuel" par ce CTA).
    await expect(page.locator('input[value="Mon premier post"]')).toBeVisible();
    await expect(page.locator('text=draft').first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Ajouter un visuel/ })).toBeVisible();

    // 4. Éditer le contenu via blur-to-save (Tab pour fiabiliser le blur).
    const textarea = page.locator('textarea').first();
    await textarea.fill('Nouveau contenu modifié');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);
    await page.reload();
    await expect(page.locator('textarea').first()).toHaveValue('Nouveau contenu modifié');

    // 5. Validation.
    await page.click('button:has-text("Valider")');
    await expect(page.locator('text=Post validé')).toBeVisible();
    await expect(page.locator('text=validated').first()).toBeVisible();
    await expect(page.locator('button:has-text("Remettre en draft")')).toBeVisible();

    // 6. Suppression : ouvrir dialog puis confirmer.
    await page.locator('button[aria-label*="Supprimer le post"]').click();
    await page.click('button:has-text("Supprimer"):not([aria-label])');

    await expect(page).toHaveURL('/posts');
    await expect(page.locator('text=Post supprimé')).toBeVisible();
  });
});
