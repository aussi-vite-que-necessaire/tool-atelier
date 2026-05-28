import { describe, expect, it } from 'vitest';
import { createIdeaCore, deleteIdeaCore, updateIdeaCore } from '@/app/(app)/ideas/actions-core';
import { createIdea, getIdea, listIdeas } from '@/lib/db/repositories/ideas';
import { createTestUser } from './helpers/seed';

describe('createIdeaCore', () => {
  it('crée une idée avec titre seul', async () => {
    const userId = await createTestUser('ic-title');
    const fd = new FormData();
    fd.set('idea', 'Mon idée');
    const r = await createIdeaCore(userId, fd);
    expect(r.status).toBe('success');
    const list = await listIdeas(userId);
    expect(list).toHaveLength(1);
    expect(list[0]?.brief).toBeNull();
  });

  it('crée une idée avec titre et brief', async () => {
    const userId = await createTestUser('ic-brief');
    const fd = new FormData();
    fd.set('idea', 'Titre');
    fd.set('brief', 'Brief détaillé');
    await createIdeaCore(userId, fd);
    const list = await listIdeas(userId);
    expect(list[0]?.brief).toBe('Brief détaillé');
  });

  it('refuse un titre vide', async () => {
    const userId = await createTestUser('ic-empty');
    const fd = new FormData();
    fd.set('idea', '   ');
    const r = await createIdeaCore(userId, fd);
    expect(r.status).toBe('error');
  });
});

describe('updateIdeaCore', () => {
  it('update partiel titre seul', async () => {
    const userId = await createTestUser('iu-title');
    const idea = await createIdea(userId, { idea: 'A', brief: 'B' });
    const r = await updateIdeaCore(userId, { id: idea.id, idea: 'A bis' });
    expect(r.status).toBe('success');
    const reread = await getIdea(userId, idea.id);
    expect(reread?.idea).toBe('A bis');
    expect(reread?.brief).toBe('B');
  });

  it('update brief à null si chaîne vide', async () => {
    const userId = await createTestUser('iu-null');
    const idea = await createIdea(userId, { idea: 'A', brief: 'B' });
    await updateIdeaCore(userId, { id: idea.id, brief: '' });
    const reread = await getIdea(userId, idea.id);
    expect(reread?.brief).toBeNull();
  });

  it("refuse update sur idea inexistante ou d'un autre user", async () => {
    const userA = await createTestUser('iu-cross-a');
    const userB = await createTestUser('iu-cross-b');
    const ideaA = await createIdea(userA, { idea: 'A' });
    const r = await updateIdeaCore(userB, { id: ideaA.id, idea: 'B' });
    expect(r.status).toBe('error');
  });
});

describe('deleteIdeaCore', () => {
  it('supprime', async () => {
    const userId = await createTestUser('id-del');
    const idea = await createIdea(userId, { idea: 'X' });
    await deleteIdeaCore(userId, idea.id);
    expect(await getIdea(userId, idea.id)).toBeUndefined();
  });
});
