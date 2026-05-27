import { PDFDocument } from 'pdf-lib';
import { describe, expect, test } from 'vitest';
import { uploadCarouselPdfCore } from '@/lib/carousel/upload-pdf-core';
import { getCarouselSlides } from '@/lib/db/repositories/carousels';
import { getMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createTestUser } from './helpers/seed';

async function makePdf(pages = 2): Promise<File> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([1080, 1350]);
  const bytes = await doc.save();
  return new File([Buffer.from(bytes)], 'deck.pdf', { type: 'application/pdf' });
}

describe('uploadCarouselPdfCore', () => {
  test('crée un média carrousel sans slides et l’attache au post', async () => {
    const userId = await createTestUser('pdf-ok');
    const post = await createPost(userId, { title: 'T', content: 'c' });

    const r = await uploadCarouselPdfCore(userId, await makePdf(3), { postId: post.id });
    expect(r.status).toBe('success');
    if (r.status !== 'success') return;

    const media = await getMedia(userId, r.mediaId);
    expect(media?.kind).toBe('carousel');
    // assetKey = URL publique engine (memory:// en stub, pas de suffixe .pdf)
    expect(media?.assetKey).toBeDefined();
    expect(await getCarouselSlides(r.mediaId)).toHaveLength(0);

    const reloaded = await getPost(userId, post.id);
    expect(reloaded?.mediaId).toBe(r.mediaId);
  });

  test('refuse un fichier non-PDF', async () => {
    const userId = await createTestUser('pdf-bad');
    const notPdf = new File([Buffer.from('hello')], 'x.pdf', { type: 'application/pdf' });
    const r = await uploadCarouselPdfCore(userId, notPdf);
    expect(r.status).toBe('error');
  });

  test('refuse un mauvais type MIME', async () => {
    const userId = await createTestUser('pdf-mime');
    const img = new File([Buffer.from('whatever')], 'x.png', { type: 'image/png' });
    const r = await uploadCarouselPdfCore(userId, img);
    expect(r.status).toBe('error');
  });
});
