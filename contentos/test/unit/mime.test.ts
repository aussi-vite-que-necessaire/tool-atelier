import { describe, expect, test } from 'vitest';
import { mimeFromKey } from '@/lib/media/mime';

describe('mimeFromKey', () => {
  test('mappe les extensions connues', () => {
    expect(mimeFromKey('media/u/x.png')).toBe('image/png');
    expect(mimeFromKey('a.jpg')).toBe('image/jpeg');
    expect(mimeFromKey('a.jpeg')).toBe('image/jpeg');
    expect(mimeFromKey('a.webp')).toBe('image/webp');
  });
  test('fallback octet-stream', () => {
    expect(mimeFromKey('a.gif')).toBe('application/octet-stream');
    expect(mimeFromKey('noext')).toBe('application/octet-stream');
  });
});
