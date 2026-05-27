import { describe, expect, test } from 'vitest';
import {
  createVisualTemplate,
  deleteVisualTemplate,
  getVisualTemplate,
  getVisualTemplateBySlug,
  listVisualTemplates,
  updateVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { createTestUser } from './helpers/seed';

const SAMPLE = {
  slug: 'test-card',
  label: 'Test card',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { font-size: 80px; }',
  variablesSchema: [{ name: 'title', label: 'Titre', type: 'string', max: 50 }],
  sampleVars: { title: 'Hello' },
};

describe('visual_templates repository', () => {
  test('createVisualTemplate insère et renvoie la row', async () => {
    const userId = await createTestUser('vt-create');
    const row = await createVisualTemplate(userId, SAMPLE);
    expect(row?.slug).toBe('test-card');
    expect(row?.userId).toBe(userId);
    expect(row?.width).toBe(1080);
  });

  test('createVisualTemplate renvoie undefined sur conflit (user, slug)', async () => {
    const userId = await createTestUser('vt-dup');
    await createVisualTemplate(userId, SAMPLE);
    const second = await createVisualTemplate(userId, SAMPLE);
    expect(second).toBeUndefined();
  });

  test('listVisualTemplates scope par userId', async () => {
    const a = await createTestUser('vt-list-a');
    const b = await createTestUser('vt-list-b');
    await createVisualTemplate(a, SAMPLE);
    expect(await listVisualTemplates(a)).toHaveLength(1);
    expect(await listVisualTemplates(b)).toHaveLength(0);
  });

  test('getVisualTemplate enforce tenant isolation', async () => {
    const a = await createTestUser('vt-get-a');
    const b = await createTestUser('vt-get-b');
    const created = await createVisualTemplate(a, SAMPLE);
    expect(await getVisualTemplate(a, created!.id)).toBeDefined();
    expect(await getVisualTemplate(b, created!.id)).toBeUndefined();
  });

  test('getVisualTemplateBySlug renvoie la bonne row', async () => {
    const userId = await createTestUser('vt-slug');
    await createVisualTemplate(userId, SAMPLE);
    const row = await getVisualTemplateBySlug(userId, 'test-card');
    expect(row?.label).toBe('Test card');
  });

  test('updateVisualTemplate patche uniquement le bon user', async () => {
    const a = await createTestUser('vt-upd-a');
    const b = await createTestUser('vt-upd-b');
    const t = await createVisualTemplate(a, SAMPLE);
    expect(await updateVisualTemplate(b, t!.id, { label: 'Hijack' })).toBeUndefined();
    const refreshed = await getVisualTemplate(a, t!.id);
    expect(refreshed?.label).toBe('Test card');
  });

  test('updateVisualTemplate met à jour updatedAt', async () => {
    const userId = await createTestUser('vt-updat');
    const t = await createVisualTemplate(userId, SAMPLE);
    const before = t!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateVisualTemplate(userId, t!.id, { label: 'Renommé' });
    expect(updated?.label).toBe('Renommé');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteVisualTemplate est scopé', async () => {
    const a = await createTestUser('vt-del-a');
    const b = await createTestUser('vt-del-b');
    const t = await createVisualTemplate(a, SAMPLE);
    await deleteVisualTemplate(b, t!.id);
    expect(await getVisualTemplate(a, t!.id)).toBeDefined();
    await deleteVisualTemplate(a, t!.id);
    expect(await getVisualTemplate(a, t!.id)).toBeUndefined();
  });
});
