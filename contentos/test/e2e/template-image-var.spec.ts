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

test.describe('Variable image dans template', () => {
  test.describe.configure({ timeout: 180_000 });

  test('template avec var image → attaché à un post', async ({ page }) => {
    await signup(page, `pw-tplimg-${Date.now()}@test.invalid`);

    // 1. générer une image dans la galerie (pour la piocher après)
    await page.goto('/media');
    await page.getByRole('button', { name: '✨ Générer une image' }).click();
    await expect(page.getByRole('heading', { name: 'Générer une image' })).toBeVisible();
    await page.locator('#gc-prompt').fill('un fond abstrait');
    await page.getByRole('button', { name: '✨ Générer', exact: true }).click();
    await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');

    // 2. créer un template avec une var image
    await page.goto('/settings/visual-templates/new');
    await page.getByLabel('Nom').fill('ImgTpl');
    await page.getByLabel('Slug').fill('imgtpl');
    await page.getByLabel('Width (px)').fill('600');
    await page.getByLabel('Height (px)').fill('400');
    await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
    await page.getByLabel('Name').first().fill('photo');
    await page.getByLabel('Label').first().fill('Photo');
    // basculer le type en image
    await page.getByLabel('Type').first().click();
    await page.getByRole('option', { name: 'Image' }).click();
    // Le code est dans un accordéon replié par défaut.
    await page.getByText('Code (HTML / CSS)').click();
    await page.getByLabel('HTML (Handlebars)').fill('<img src="{{photo}}" width="600">');
    await page.getByLabel('CSS').fill('img { display:block }');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('ImgTpl').first()).toBeVisible();

    // 3. créer un post + attacher le visuel via ce template
    await page.goto('/posts');
    await page.fill('input[placeholder="Titre du post"]', 'Post tpl image');
    await page.click('button:has-text("Créer un post")');
    await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
      timeout: 10_000,
    });

    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Choisir ImgTpl' }).click();
    // choisir l'image de la galerie pour la var photo (1re vignette du form)
    await page.locator('button:has(img)').first().click();
    await page.getByRole('button', { name: /Valider et attacher/ }).click();
    await page.waitForTimeout(2_000);
    await page.reload();
    await expect(page.locator('img[alt="Visuel du post"]')).toBeVisible({ timeout: 15_000 });
  });
});
