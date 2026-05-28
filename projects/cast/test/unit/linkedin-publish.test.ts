import { describe, expect, test } from 'vitest';
import {
  buildExternalUrl,
  buildPostBody,
  classifyHttpError,
  publishStub,
} from '@/lib/linkedin/publish';

describe('buildExternalUrl', () => {
  test('construit l’URL du feed depuis l’URN', () => {
    expect(buildExternalUrl('urn:li:share:42')).toBe(
      'https://www.linkedin.com/feed/update/urn%3Ali%3Ashare%3A42/',
    );
  });
});

describe('classifyHttpError', () => {
  test('mappe les statuts vers un kind', () => {
    expect(classifyHttpError(401)).toBe('token_expired');
    expect(classifyHttpError(429)).toBe('rate_limit');
    expect(classifyHttpError(400)).toBe('invalid_content');
    expect(classifyHttpError(503)).toBe('platform_5xx');
  });
});

describe('buildPostBody', () => {
  test('texte seul : pas de content media', () => {
    const body = buildPostBody({ authorUrn: 'urn:li:person:X', content: 'hello' });
    expect(body.author).toBe('urn:li:person:X');
    expect(body.commentary).toBe('hello');
    expect(body.content).toBeUndefined();
    expect(body.lifecycleState).toBe('PUBLISHED');
  });

  test('avec média : content.media.id présent', () => {
    const body = buildPostBody({
      authorUrn: 'urn:li:person:X',
      content: 'hi',
      mediaUrn: 'urn:li:image:9',
    });
    expect(body.content).toEqual({ media: { id: 'urn:li:image:9' } });
  });

  test('document : titre inclus dans content.media', () => {
    const body = buildPostBody({
      authorUrn: 'urn:li:person:X',
      content: 'hi',
      mediaUrn: 'urn:li:document:9',
      title: 'carrousel.pdf',
    });
    expect(body.content).toEqual({ media: { id: 'urn:li:document:9', title: 'carrousel.pdf' } });
  });
});

describe('publishStub', () => {
  test('retourne un URN/URL factices sans réseau (texte, image, document, vidéo)', async () => {
    for (const media of [
      null,
      { kind: 'image' as const, bytes: Buffer.from('x') },
      { kind: 'document' as const, bytes: Buffer.from('x'), filename: 'c.pdf' },
      { kind: 'video' as const, bytes: Buffer.from('x') },
    ]) {
      const r = await publishStub({
        content: 'x',
        media,
        accessToken: 't',
        authorUrn: 'urn:li:person:X',
      });
      expect(r.id).toMatch(/^urn:li:share:/);
    }
  });
});
