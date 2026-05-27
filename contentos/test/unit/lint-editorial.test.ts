import { describe, expect, it } from 'vitest';
import { lintEditorial } from '@/lib/ai/lint-editorial';

describe('lintEditorial', () => {
  it('removes em-dashes and replaces by comma+space', () => {
    expect(lintEditorial('Il a dit — fais-le maintenant')).toBe('Il a dit, fais-le maintenant');
  });

  it('handles em-dash surrounded by spaces', () => {
    expect(lintEditorial('A — B — C')).toBe('A, B, C');
  });

  it('handles em-dash without surrounding spaces', () => {
    expect(lintEditorial('mot—mot')).toBe('mot, mot');
  });

  it('trims trailing whitespace lines and excessive blanks', () => {
    expect(lintEditorial('A\n\n\n\nB   \n')).toBe('A\n\nB');
  });

  it('leaves text without violations unchanged', () => {
    const ok = 'Voici un post propre.\n\nAvec deux paragraphes.';
    expect(lintEditorial(ok)).toBe(ok);
  });

  it('is idempotent', () => {
    const dirty = 'A — B\n\n\nC';
    const once = lintEditorial(dirty);
    const twice = lintEditorial(once);
    expect(twice).toBe(once);
  });
});
