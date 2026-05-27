import { describe, expect, test } from 'vitest';
import { runwayDays } from '@/lib/linkedin/runway';

describe('runwayDays', () => {
  test('futur ~60j', () => {
    const d = new Date(Date.now() + 60 * 24 * 3600 * 1000);
    expect(runwayDays(d)).toBeGreaterThanOrEqual(59);
    expect(runwayDays(d)).toBeLessThanOrEqual(60);
  });
  test('passé = 0', () => {
    expect(runwayDays(new Date(Date.now() - 1000))).toBe(0);
  });
});
