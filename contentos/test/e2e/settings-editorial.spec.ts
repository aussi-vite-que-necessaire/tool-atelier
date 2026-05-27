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
  // Better-Auth a un rate limit par IP. En suite E2E on enchaîne plusieurs
  // signups : si on tape le mur, on attend la fenêtre et on retape.
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

test.describe('Settings editorial', () => {
  // Les retries anti-rate-limit peuvent ajouter ~30s par test
  test.describe.configure({ timeout: 120_000 });

  test('voice edit flow : voir seed, éditer, save, reload, persiste', async ({ page }) => {
    await signup(page, `pw-voice-${Date.now()}@test.invalid`);

    await page.goto('/settings/voice');
    await expect(page.getByRole('heading', { name: 'Voix éditoriales' })).toBeVisible();
    await expect(page.getByText('Voix principale')).toBeVisible();

    await page.click('text=Voix principale');
    await expect(page).toHaveURL(/\/settings\/voice\/[^/]+$/);
    await expect(page.getByRole('heading', { name: 'Éditer la voix' })).toBeVisible();

    // Le seed v1 contient "Identité immuable"
    const textarea = page.locator('textarea[name="content"]');
    await expect(textarea).toHaveValue(/Identité immuable/);

    await textarea.fill('Voix de test E2E');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Voix mise à jour')).toBeVisible({ timeout: 5_000 });

    await page.reload();
    await expect(page.locator('textarea[name="content"]')).toHaveValue('Voix de test E2E');
  });

  test('voice create flow : créer une nouvelle voix, vue en liste', async ({ page }) => {
    await signup(page, `pw-voice-new-${Date.now()}@test.invalid`);

    await page.goto('/settings/voice/new');
    await expect(page.getByRole('heading', { name: 'Nouvelle voix' })).toBeVisible();

    await page.fill('input[name="name"]', 'Voix secondaire');
    await page.fill('textarea[name="content"]', 'ton plus posé');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/settings\/voice$/);
    await expect(page.getByText('Voix secondaire')).toBeVisible();
    // Le seed par défaut reste aussi
    await expect(page.getByText('Voix principale')).toBeVisible();
  });

  test('writing_templates edit flow : voir seed, éditer name, sauver, vu en liste', async ({
    page,
  }) => {
    await signup(page, `pw-wt-edit-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates');
    await expect(page.getByText('Post LinkedIn standard')).toBeVisible();

    await page.click('text=Post LinkedIn standard');
    await expect(page).toHaveURL(/\/settings\/writing-templates\/[^/]+$/);
    await expect(page.getByText('Éditer le template')).toBeVisible();

    await page.fill('input[name="name"]', 'LinkedIn renommé');
    await page.click('button[type="submit"]');
    await expect(page.getByText('Template mis à jour')).toBeVisible({ timeout: 5_000 });

    await page.goto('/settings/writing-templates');
    await expect(page.getByText('LinkedIn renommé')).toBeVisible();
  });

  test('writing_templates create flow : créer un nouveau template, vu en liste', async ({
    page,
  }) => {
    await signup(page, `pw-wt-new-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates/new');
    await expect(page.getByText("Nouveau template d'écriture")).toBeVisible();

    await page.fill('input[name="name"]', 'Carrousel');
    await page.fill('textarea[name="structure"]', 'HOOK / SLIDES / CTA');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/settings\/writing-templates$/);
    await expect(page.getByRole('link', { name: /^Carrousel\b/ })).toBeVisible();
    // Le seed par défaut reste aussi
    await expect(page.getByText('Post LinkedIn standard')).toBeVisible();
  });

  test('writing_templates delete flow : supprimer le seed via dialog', async ({ page }) => {
    await signup(page, `pw-wt-del-${Date.now()}@test.invalid`);

    await page.goto('/settings/writing-templates');
    await page.click('text=Post LinkedIn standard');
    await expect(page.getByText('Éditer le template')).toBeVisible();

    await page.click('text=Supprimer ce template');
    // Le dialog natif ouvert, cliquer sur le bouton "Supprimer" final
    const dialog = page.locator('dialog');
    await expect(dialog).toBeVisible();
    await dialog.locator('button[type="submit"]').click();

    await expect(page).toHaveURL(/\/settings\/writing-templates$/);
    await expect(page.getByText('Aucun template pour le moment')).toBeVisible();
  });

  test('visual_styles create flow : liste vide, créer un style', async ({ page }) => {
    await signup(page, `pw-vs-${Date.now()}@test.invalid`);

    await page.goto('/settings/visual-styles');
    await expect(page.getByText('Aucun style pour le moment')).toBeVisible();

    await page.click('text=+ Nouveau');
    await page.fill('input[name="name"]', 'Cinematic');
    await page.fill('textarea[name="prompt"]', 'rendu cinéma diffus');
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL(/\/settings\/visual-styles$/);
    await expect(page.getByText('Cinematic')).toBeVisible();
  });
});
