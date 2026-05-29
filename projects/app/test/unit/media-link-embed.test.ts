import { describe, expect, it } from 'vitest';
import {
  isMediaCreatedMessage,
  MEDIA_CREATED,
  mediaEmbedOrigin,
  mediaRefFromCreatedMedia,
} from '@/lib/media-link/embed';

describe('mediaEmbedOrigin', () => {
  it('en prod : origine de MEDIA_ENGINE_URL', () => {
    expect(
      mediaEmbedOrigin({
        isPreview: false,
        appUrl: 'https://cast.contentos.ch',
        mediaEngineUrl: 'https://media.contentos.ch',
      }),
    ).toBe('https://media.contentos.ch');
  });

  it('en preview : media preview de la même branche (cast- → media-)', () => {
    expect(
      mediaEmbedOrigin({
        isPreview: true,
        appUrl: 'https://cast-ma-branche.preview.contentos.ch',
        mediaEngineUrl: 'https://media.contentos.ch',
      }),
    ).toBe('https://media-ma-branche.preview.contentos.ch');
  });
});

describe('isMediaCreatedMessage', () => {
  it('reconnaît un message média créé', () => {
    expect(isMediaCreatedMessage({ type: MEDIA_CREATED, media: {} })).toBe(true);
  });

  it('rejette les autres messages', () => {
    expect(isMediaCreatedMessage({ type: 'autre', media: {} })).toBe(false);
    expect(isMediaCreatedMessage({ type: MEDIA_CREATED })).toBe(false);
    expect(isMediaCreatedMessage(null)).toBe(false);
    expect(isMediaCreatedMessage('x')).toBe(false);
  });
});

describe('mediaRefFromCreatedMedia', () => {
  it('construit un MediaRef depuis un descripteur valide', () => {
    expect(
      mediaRefFromCreatedMedia({
        id: 'm1',
        url: 'https://r2.contentos.ch/x.png',
        kind: 'image',
        width: 1200,
        height: 800,
      }),
    ).toEqual({
      media_id: 'm1',
      media_url: 'https://r2.contentos.ch/x.png',
      media_kind: 'image',
      media_width: 1200,
      media_height: 800,
    });
  });

  it('accepte un id absent (attache par URL seule)', () => {
    const ref = mediaRefFromCreatedMedia({
      url: 'https://r2/x.pdf',
      kind: 'pdf',
      width: null,
      height: null,
    });
    expect(ref).toEqual({
      media_id: null,
      media_url: 'https://r2/x.pdf',
      media_kind: 'pdf',
      media_width: null,
      media_height: null,
    });
  });

  it('rejette une url non absolue ou non http(s)', () => {
    expect(mediaRefFromCreatedMedia({ url: '/x.png', kind: 'image' })).toBeNull();
    expect(mediaRefFromCreatedMedia({ url: 'ftp://x/y.png', kind: 'image' })).toBeNull();
    expect(mediaRefFromCreatedMedia({ url: 'javascript:alert(1)', kind: 'image' })).toBeNull();
  });

  it('rejette un kind inconnu ou un payload non-objet', () => {
    expect(mediaRefFromCreatedMedia({ url: 'https://r2/x', kind: 'gif' })).toBeNull();
    expect(mediaRefFromCreatedMedia(null)).toBeNull();
    expect(mediaRefFromCreatedMedia('x')).toBeNull();
  });

  it('normalise des dims non numériques en null', () => {
    const ref = mediaRefFromCreatedMedia({
      id: 'm2',
      url: 'https://r2/x.png',
      kind: 'render',
      width: 'big',
      height: undefined,
    });
    expect(ref?.media_width).toBeNull();
    expect(ref?.media_height).toBeNull();
  });
});
