import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createMedia,
  deleteMedia,
  getMedia,
  listMedia,
  updateMedia,
} from '@/lib/db/repositories/media';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  kind: 'image' as const,
  assetKey: 'media/u1/abc.png',
  previewKey: 'media/u1/abc.png',
  width: 1080,
  height: 1350,
};

describe('media repository', () => {
  test('createMedia insère une row image', async () => {
    await makeUser('u1', 'a@test.com');
    const m = await createMedia('u1', SAMPLE);
    expect(m.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(m.userId).toBe('u1');
    expect(m.kind).toBe('image');
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1350);
  });

  test('getMedia retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    const found = await getMedia('u1', created.id);
    expect(found?.assetKey).toBe(SAMPLE.assetKey);
  });

  test('listMedia retourne tous les media du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createMedia('u1', SAMPLE);
    await createMedia('u1', { ...SAMPLE, assetKey: 'media/u1/def.png' });
    const rows = await listMedia('u1');
    expect(rows).toHaveLength(2);
  });

  test('updateMedia modifie les champs + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateMedia('u1', created.id, { width: 2160, height: 2700 });
    expect(updated?.width).toBe(2160);
    expect(updated?.height).toBe(2700);
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteMedia supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createMedia('u1', SAMPLE);
    await deleteMedia('u1', created.id);
    expect(await getMedia('u1', created.id)).toBeUndefined();
  });
});
