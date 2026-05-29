import { describe, expect, it } from 'vitest';
import { toLinkedInMediaKind } from '@/lib/linkedin/media-kind';

describe('toLinkedInMediaKind', () => {
  it('pdf → document, video → video, image/render → image', () => {
    expect(toLinkedInMediaKind('pdf')).toBe('document');
    expect(toLinkedInMediaKind('video')).toBe('video');
    expect(toLinkedInMediaKind('image')).toBe('image');
    expect(toLinkedInMediaKind('render')).toBe('image');
    expect(toLinkedInMediaKind(null)).toBe('image');
  });
});
