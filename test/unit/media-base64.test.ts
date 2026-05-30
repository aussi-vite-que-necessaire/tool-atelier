import { describe, expect, it } from 'vitest';
import { base64ToBytes, bytesToBase64 } from '@/lib/media/base64';

describe('base64', () => {
  it('décode un vecteur connu', () => {
    expect(Array.from(base64ToBytes('aGVsbG8='))).toEqual([104, 101, 108, 108, 111]);
  });

  it('encode un vecteur connu', () => {
    expect(bytesToBase64(new Uint8Array([104, 101, 108, 108, 111]))).toBe('aGVsbG8=');
  });

  it('round-trip sur des octets binaires', () => {
    const bytes = new Uint8Array(1000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 37) % 256;
    expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(Array.from(bytes));
  });
});
