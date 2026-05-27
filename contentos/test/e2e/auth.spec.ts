import { expect, type Page, test } from '@playwright/test';

const TEST_EMAIL = `playwright-${Date.now()}@test.invalid`;

async function fetchMagicLink(page: Page, email: string): Promise<string> {
  // Poll l'endpoint __test__/emails jusqu'à obtenir un email pour cette adresse
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/href="([^"]+)"/);
      if (!match) throw new Error('Magic link not found in email html');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('Magic link email never arrived');
}

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    // Cleanup l'inbox in-memory entre tests
    await page.request.delete('/api/__test__/emails');
  });

  test('signup → magic link → dashboard → logout', async ({ page }) => {
    // 1. La racine redirige vers /signin
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);

    // 2. Remplir email et submit
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/verify/);

    // 3. Récupérer le magic link via l'endpoint test
    const magicUrl = await fetchMagicLink(page, TEST_EMAIL);

    // 4. Visiter le magic link → arrive sur le dashboard
    await page.goto(magicUrl);
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Bonjour/)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL).first()).toBeVisible();

    // 5. Logout
    await page.click('button:has-text("Se déconnecter")');
    await expect(page).toHaveURL(/\/signin$/);

    // 6. Tenter d'accéder à / sans session → redirect
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
  });
});
