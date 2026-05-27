import { expect, type Page, test } from '@playwright/test';

const TEST_EMAIL = `playwright-${Date.now()}@test.invalid`;

async function fetchOtp(page: Page, email: string): Promise<string> {
  // Poll l'inbox in-memory jusqu'à trouver le code à 6 chiffres dans l'email.
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const res = await page.request.get(`/api/__test__/emails?to=${encodeURIComponent(email)}`);
    const { emails } = await res.json();
    if (emails.length > 0) {
      const html = emails[0].html as string;
      const match = html.match(/(\d{6})/);
      if (!match) throw new Error('OTP code not found in email html');
      return match[1]!;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('OTP email never arrived');
}

test.describe('Auth flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/__test__/emails');
  });

  test('signin → code OTP → dashboard → logout', async ({ page }) => {
    // 1. La racine redirige vers /signin
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);

    // 2. Saisir l'email et demander le code
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.click('button[type="submit"]');

    // 3. L'étape code apparaît
    await expect(page.locator('#code')).toBeVisible();

    // 4. Récupérer le code depuis l'inbox de test et le saisir
    const otp = await fetchOtp(page, TEST_EMAIL);
    await page.fill('#code', otp);
    await page.click('button[type="submit"]');

    // 5. Arrive sur le dashboard
    await expect(page).toHaveURL('/');
    await expect(page.getByText(/Bonjour/)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL).first()).toBeVisible();

    // 6. Logout
    await page.click('button:has-text("Se déconnecter")');
    await expect(page).toHaveURL(/\/signin$/);

    // 7. Accès à / sans session → redirect
    await page.goto('/');
    await expect(page).toHaveURL(/\/signin$/);
  });
});
