import { describe, expect, test } from 'vitest';
import { createPost } from '@/lib/db/repositories/posts';
import { ideaImpl } from '@/lib/mcp/tools/ideas';
import { postImpl } from '@/lib/mcp/tools/posts';
import { createTestUser } from './helpers/seed';

describe('mcp tools — idées', () => {
  test('create puis list', async () => {
    const userId = await createTestUser('mcpidea');
    const created = await ideaImpl.create(userId, { idea: 'Sujet A', brief: 'brief' });
    expect(created.idea).toBe('Sujet A');
    const list = await ideaImpl.list(userId);
    expect(list.map((i) => i.id)).toContain(created.id);
  });
});

describe('mcp tools — posts', () => {
  test('edit + set_post_status', async () => {
    const userId = await createTestUser('mcppost');
    const post = await createPost(userId, { title: 'T', content: 'avant' });
    const edited = await postImpl.edit(userId, { id: post.id, content: 'après' });
    expect(edited?.content).toBe('après');
    const validated = await postImpl.setStatus(userId, { id: post.id, status: 'validated' });
    expect(validated?.status).toBe('validated');
  });

  test('create_post : crée un post draft autonome', async () => {
    const userId = await createTestUser('mcpcreatepost');
    const created = await postImpl.create(userId, {
      title: 'Mon titre',
      content: "texte rédigé par l'agent",
    });
    expect(created.title).toBe('Mon titre');
    expect(created.content).toBe("texte rédigé par l'agent");
    expect(created.status).toBe('draft');

    const fetched = await postImpl.get(userId, { id: created.id });
    expect(fetched?.id).toBe(created.id);
  });

  test('create_post : status est propagé', async () => {
    const userId = await createTestUser('mcpcreatepost2');
    const created = await postImpl.create(userId, {
      title: 'T',
      content: 'c',
      status: 'validated',
    });
    expect(created.status).toBe('validated');
  });
});
