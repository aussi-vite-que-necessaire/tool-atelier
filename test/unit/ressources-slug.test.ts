import { describe, expect, it } from 'vitest';
import { slugify, uniqueSlug } from '@/lib/ressources/slug';

describe('slugify', () => {
  it('translittère et normalise', () => {
    expect(slugify('Prompt Système éprouvé !')).toBe('prompt-systeme-eprouve');
  });
  it('réduit les séparateurs multiples', () => {
    expect(slugify('a   b__c')).toBe('a-b-c');
  });
  it('retire les tirets de bord', () => {
    expect(slugify('  -Hello-  ')).toBe('hello');
  });
});

describe('uniqueSlug', () => {
  it('renvoie la base si libre', () => {
    expect(uniqueSlug('guide', ['autre'])).toBe('guide');
  });
  it('suffixe en cas de collision', () => {
    expect(uniqueSlug('guide', ['guide', 'guide-2'])).toBe('guide-3');
  });
});
