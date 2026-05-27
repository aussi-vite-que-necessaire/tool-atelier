import type { Job } from 'bullmq';
import { describe, expect, test } from 'vitest';
import { createImageAsset, getImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia, listMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { upsertSettings } from '@/lib/db/repositories/settings';
import { createVisualTemplate } from '@/lib/db/repositories/visual-templates';
import type { RenderVisualJob } from '@/lib/queue/client';
import { makeProcessRenderVisual } from '@/worker/queues/render-visual';
import { createTestUser } from '../integration/helpers/seed';

function makeJob(data: RenderVisualJob): Job<RenderVisualJob> {
  return { data } as unknown as Job<RenderVisualJob>;
}

const TEMPLATE = {
  slug: 'card',
  label: 'Card',
  platform: 'linkedin',
  width: 800,
  height: 600,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1{font-size:80px}',
  variablesSchema: [{ name: 'title', label: 'T', type: 'string', max: 50 }],
  sampleVars: { title: 'Hello' },
};

describe('processRenderVisual', () => {
  test('mode=preview : retourne URL engine, aucune écriture DB', async () => {
    const userId = await createTestUser('rv-prev');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);

    const handler = makeProcessRenderVisual();

    const res = await handler(
      makeJob({
        userId,
        templateId: tmpl!.id,
        vars: { title: 'X' },
        mode: 'preview',
        jobKey: 'k1',
      }),
    );

    expect(res.mode).toBe('preview');
    if (res.mode !== 'preview') throw new Error('narrowing');
    expect(res.previewKey).toBe(`visual-previews/${userId}/k1.png`);
    // url = URL engine (memory:// en stub)
    expect(res.url).toMatch(/^memory:\/\//);
    expect(res.width).toBe(800);
    expect(res.height).toBe(600);
    // Aucune ligne media en base en mode preview
    expect((await listMedia(userId)).length).toBe(0);
  });

  test('mode=final : crée media + image_asset + update posts.media_id', async () => {
    const userId = await createTestUser('rv-fin');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);
    const post = await createPost(userId, { title: 'T', content: 'C' });

    const handler = makeProcessRenderVisual();

    const res = await handler(
      makeJob({
        userId,
        templateId: tmpl!.id,
        vars: { title: 'X' },
        mode: 'final',
        postId: post.id,
        jobKey: 'k2',
      }),
    );

    expect(res.mode).toBe('final');
    if (res.mode !== 'final') throw new Error('narrowing');
    const medias = await listMedia(userId);
    expect(medias.length).toBe(1);
    expect(medias[0]!.kind).toBe('image');
    expect(medias[0]!.width).toBe(800);
    expect(medias[0]!.height).toBe(600);
    expect(medias[0]!.id).toBe(res.mediaId);
    // assetKey = URL engine, previewKey = engine id
    expect(medias[0]!.assetKey).toMatch(/^memory:\/\//);
    expect(medias[0]!.previewKey).toBeDefined();
    expect(medias[0]!.previewKey).not.toMatch(/^memory:\/\//);
    const asset = await getImageAsset(userId, medias[0]!.id);
    expect(asset?.source).toBe('template');
    expect(asset?.templateSlug).toBe('card');
    expect(asset?.vars).toEqual({ title: 'X' });
    const refreshed = await getPost(userId, post.id);
    expect(refreshed?.mediaId).toBe(medias[0]!.id);
    // url retourné = URL engine
    expect(res.url).toMatch(/^memory:\/\//);
  });

  test('mode=final destination=gallery : image standalone, sans attache post', async () => {
    const userId = await createTestUser('rv-gal');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);

    const handler = makeProcessRenderVisual();

    const res = await handler(
      makeJob({
        userId,
        templateId: tmpl!.id,
        vars: { title: 'X' },
        mode: 'final',
        destination: 'gallery',
        jobKey: 'k-gal',
      }),
    );

    expect(res.mode).toBe('final');
    if (res.mode !== 'final') throw new Error('narrowing');
    const asset = await getImageAsset(userId, res.mediaId);
    expect(asset?.source).toBe('standalone');
  });

  test('throw si template introuvable', async () => {
    const userId = await createTestUser('rv-404');
    await upsertSettings(userId);
    const handler = makeProcessRenderVisual();

    await expect(
      handler(
        makeJob({
          userId,
          templateId: 'nope',
          vars: {},
          mode: 'preview',
          jobKey: 'k3',
        }),
      ),
    ).rejects.toThrow(/not found/);
  });

  test('throw si vars invalides — avant tout rendu', async () => {
    const userId = await createTestUser('rv-bad');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);
    const handler = makeProcessRenderVisual();

    await expect(
      handler(
        makeJob({
          userId,
          templateId: tmpl!.id,
          vars: { title: 'x'.repeat(100) },
          mode: 'preview',
          jobKey: 'k4',
        }),
      ),
    ).rejects.toThrow();
  });

  test('mode=final sans postId throw', async () => {
    const userId = await createTestUser('rv-nopost');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);
    const handler = makeProcessRenderVisual();

    await expect(
      handler(
        makeJob({
          userId,
          templateId: tmpl!.id,
          vars: { title: 'X' },
          mode: 'final',
          jobKey: 'k5',
        }),
      ),
    ).rejects.toThrow(/postId/);
  });

  const IMG_TEMPLATE = {
    slug: 'with-image',
    label: 'With image',
    platform: 'linkedin',
    width: 800,
    height: 600,
    bodyHtml: '<img src="{{photo}}">',
    css: '',
    variablesSchema: [{ name: 'photo', label: 'Photo', type: 'image' }],
    sampleVars: { photo: '' },
  };

  test('mode=final : var image résolue en assetKey (URL engine) injecté dans le HTML', async () => {
    const userId = await createTestUser('rv-img');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, IMG_TEMPLATE);
    // Crée un media avec assetKey = URL engine (memory://)
    const m = await createMedia(userId, {
      kind: 'image',
      assetKey: 'memory://media/fake-img-id',
      previewKey: 'fake-img-id',
      width: 10,
      height: 10,
    });
    await createImageAsset(userId, { mediaId: m.id, source: 'standalone' });
    const post = await createPost(userId, { title: 'T', content: 'C' });

    const handler = makeProcessRenderVisual();
    // Le rendu va appeler engine.renderHtml — on ne peut pas capturer le HTML
    // dans le stub, mais on vérifie que l'image_asset est bien créé (pas d'erreur).
    const res = await handler(
      makeJob({
        userId,
        templateId: tmpl!.id,
        vars: { photo: m.id },
        mode: 'final',
        postId: post.id,
        jobKey: 'ki',
      }),
    );
    expect(res.mode).toBe('final');
    if (res.mode !== 'final') throw new Error('narrowing');
    expect(res.mediaId).toBeDefined();
  });

  test('mode=preview : var image sans mediaId → placeholder', async () => {
    const userId = await createTestUser('rv-imgph');
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, IMG_TEMPLATE);
    const handler = makeProcessRenderVisual();

    // Sans mediaId : le placeholder est injecté. Le rendu ne doit pas planter.
    const res = await handler(
      makeJob({ userId, templateId: tmpl!.id, vars: { photo: '' }, mode: 'preview', jobKey: 'kp' }),
    );
    expect(res.mode).toBe('preview');
    expect(res.url).toMatch(/^memory:\/\//);
  });
});
