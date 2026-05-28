import { describe, expect, test } from 'vitest';
import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  test('rend titres et gras', () => {
    const html = renderMarkdown('# Titre\n\n**gras**');
    expect(html).toContain('<h1>Titre</h1>');
    expect(html).toContain('<strong>gras</strong>');
  });

  test('rend les listes', () => {
    const html = renderMarkdown('- a\n- b');
    expect(html).toContain('<li>a</li>');
  });
});
