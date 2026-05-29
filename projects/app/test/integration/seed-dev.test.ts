import { describe, expect, test } from 'vitest';
import { listPosts } from '@/lib/db/repositories/posts';
import { listWritingTemplates } from '@/lib/db/repositories/writing-templates';
import { seedDev } from '@/lib/db/seeds/dev-sample';
import { createTestUser } from './helpers/seed';

describe('seedDev', () => {
  test('peuple template + posts, et reste idempotent', async () => {
    const userId = await createTestUser('seeddev');

    await seedDev(userId);
    const posts1 = await listPosts(userId);
    expect((await listWritingTemplates(userId)).length).toBeGreaterThan(0);
    expect(posts1.length).toBeGreaterThan(0);

    await seedDev(userId); // 2e passe : aucun doublon
    expect((await listPosts(userId)).length).toBe(posts1.length);
    expect((await listWritingTemplates(userId)).length).toBe(1);
  });
});
