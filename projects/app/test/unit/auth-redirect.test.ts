import { describe, expect, it } from 'vitest';
import { safeRedirect } from '@/lib/auth/redirect';

describe('safeRedirect', () => {
  it('renvoie /cast par défaut quand la cible est absente', () => {
    expect(safeRedirect(null)).toBe('/cast');
    expect(safeRedirect(undefined)).toBe('/cast');
    expect(safeRedirect('')).toBe('/cast');
  });

  it('conserve un chemin interne relatif', () => {
    expect(safeRedirect('/media/gallery')).toBe('/media/gallery');
    expect(safeRedirect('/ressources')).toBe('/ressources');
  });

  it('rejette les destinations externes (protocole ou //)', () => {
    expect(safeRedirect('//evil.example')).toBe('/cast');
    expect(safeRedirect('https://evil.example')).toBe('/cast');
    expect(safeRedirect('javascript:alert(1)')).toBe('/cast');
  });
});
