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

test.describe('Galerie média', () => {
  test.describe.configure({ timeout: 120_000 });

  test('générer une image via IA (stub) puis la supprimer', async ({ page }) => {
    await signup(page, `pw-media-${Date.now()}@test.invalid`);
    await page.goto('/media');
    await expect(page.getByRole('heading', { name: 'Galerie' })).toBeVisible();
    await expect(page.getByText('Aucune image. Ajoute-en une.')).toBeVisible();

    await page.getByRole('button', { name: '✨ Générer une image' }).click();
    await expect(page.getByRole('heading', { name: 'Générer une image' })).toBeVisible();
    await page.locator('#gc-prompt').fill('un robot minimaliste');
    await page.getByRole('button', { name: '✨ Générer', exact: true }).click();

    // l'image générée apparaît dans l'historique de session et charge réellement
    const img = page.locator('img').first();
    await expect(img).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(async () => img.evaluate((el: HTMLImageElement) => el.naturalWidth), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // fermer le composeur → la galerie (rafraîchie) montre l'image
    await page.keyboard.press('Escape');
    await expect(page.locator('.grid img').first()).toBeVisible({ timeout: 10_000 });

    await page.getByRole('button', { name: 'Supprimer' }).first().click();
    await page.getByRole('button', { name: /^Supprimer$/ }).click();
    await expect(page.getByText('Aucune image. Ajoute-en une.')).toBeVisible();
  });

  test('upload une image > 1 Mo (au-delà du body limit Server Action par défaut)', async ({
    page,
  }) => {
    await signup(page, `pw-upload-${Date.now()}@test.invalid`);
    await page.goto('/media');
    await expect(page.getByRole('heading', { name: 'Galerie' })).toBeVisible();

    // PNG 1×1 valide (image-size lit l'IHDR en tête) + padding pour dépasser
    // 1 Mo. Sans la config serverActions.bodySizeLimit, l'upload échouerait
    // avec "Body exceeded 1 MB limit".
    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const big = Buffer.concat([png1x1, Buffer.alloc(1_500_000)]);

    // Le bouton « ↑ Importer » déclenche un input file caché : setInputFiles
    // suffit à lancer l'upload (l'onChange fire directement).
    await page.locator('input[type="file"]').setInputFiles({
      name: 'big.png',
      mimeType: 'image/png',
      buffer: big,
    });
    await expect(page.getByText('Image importée')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.grid img').first()).toBeVisible({ timeout: 10_000 });
  });
});
