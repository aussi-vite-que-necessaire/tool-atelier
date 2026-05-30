import { describe, expect, it } from 'vitest';
import { GALLERY_FILTERS } from '@/lib/media/gallery-filters';

describe('GALLERY_FILTERS', () => {
  it('lists image, video and pdf in French, in order', () => {
    expect(GALLERY_FILTERS.map((f) => f.kind)).toEqual(['image', 'video', 'pdf']);
    expect(GALLERY_FILTERS.map((f) => f.label)).toEqual(['Images', 'Vidéos', 'PDF']);
  });

  it('does not expose a "render" filter', () => {
    expect(GALLERY_FILTERS.some((f) => (f.kind as string) === 'render')).toBe(false);
  });
});
