import { describe, expect, it } from 'vitest';
import { validateModuleInput } from '@/lib/ressources/module-input';
import { parseModule } from '@/lib/ressources/module-schemas';

describe('validateModuleInput', () => {
  it('accepte un module markdown valide', () => {
    expect(validateModuleInput({ type: 'markdown', content: { md: 'x' } })).toEqual({
      type: 'markdown',
      content: { md: 'x' },
    });
  });
  it('rejette un type inconnu', () => {
    expect(() => validateModuleInput({ type: 'nope', content: {} })).toThrow();
  });
  it('rejette une image sans url valide', () => {
    expect(() => validateModuleInput({ type: 'image', content: { url: 'pas-url' } })).toThrow();
  });
});

describe('parseModule', () => {
  it('renvoie null pour un type inconnu', () => {
    expect(parseModule({ id: '1', type: 'nope', position: 0, content: {} })).toBeNull();
  });
  it('renvoie null pour un contenu invalide', () => {
    expect(parseModule({ id: '1', type: 'callout', position: 0, content: {} })).toBeNull();
  });
  it('parse un callout valide', () => {
    const m = parseModule({
      id: '1',
      type: 'callout',
      position: 0,
      content: { variant: 'info', md: 'hi' },
    });
    expect(m?.type).toBe('callout');
  });
});
