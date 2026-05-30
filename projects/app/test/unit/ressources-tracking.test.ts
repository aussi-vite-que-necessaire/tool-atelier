import { describe, expect, it } from 'vitest';
import {
  buildTrackingUrl,
  isPrefetchRequest,
  parseRefCookie,
  parseRefFromParams,
  serializeRefCookie,
} from '@/lib/ressources/tracking';

describe('parseRefFromParams', () => {
  it('lit utm_* et src', () => {
    const r = parseRefFromParams(new URLSearchParams('?src=LinkedIn&utm_campaign=Launch'));
    expect(r).toEqual({ source: 'linkedin', medium: null, campaign: 'launch' });
  });
  it('renvoie null sans aucun paramètre', () => {
    expect(parseRefFromParams(new URLSearchParams())).toBeNull();
  });
});

describe('buildTrackingUrl', () => {
  it('ajoute les utm normalisés', () => {
    const u = buildTrackingUrl('https://x.test/r/a', { source: 'LinkedIn', campaign: 'Q1' });
    expect(u).toContain('utm_source=linkedin');
    expect(u).toContain('utm_campaign=q1');
  });
});

describe('cookie round-trip', () => {
  it('sérialise puis reparse', () => {
    const ref = { source: 'x', medium: null, campaign: 'y' };
    expect(parseRefCookie(serializeRefCookie(ref))).toEqual(ref);
  });
  it('parse null sur entrée invalide', () => {
    expect(parseRefCookie('pas-json')).toBeNull();
  });
});

describe('isPrefetchRequest', () => {
  it('détecte le prefetch routeur', () => {
    expect(isPrefetchRequest({ get: (n) => (n === 'next-router-prefetch' ? '1' : null) })).toBe(
      true,
    );
  });
  it('faux pour une requête normale', () => {
    expect(isPrefetchRequest({ get: () => null })).toBe(false);
  });
});
