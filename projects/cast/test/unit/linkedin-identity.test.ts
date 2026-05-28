import { describe, expect, test } from 'vitest';
import { resolveAuthor } from '@/lib/linkedin/author';

describe('resolveAuthor', () => {
  test('priorité au displayName LinkedIn', () => {
    const a = resolveAuthor({
      displayName: 'Manu AVQN',
      brandName: 'AVQN',
      userName: 'manu',
    });
    expect(a.name).toBe('Manu AVQN');
  });

  test('repli sur brandName puis userName puis défaut', () => {
    expect(resolveAuthor({ brandName: 'AVQN' }).name).toBe('AVQN');
    expect(resolveAuthor({ userName: 'manu' }).name).toBe('manu');
    expect(resolveAuthor({}).name).toBe('Vous');
  });

  test('headline = brandSignature si présent, sinon absent', () => {
    expect(resolveAuthor({ displayName: 'X', brandSignature: 'Fondateur' }).headline).toBe(
      'Fondateur',
    );
    expect(resolveAuthor({ displayName: 'X' }).headline).toBeUndefined();
  });

  test('avatarUrl = brandLogoUrl si présent, sinon absent', () => {
    expect(
      resolveAuthor({ displayName: 'X', brandLogoUrl: 'https://img/logo.png' }).avatarUrl,
    ).toBe('https://img/logo.png');
    expect(resolveAuthor({ displayName: 'X' }).avatarUrl).toBeUndefined();
  });

  test('ignore les chaînes vides / espaces', () => {
    const a = resolveAuthor({ displayName: '   ', brandName: 'AVQN', brandSignature: '  ' });
    expect(a.name).toBe('AVQN');
    expect(a.headline).toBeUndefined();
  });
});
