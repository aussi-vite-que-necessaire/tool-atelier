import { describe, expect, test } from 'vitest';
import { createCarouselCore } from '@/lib/carousel/carousel-core';
import { getCarouselSlides } from '@/lib/db/repositories/carousels';
import { createMedia, getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { getMediaEngine } from '@/lib/media-engine';
import { createTestUser } from './helpers/seed';

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

async function makeImage(userId: string, width: number, height: number) {
  // Upload via engine → obtenir URL publique comme assetKey
  const obj = await getMediaEngine().upload({ bytes: PNG, contentType: 'image/png' });
  const m = await createMedia(userId, {
    kind: 'image',
    assetKey: obj.url,
    previewKey: obj.id,
    width,
    height,
  });
  return m.assetKey;
}

describe('createCarouselCore', () => {
  test('2 images même format → carrousel créé + attaché au post', async () => {
    const userId = await createTestUser('carousel');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const k1 = await makeImage(userId, 1080, 1350);
    const k2 = await makeImage(userId, 1080, 1350);

    const r = await createCarouselCore(userId, { postId: post.id, slideKeys: [k1, k2] });
    expect(r.status).toBe('success');
    if (r.status !== 'success') return;

    const m = await getMedia(userId, r.mediaId);
    expect(m?.kind).toBe('carousel');
    // assetKey du carrousel = URL engine (memory://)
    expect(m?.assetKey).toMatch(/^memory:\/\//);
    const slides = await getCarouselSlides(r.mediaId);
    expect(slides.map((s) => s.slideKey)).toEqual([k1, k2]);
    expect((await getPost(userId, post.id))?.mediaId).toBe(r.mediaId);
  });

  test('même proportion mais pixels différents (1024² + 1080²) → OK', async () => {
    const userId = await createTestUser('carousel-ratio');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const k1 = await makeImage(userId, 1024, 1024);
    const k2 = await makeImage(userId, 1080, 1080);
    const r = await createCarouselCore(userId, { postId: post.id, slideKeys: [k1, k2] });
    expect(r.status).toBe('success');
  });

  test('proportions différentes (4:5 vs 1:1) → erreur', async () => {
    const userId = await createTestUser('carousel-bad');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const k1 = await makeImage(userId, 1080, 1350);
    const k2 = await makeImage(userId, 1080, 1080);
    const r = await createCarouselCore(userId, { postId: post.id, slideKeys: [k1, k2] });
    expect(r.status).toBe('error');
  });

  test('< 2 slides → erreur', async () => {
    const userId = await createTestUser('carousel-one');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const k1 = await makeImage(userId, 1080, 1350);
    const r = await createCarouselCore(userId, { postId: post.id, slideKeys: [k1] });
    expect(r.status).toBe('error');
  });
});
