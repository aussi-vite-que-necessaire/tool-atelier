import { expect, type Page, test } from '@playwright/test';
import { PDFDocument } from 'pdf-lib';

async function makePdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.addPage([1080, 1350]);
  doc.addPage([1080, 1350]);
  return Buffer.from(await doc.save());
}

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

async function connectLinkedIn(page: Page): Promise<void> {
  await page.goto('/settings/connections');
  await page.getByRole('link', { name: 'Connecter LinkedIn' }).click();
  await expect(page.getByText(/Compte LinkedIn \(stub\)/)).toBeVisible({ timeout: 10_000 });
}

// L'upload direct retourne width=null via le stub fs, ce qui casse la
// détection de ratio du carousel (NaN < 0.02 = false → images désactivées).
// On utilise la génération IA stub à la place : width=1, height=1 garanti.
async function generateGalleryImage(page: Page, prompt: string): Promise<void> {
  await page.goto('/media');
  await page.getByRole('button', { name: '✨ Générer une image' }).click();
  await expect(page.getByRole('heading', { name: 'Générer une image' })).toBeVisible();
  await page.locator('#gc-prompt').fill(prompt);
  await page.getByRole('button', { name: '✨ Générer', exact: true }).click();
  await expect(page.locator('img').first()).toBeVisible({ timeout: 30_000 });
  await page.keyboard.press('Escape');
}

async function createPost(page: Page, title: string): Promise<void> {
  await page.goto('/posts');
  await page.fill('input[placeholder="Titre du post"]', title);
  await page.click('button:has-text("Créer un post")');
  await expect(page.getByRole('heading', { name: 'Publication LinkedIn' })).toBeVisible({
    timeout: 10_000,
  });
}

test.describe('Carrousel + vidéo', () => {
  test.describe.configure({ timeout: 240_000 });

  test('carrousel (2 images) publié, puis vidéo publiée', async ({ page }) => {
    await signup(page, `pw-cv-${Date.now()}@test.invalid`);
    await connectLinkedIn(page);
    await generateGalleryImage(page, 'image a');
    await generateGalleryImage(page, 'image b');

    // --- Carrousel ---
    await createPost(page, 'Idée carrousel');
    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Carrousel', exact: true }).click();
    const slideButtons = page.locator('.grid.grid-cols-3 > button');
    await expect(slideButtons.first()).toBeVisible({ timeout: 10_000 });
    await slideButtons.nth(0).click();
    await slideButtons.nth(1).click();
    await page.getByRole('button', { name: /Créer le carrousel \(2\)/ }).click();
    await expect(page.getByText('1 / 2')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Publier maintenant' }).click();
    await expect(page.getByText(/^Publié/)).toBeVisible({ timeout: 30_000 });

    // --- Vidéo ---
    await createPost(page, 'Idée vidéo');
    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Vidéo', exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'clip.mp4',
      mimeType: 'video/mp4',
      buffer: Buffer.from('fakemp4data'),
    });
    await expect(page.locator('video')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Publier maintenant' }).click();
    await expect(page.getByText(/^Publié/)).toBeVisible({ timeout: 30_000 });
  });

  test('carrousel via upload PDF', async ({ page }) => {
    await signup(page, `pw-cvpdf-${Date.now()}@test.invalid`);
    await createPost(page, 'Idée PDF');

    await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
    await page.getByRole('button', { name: 'Carrousel', exact: true }).click();
    await page.getByRole('button', { name: 'Upload PDF', exact: true }).click();

    await page.locator('input[type="file"]').setInputFiles({
      name: 'deck.pdf',
      mimeType: 'application/pdf',
      buffer: await makePdfBuffer(),
    });

    await expect(page.getByText('Carrousel PDF ajouté')).toBeVisible({ timeout: 15_000 });
    await page.reload();
    await expect(page.getByText('PDF carrousel')).toBeVisible({ timeout: 10_000 });
  });
});
