import { describe, expect, test } from 'vitest';
import { listIdeas } from '@/lib/db/repositories/ideas';
import { listPosts } from '@/lib/db/repositories/posts';
import { getSettings } from '@/lib/db/repositories/settings';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { seedDev } from '@/lib/db/seeds/dev-sample';
import { createTestUser } from './helpers/seed';

describe('seedDev', () => {
  test('peuple settings + template + ideas + posts, et reste idempotent', async () => {
    const userId = await createTestUser('seeddev');

    await seedDev(userId);
    const ideas1 = await listIdeas(userId);
    const posts1 = await listPosts(userId);
    expect(await getSettings(userId)).toBeTruthy();
    expect((await listWritingTemplates(userId)).length).toBeGreaterThan(0);
    expect(ideas1.length).toBeGreaterThan(0);
    expect(posts1.length).toBeGreaterThan(0);

    await seedDev(userId); // 2e passe : aucun doublon
    expect((await listIdeas(userId)).length).toBe(ideas1.length);
    expect((await listPosts(userId)).length).toBe(posts1.length);
    expect((await listWritingTemplates(userId)).length).toBe(1);
  });
});
