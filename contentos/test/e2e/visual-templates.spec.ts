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

test.describe('Visual templates back-office', () => {
  test.describe.configure({ timeout: 120_000 });

  test('créer un template puis le prévisualiser puis le supprimer', async ({ page }) => {
    await signup(page, `pw-vt-${Date.now()}@test.invalid`);

    await page.goto('/settings/visual-templates');
    await expect(page.getByRole('heading', { name: 'Templates visuels' })).toBeVisible();
    await expect(page.getByText('Aucun template pour le moment.')).toBeVisible();

    await page.goto('/settings/visual-templates/new');
    await page.getByLabel('Nom').fill('Simple E2E');
    await page.getByLabel('Slug').fill('simple-e2e');
    await page.getByLabel('Width (px)').fill('600');
    await page.getByLabel('Height (px)').fill('400');

    await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
    await page.getByLabel('Name').first().fill('title');
    await page.getByLabel('Label').first().fill('Titre');
    await page.getByLabel('Max').first().fill('50');

    // La variable "title" apparaît dans le formulaire Sample vars.
    await page.locator('#sv-title').fill('Hello');

    // Le code est dans un accordéon replié par défaut.
    await page.getByText('Code (HTML / CSS)').click();
    await page.getByLabel('HTML (Handlebars)').fill('<h1>{{title}}</h1>');
    await page.getByLabel('CSS').fill('h1 { font-size: 80px; }');

    await page.getByRole('button', { name: 'Créer' }).click();

    await expect(page).toHaveURL('/settings/visual-templates');
    await expect(page.getByText('Simple E2E')).toBeVisible();

    // La grille affiche une iframe d'aperçu pour le template créé.
    await expect(page.locator('iframe[title="Simple E2E"]')).toBeVisible({ timeout: 15_000 });

    await page.getByText('Simple E2E').click();
    await expect(page.getByRole('heading', { name: 'Simple E2E' })).toBeVisible();

    // Aperçu live HTML (iframe dans le formulaire, sans génération d'image).
    await expect(page.locator('iframe[title="Aperçu du template"]')).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole('button', { name: /Prévisualiser/ }).click();
    // L'aperçu PNG s'ouvre dans une modale.
    await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press('Escape');
    await expect(page.locator('img[alt="Preview"]')).toBeHidden();

    await page.getByRole('button', { name: /Supprimer ce template/ }).click();
    await page.getByRole('button', { name: /^Supprimer$/ }).click();
    await expect(page).toHaveURL('/settings/visual-templates');
    await expect(page.getByText('Aucun template pour le moment.')).toBeVisible();
  });
});
