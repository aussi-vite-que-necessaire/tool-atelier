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

test.describe('Connexion LinkedIn', () => {
  test.describe.configure({ timeout: 120_000 });

  test('connecter (stub) puis déconnecter', async ({ page }) => {
    await signup(page, `pw-li-${Date.now()}@test.invalid`);
    await page.goto('/settings/connections');
    await expect(page.getByRole('heading', { name: 'Connexions' })).toBeVisible();
    await expect(page.getByText('Non connecté')).toBeVisible();

    await page.getByRole('link', { name: 'Connecter LinkedIn' }).click();
    await expect(page).toHaveURL(/\/settings\/connections/);
    await expect(page.getByText(/Compte LinkedIn \(stub\)/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/expire dans \d+ jour/)).toBeVisible();

    await page.getByRole('button', { name: 'Déconnecter', exact: true }).click();
    await expect(page.getByText('Non connecté')).toBeVisible({ timeout: 10_000 });
  });
});
