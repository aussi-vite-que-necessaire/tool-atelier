import { describe, expect, test } from 'vitest';
import { isPreviewEnv } from '@/lib/auth/preview';

describe('isPreviewEnv', () => {
  test('faux quand APP_ENV est absent (local)', () => {
    expect(isPreviewEnv(undefined)).toBe(false);
  });
  test('faux quand APP_ENV vaut prod', () => {
    expect(isPreviewEnv('prod')).toBe(false);
  });
  test('faux quand APP_ENV est vide', () => {
    expect(isPreviewEnv('')).toBe(false);
  });
  test('vrai pour un slug de branche (preview déployée)', () => {
    expect(isPreviewEnv('work-contentos-otp')).toBe(true);
  });
});
