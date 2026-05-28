import { describe, expect, test } from 'vitest';
import { decryptToken, encryptToken } from '@/lib/crypto';

describe('token crypto', () => {
  test('round-trip', () => {
    const blob = encryptToken('mon-access-token');
    expect(blob).not.toContain('mon-access-token');
    expect(decryptToken(blob)).toBe('mon-access-token');
  });

  test('deux chiffrements diffèrent (iv aléatoire)', () => {
    expect(encryptToken('x')).not.toBe(encryptToken('x'));
  });

  test('blob altéré échoue (authTag GCM)', () => {
    const blob = encryptToken('secret');
    const raw = Buffer.from(blob, 'base64');
    raw[raw.length - 1] = (raw[raw.length - 1] ?? 0) ^ 0xff;
    expect(() => decryptToken(raw.toString('base64'))).toThrow();
  });
});
