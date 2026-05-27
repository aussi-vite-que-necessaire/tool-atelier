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

test.describe('Édition IA', () => {
  test.describe.configure({ timeout: 120_000 });

  test('éditer une image génère une 2e image', async ({ page }) => {
    await signup(page, `pw-edit-${Date.now()}@test.invalid`);
    await page.goto('/media');

    await page.getByRole('button', { name: '✨ Générer une image' }).click();
    await expect(page.getByRole('heading', { name: 'Générer une image' })).toBeVisible();
    await page.locator('#gc-prompt').fill('un chat');
    await page.getByRole('button', { name: '✨ Générer', exact: true }).click();
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('.grid > div')).toHaveCount(1);

    await page.getByRole('button', { name: 'Éditer (IA)' }).first().click();
    await page.getByPlaceholder(/fond en bleu/i).fill('rends-le bleu');
    await page.getByRole('button', { name: 'Éditer', exact: true }).click();
    await expect(page.getByText('Image éditée')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.grid > div')).toHaveCount(2);
  });
});
