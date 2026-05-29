import { describe, expect, it } from 'vitest';
import { resolveMediaRef } from '@/lib/media-link/resolve';

describe('resolveMediaRef', () => {
  it('résout par URL directe (agnostique)', async () => {
    const r = await resolveMediaRef({ mediaUrl: 'https://x/a.pdf' }, async () => null);
    expect(r).toEqual({
      media_id: null,
      media_url: 'https://x/a.pdf',
      media_kind: 'pdf',
      media_width: null,
      media_height: null,
    });
  });
  it('résout par media_id via getMedia', async () => {
    const r = await resolveMediaRef({ mediaId: 'm1' }, async () => ({
      id: 'm1',
      url: 'https://x/i.png',
      kind: 'image',
      width: 1200,
      height: 627,
      prompt: null,
      tags: [],
      created_at: 0,
    }));
    expect(r).toEqual({
      media_id: 'm1',
      media_url: 'https://x/i.png',
      media_kind: 'image',
      media_width: 1200,
      media_height: 627,
    });
  });
  it('erreur si ni id ni url', async () => {
    await expect(resolveMediaRef({}, async () => null)).rejects.toThrow();
  });
  it('erreur si media_id introuvable', async () => {
    await expect(resolveMediaRef({ mediaId: 'x' }, async () => null)).rejects.toThrow();
  });
});
