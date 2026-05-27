import { expect, type Locator, type Page, test } from '@playwright/test';

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
  // Better-Auth rate-limit anti-bruteforce : on retente quelques fois.
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

/**
 * Le titre de l'idée est dans un <input value="..."> au sein de l'article : son
 * texte n'est pas indexable via `article:has-text(...)`. On filtre l'article par
 * la présence d'un input avec la value attendue (le titre de l'idée).
 */
function cardByTitle(page: Page, title: string): Locator {
  return page.locator('article').filter({ has: page.locator(`input[value="${title}"]`) });
}

test.describe('/ideas', () => {
  // Anti rate-limit budget pour les retries signup
  test.describe.configure({ timeout: 120_000 });

  test('crée une idée sans brief', async ({ page }) => {
    await signup(page, `pw-ideas-empty-${Date.now()}@test.invalid`);
    await page.goto('/ideas');

    await page.fill('input[name="idea"]', 'Test idée pipeline');
    await page.click('button:has-text("Ajouter")');

    await expect(cardByTitle(page, 'Test idée pipeline')).toBeVisible();
  });

  test('crée une idée avec brief', async ({ page }) => {
    await signup(page, `pw-ideas-gen-${Date.now()}@test.invalid`);
    await page.goto('/ideas');

    await page.fill('input[name="idea"]', 'Idée pour créer');
    await page.fill('textarea[name="brief"]', 'Brief détaillé');
    await page.click('button:has-text("Ajouter")');

    await expect(cardByTitle(page, 'Idée pour créer')).toBeVisible();
  });

  test('édite titre/brief sur un card existant, blur sauvegarde', async ({ page }) => {
    await signup(page, `pw-ideas-edit-${Date.now()}@test.invalid`);
    await page.goto('/ideas');

    await page.fill('input[name="idea"]', 'Avant édition');
    await page.click('button:has-text("Ajouter")');

    const card = cardByTitle(page, 'Avant édition');
    await expect(card).toBeVisible();

    // Le titre est un <input value="..."> dont la value change quand on fill().
    // Le selector `input[value="..."]` se re-résout après le fill et ne matche
    // plus : on attrape l'input avant et on déclenche le blur via Tab.
    const titleInput = page.locator('input[value="Avant édition"]');
    await expect(titleInput).toBeVisible();
    await titleInput.fill('Après édition');
    await page.keyboard.press('Tab');
    await page.waitForTimeout(500);

    await page.reload();
    await expect(cardByTitle(page, 'Après édition')).toBeVisible();
  });

  test('supprime une idée via le dialog', async ({ page }) => {
    await signup(page, `pw-ideas-del-${Date.now()}@test.invalid`);
    await page.goto('/ideas');

    await page.fill('input[name="idea"]', 'À supprimer');
    await page.click('button:has-text("Ajouter")');

    const card = cardByTitle(page, 'À supprimer');
    await expect(card).toBeVisible();

    await card.locator('button[aria-label*="Supprimer"]').click();
    // Le bouton du dialog n'a pas d'aria-label, le trigger oui : on filtre.
    await page.click('button:has-text("Supprimer"):not([aria-label])');

    await expect(page.locator('text=Idée supprimée')).toBeVisible();
    await expect(cardByTitle(page, 'À supprimer')).toHaveCount(0);
  });
});
