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

test.describe('Post image (upload/IA/galerie)', () => {
  test.describe.configure({ timeout: 180_000 });

  test("générer une image IA et l'attacher au post", async ({ page }) => {
    await signup(page, `pw-postimg-${Date.now()}@test.invalid`);

    // créer un post
    await page.goto('/posts');
    await page.fill('input[placeholder="Titre du post"]', 'Post image');
    await page.click('button:has-text("Créer un post")');
    await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/posts\/.+/);

    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Générer IA' }).click();
    await page.locator('#gc-prompt').fill('un robot');
    await page.getByRole('button', { name: '✨ Générer', exact: true }).click();
    // l'essai apparaît dans l'historique avec un bouton « Attacher au post »
    await page.getByRole('button', { name: 'Attacher au post' }).click();
    await expect(page.getByText('Visuel attaché')).toBeVisible({ timeout: 30_000 });

    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(page.locator('img[alt="Visuel du post"]')).toBeVisible({ timeout: 15_000 });
  });
});
