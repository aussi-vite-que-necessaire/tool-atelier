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

test.describe('Post media picker', () => {
  test.describe.configure({ timeout: 180_000 });

  test('attacher un visuel depuis un template au post puis le détacher', async ({ page }) => {
    await signup(page, `pw-pv-${Date.now()}@test.invalid`);

    // 1. Créer un template visuel
    await page.goto('/settings/visual-templates/new');
    await page.getByLabel('Nom').fill('PostT');
    await page.getByLabel('Slug').fill('postt');
    await page.getByLabel('Width (px)').fill('600');
    await page.getByLabel('Height (px)').fill('400');
    // Le code est dans un accordéon replié par défaut.
    await page.getByText('Code (HTML / CSS)').click();
    await page.getByLabel('HTML (Handlebars)').fill('<h1>{{title}}</h1>');
    await page.getByLabel('CSS').fill('h1 { font-size: 80px; }');
    await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
    await page.getByLabel('Name').first().fill('title');
    await page.getByLabel('Label').first().fill('Titre');
    await page.getByLabel('Max').first().fill('50');
    // La variable "title" apparaît dans le formulaire Sample vars.
    await page.locator('#sv-title').fill('Hello');
    await page.getByRole('button', { name: 'Créer' }).click();
    await expect(page.getByText('PostT').first()).toBeVisible();

    // 2. Créer un post
    await page.goto('/posts');
    await page.fill('input[placeholder="Titre du post"]', 'Post pour E2E');
    await page.click('button:has-text("Créer un post")');
    await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page).toHaveURL(/\/posts\/.+/);

    // 3. Ajouter un visuel depuis le template (modale ouverte sur Image › Templates)
    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Choisir PostT' }).click();
    // L'aperçu est live : l'iframe de prévisualisation apparaît sans bouton.
    await expect(page.locator('iframe[title="Aperçu du template"]')).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole('button', { name: /Valider et attacher/ }).click();
    // Attendre que le bouton se transforme en "Attache…" puis revienne (= job done).
    // router.refresh() est invoqué dans le hook → on reload manuellement pour
    // garantir la fraîcheur du Server Component qui injecte mediaInfo.
    await page.waitForTimeout(4_000);
    await page.reload();
    const visual = page.locator('img[alt="Visuel du post"]');
    await expect(visual).toBeVisible({ timeout: 15_000 });
    // Vérifie que l'image charge réellement (naturalWidth > 0), pas juste que
    // la balise est dans le DOM. Marche que le storage soit R2 (URL signée
    // distante) ou Filesystem (route /api/storage locale).
    await expect
      .poll(async () => visual.evaluate((img: HTMLImageElement) => img.naturalWidth), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    // 4. Détacher
    await page.getByRole('button', { name: /Détacher/ }).click();
    await expect(page.getByRole('button', { name: /Ajouter un visuel/ })).toBeVisible();
  });
});
