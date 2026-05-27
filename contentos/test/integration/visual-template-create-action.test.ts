import { describe, expect, test } from 'vitest';
import { createVisualTemplateCore } from '@/app/(settings)/settings/visual-templates/new/actions-core';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';
import { createTestUser } from './helpers/seed';

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  label: 'Card',
  slug: 'card',
  platform: 'linkedin',
  width: '800',
  height: '600',
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { color: red; }',
  variablesSchema: JSON.stringify([{ name: 'title', label: 'T', type: 'string', max: 50 }]),
  sampleVars: JSON.stringify({ title: 'Hello' }),
};

describe('createVisualTemplateCore', () => {
  test('crée un template valide', async () => {
    const userId = await createTestUser('cvt-ok');
    const r = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r.status).toBe('success');
    expect(await listVisualTemplates(userId)).toHaveLength(1);
  });

  test('rejette slug invalide', async () => {
    const userId = await createTestUser('cvt-slug');
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, slug: 'Bad Slug!' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.slug).toBeDefined();
  });

  test('rejette JSON variablesSchema invalide', async () => {
    const userId = await createTestUser('cvt-vsj');
    const r = await createVisualTemplateCore(
      userId,
      makeForm({ ...VALID, variablesSchema: 'not json' }),
    );
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.variablesSchema).toBe('JSON invalide.');
  });

  test('rejette sampleVars qui ne respecte pas le schéma', async () => {
    const userId = await createTestUser('cvt-sv');
    const r = await createVisualTemplateCore(
      userId,
      makeForm({
        ...VALID,
        sampleVars: JSON.stringify({ title: 'x'.repeat(100) }),
      }),
    );
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.sampleVars).toBeDefined();
  });

  test('rejette CSS qui contient <', async () => {
    const userId = await createTestUser('cvt-css');
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, css: 'a < b' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.css).toBeDefined();
  });

  test('rejette dimensions hors borne', async () => {
    const userId = await createTestUser('cvt-dim');
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, width: '0' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.width).toBeDefined();
  });

  test('rejette slug dupliqué pour le même user', async () => {
    const userId = await createTestUser('cvt-dup');
    const r1 = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r1.status).toBe('success');
    const r2 = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r2.status).toBe('error');
    if (r2.status !== 'error') throw new Error();
    expect(r2.message).toBe('duplicate-slug');
  });
});
