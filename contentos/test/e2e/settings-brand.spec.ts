import { expect, type Page, test } from '@playwright/test';

const TEST_EMAIL = `playwright-brand-${Date.now()}@test.invalid`;

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

// Signup robuste : Better-Auth rate-limit par IP, et la suite enchaîne
// plusieurs signups. Si on tape le mur, on attend la fenêtre et on retape.
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

test.describe('Settings Brand', () => {
  // Retries anti-rate-limit peuvent ajouter du temps
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await page.request.delete('/api/__test__/emails');
  });

  test('signup → /settings/brand → remplit form → submit → recharge → valeurs persistées', async ({
    page,
  }) => {
    // 1. Signup
    await signup(page, TEST_EMAIL);

    // 2. Aller sur /settings/brand
    await page.goto('/settings/brand');
    await expect(page.getByText('Identité de marque')).toBeVisible();

    // 3. Vérifier que la sidebar montre Brand actif
    await expect(page.getByRole('link', { name: 'Brand', exact: true })).toBeVisible();
    await expect(page.getByText('Voix')).toBeVisible();

    // 4. Remplir le form
    await page.fill('input[name="brand_name"]', 'AcmeCorp');
    await page.fill('textarea[name="brand_signature"]', 'AcmeCorp — Signature');

    // 5. Submit (le bouton du form identité — la page porte aussi un form logo)
    await page.getByRole('button', { name: 'Enregistrer' }).click();

    // 6. Attendre le toast de succès
    await expect(page.getByText('Identité de marque mise à jour')).toBeVisible({
      timeout: 5_000,
    });

    // 7. Recharger la page
    await page.reload();

    // 8. Vérifier que les valeurs persistent
    await expect(page.locator('input[name="brand_name"]')).toHaveValue('AcmeCorp');
    await expect(page.locator('textarea[name="brand_signature"]')).toHaveValue(
      'AcmeCorp — Signature',
    );
  });

  test('/settings redirige vers /settings/brand', async ({ page }) => {
    const email = `playwright-redirect-${Date.now()}@test.invalid`;

    // Signup complet pour ce test
    await signup(page, email);

    // Tester le redirect
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings\/brand$/);
  });
});
