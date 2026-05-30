import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  config,
  isBrowserConfigured,
  isGeminiConfigured,
  isStorageConfigured,
  MediaUnavailableError,
} from '@/lib/media/config';

const R2_KEYS = [
  'R2_S3_ENDPOINT',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_BUCKET',
  'R2_PUBLIC_BASE_URL',
] as const;
const TOUCHED = [...R2_KEYS, 'GEMINI_API_KEY', 'BROWSER_URL', 'CONTENT_OS_MEDIA_STUB', 'APP_ENV'];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const k of TOUCHED) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of TOUCHED) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('gating des capacités media', () => {
  it('sans secret : tout est désactivé, aucune erreur au simple test', () => {
    expect(isStorageConfigured()).toBe(false);
    expect(isGeminiConfigured()).toBe(false);
    expect(isBrowserConfigured()).toBe(false);
  });

  it('config.geminiApiKey() lève MediaUnavailableError si absente', () => {
    expect(() => config.geminiApiKey()).toThrow(MediaUnavailableError);
  });

  it('R2 complet → storage configuré', () => {
    for (const k of R2_KEYS) process.env[k] = `val-${k}`;
    expect(isStorageConfigured()).toBe(true);
    expect(config.r2().bucket).toBe('val-R2_BUCKET');
  });

  it('R2 partiel → storage non configuré (et r2() lève)', () => {
    process.env.R2_BUCKET = 'b';
    expect(isStorageConfigured()).toBe(false);
    expect(() => config.r2()).toThrow(MediaUnavailableError);
  });

  it('CONTENT_OS_MEDIA_STUB=1 force le mode dégradé malgré les secrets', () => {
    for (const k of R2_KEYS) process.env[k] = 'x';
    process.env.GEMINI_API_KEY = 'g';
    process.env.BROWSER_URL = 'ws://b';
    process.env.CONTENT_OS_MEDIA_STUB = '1';
    expect(isStorageConfigured()).toBe(false);
    expect(isGeminiConfigured()).toBe(false);
    expect(isBrowserConfigured()).toBe(false);
  });

  it('keyPrefix : vide en prod, slugé sinon', () => {
    process.env.APP_ENV = 'prod';
    expect(config.keyPrefix()).toBe('');
    process.env.APP_ENV = 'ma-branche';
    expect(config.keyPrefix()).toBe('ma-branche/');
  });
});
