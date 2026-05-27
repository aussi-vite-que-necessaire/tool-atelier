import { describe, expect, test } from 'vitest';
import { validateUploadFile } from '@/lib/media/validate-upload';

describe('validateUploadFile', () => {
  test('accepte png/jpg/webp', () => {
    expect(validateUploadFile({ type: 'image/png', size: 100 })).toEqual({ ok: true, ext: 'png' });
    expect(validateUploadFile({ type: 'image/jpeg', size: 100 })).toEqual({ ok: true, ext: 'jpg' });
    expect(validateUploadFile({ type: 'image/webp', size: 100 })).toEqual({
      ok: true,
      ext: 'webp',
    });
  });

  test('rejette un format non supporté', () => {
    expect(validateUploadFile({ type: 'image/gif', size: 100 }).ok).toBe(false);
  });

  test('rejette > 10 Mo', () => {
    expect(validateUploadFile({ type: 'image/png', size: 11 * 1024 * 1024 }).ok).toBe(false);
  });
});
