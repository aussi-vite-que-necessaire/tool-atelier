import { describe, expect, test } from 'vitest';
import {
  deleteVisualTemplateCore,
  updateVisualTemplateCore,
} from '@/app/(settings)/settings/visual-templates/[id]/actions-core';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { createVisualTemplate, getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { createTestUser } from './helpers/seed';

const TEMPLATE = {
  slug: 'card',
  label: 'Card',
  platform: 'linkedin',
  width: 800,
  height: 600,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1{color:red}',
  variablesSchema: [{ name: 'title', label: 'T', type: 'string', max: 50 }],
  sampleVars: { title: 'Hello' },
};

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const FORM = {
  label: 'Updated',
  slug: 'card',
  platform: 'linkedin',
  width: '900',
  height: '700',
  bodyHtml: '<h2>{{title}}</h2>',
  css: 'h2{color:blue}',
  variablesSchema: JSON.stringify(TEMPLATE.variablesSchema),
  sampleVars: JSON.stringify(TEMPLATE.sampleVars),
};

describe('updateVisualTemplateCore', () => {
  test('met à jour les champs', async () => {
    const userId = await createTestUser('uvt-ok');
    const t = await createVisualTemplate(userId, TEMPLATE);
    const r = await updateVisualTemplateCore(userId, t!.id, makeForm(FORM));
    expect(r.status).toBe('success');
    const refreshed = await getVisualTemplate(userId, t!.id);
    expect(refreshed?.label).toBe('Updated');
    expect(refreshed?.width).toBe(900);
  });

  test("renvoie not-found si l'id appartient à un autre user", async () => {
    const a = await createTestUser('uvt-a');
    const b = await createTestUser('uvt-b');
    const t = await createVisualTemplate(a, TEMPLATE);
    const r = await updateVisualTemplateCore(b, t!.id, makeForm(FORM));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.message).toBe('not-found');
  });
});

describe('deleteVisualTemplateCore', () => {
  test('supprime quand pas de références', async () => {
    const userId = await createTestUser('dvt-ok');
    const t = await createVisualTemplate(userId, TEMPLATE);
    const r = await deleteVisualTemplateCore(userId, t!.id);
    expect(r.status).toBe('success');
    expect(await getVisualTemplate(userId, t!.id)).toBeUndefined();
  });

  test('refuse si image_assets référence le slug', async () => {
    const userId = await createTestUser('dvt-ref');
    const t = await createVisualTemplate(userId, TEMPLATE);
    const m = await createMedia(userId, {
      kind: 'image',
      assetKey: 'k',
      previewKey: 'k',
      width: 1,
      height: 1,
    });
    await createImageAsset(userId, {
      mediaId: m.id,
      source: 'template',
      templateSlug: t!.slug,
    });
    const r = await deleteVisualTemplateCore(userId, t!.id);
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.message).toMatch(/référencent/);
    expect(await getVisualTemplate(userId, t!.id)).toBeDefined();
  });
});
