import { describe, expect, test } from 'vitest';
import { resolveAuthor } from '@/lib/linkedin/author';

describe('resolveAuthor', () => {
  test('priorité au displayName LinkedIn', () => {
    const a = resolveAuthor({ displayName: 'Manu AVQN', userName: 'manu' });
    expect(a.name).toBe('Manu AVQN');
  });

  test('repli sur userName puis défaut', () => {
    expect(resolveAuthor({ userName: 'manu' }).name).toBe('manu');
    expect(resolveAuthor({}).name).toBe('Vous');
  });

  test('ignore les chaînes vides / espaces', () => {
    expect(resolveAuthor({ displayName: '   ', userName: 'manu' }).name).toBe('manu');
    expect(resolveAuthor({ displayName: '   ' }).name).toBe('Vous');
  });
});
