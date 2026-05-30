import { describe, expect, it } from 'vitest';
import { normalizeHandle, parseSettingsInput } from '@/lib/ressources/settings-validate';

describe('parseSettingsInput', () => {
  it('valide et trim le nom (vide → null)', () => {
    const out = parseSettingsInput({ brandName: '  ', theme: { preset: 'modern', overrides: {} } });
    expect(out).toEqual({ brandName: null, theme: { preset: 'modern', overrides: {} } });
  });
  it('rejette une config invalide', () => {
    expect(parseSettingsInput({ brandName: 'X', theme: { preset: '' } })).toBeNull();
  });
});

describe('normalizeHandle', () => {
  it('slugifie un nom', () => {
    expect(normalizeHandle('Manu AVQN')).toBe('manu-avqn');
  });
  it('repli sur "espace" si vide', () => {
    expect(normalizeHandle('!!!')).toBe('espace');
  });
});
