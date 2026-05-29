import { describe, expect, it, test } from 'vitest';
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '@/lib/db/repositories/posts';
import {
  createPublication,
  deletePublication,
  getPublication,
  listPublications,
  updatePublication,
} from '@/lib/db/repositories/publications';
import {
  createVoice,
  deleteVoice,
  getVoice,
  listVoices,
  updateVoice,
} from '@/lib/db/repositories/voice';
import {
  createWritingTemplate,
  deleteWritingTemplate,
  getWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import { createTestUser } from './helpers/seed';
import { runTenantIsolationSuite } from './helpers/tenant-isolation-harness';

// Sentinelle générique pour les tables avec CRUD standard.
runTenantIsolationSuite('voice', {
  seed: (uid) => createVoice(uid, { name: 'Sample', content: 'original' }),
  rowId: (r) => r.id,
  reload: (uid, id) => getVoice(uid, id),
  updatePatch: { content: 'hacked' },
  updateAssertions: (row) => {
    expect(row.content).toBe('original');
  },
  get: getVoice,
  list: listVoices,
  update: updateVoice,
  delete: deleteVoice,
});

runTenantIsolationSuite('posts', {
  seed: async (uid) => {
    return createPost(uid, { title: 'T', content: 'draft' });
  },
  rowId: (r) => r.id,
  reload: (uid, id) => getPost(uid, id),
  updatePatch: { content: 'hacked' },
  updateAssertions: (row) => {
    expect(row.content).toBe('draft');
  },
  get: getPost,
  list: listPosts,
  update: updatePost,
  delete: deletePost,
});

runTenantIsolationSuite('publications', {
  seed: async (uid) => {
    const post = await createPost(uid, { title: 'T', content: 'final' });
    return createPublication(uid, {
      postId: post.id,
      contentSnapshot: 'snap',
      platform: 'linkedin',
    });
  },
  rowId: (r) => r.id,
  reload: (uid, id) => getPublication(uid, id),
  updatePatch: { contentSnapshot: 'hacked' },
  updateAssertions: (row) => {
    expect(row.contentSnapshot).toBe('snap');
  },
  get: getPublication,
  list: listPublications,
  update: updatePublication,
  delete: deletePublication,
});

runTenantIsolationSuite('writing_templates', {
  seed: (uid) =>
    createWritingTemplate(uid, {
      name: 'Sample',
      platform: 'linkedin',
      structure: 'X',
      writingRules: null,
    }) as Promise<{ id: string; name: string }>,
  rowId: (r) => r.id,
  reload: (uid, id) => getWritingTemplate(uid, id),
  updatePatch: { name: 'hacked' },
  updateAssertions: (row) => {
    expect(row.name).toBe('Sample');
  },
  get: getWritingTemplate,
  list: listWritingTemplates,
  update: updateWritingTemplate,
  delete: deleteWritingTemplate,
});

describe('posts: isolation par user', () => {
  it('listPosts ne renvoie que les posts du user appelant', async () => {
    const userA = await createTestUser('iso-lp-a');
    const userB = await createTestUser('iso-lp-b');
    await createPost(userA, { title: 'T', content: 'a' });
    await createPost(userB, { title: 'T', content: 'b' });

    expect((await listPosts(userA)).map((p) => p.content)).toEqual(['a']);
    expect((await listPosts(userB)).map((p) => p.content)).toEqual(['b']);
  });
});
