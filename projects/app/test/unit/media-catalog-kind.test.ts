import { describe, expect, it } from 'vitest';
import { kindFromUrl } from '@/lib/media-catalog/kind';

describe('kindFromUrl', () => {
  it("déduit le kind de l'extension", () => {
    expect(kindFromUrl('https://x/a.png')).toBe('image');
    expect(kindFromUrl('https://x/a.jpg')).toBe('image');
    expect(kindFromUrl('https://x/a.mp4')).toBe('video');
    expect(kindFromUrl('https://x/a.pdf')).toBe('pdf');
    expect(kindFromUrl('https://x/a')).toBe('image');
  });
});
