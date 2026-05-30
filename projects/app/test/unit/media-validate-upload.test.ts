import { describe, expect, it } from 'vitest';
import { validateUpload } from '@/lib/media/validate-upload';

describe('validateUpload', () => {
  it('accepte un PNG sous la limite', () => {
    expect(validateUpload('image/png', 5_000_000)).toEqual({ ok: true, kind: 'image' });
  });
  it('refuse une image trop lourde', () => {
    expect(validateUpload('image/png', 20_000_000).ok).toBe(false);
  });
  it("accepte un PDF jusqu'à 100 Mo", () => {
    expect(validateUpload('application/pdf', 90_000_000)).toEqual({ ok: true, kind: 'pdf' });
  });
  it("accepte une vidéo mp4 jusqu'à 500 Mo", () => {
    expect(validateUpload('video/mp4', 400_000_000)).toEqual({ ok: true, kind: 'video' });
  });
  it('refuse un type non supporté', () => {
    expect(validateUpload('application/zip', 10).ok).toBe(false);
  });
});
