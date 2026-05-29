import { describe, expect, it } from 'vitest';
import { highlightCode } from '@/lib/ressources/highlight';
import { renderReaderMarkdown } from '@/lib/ressources/render-markdown';

describe('renderReaderMarkdown', () => {
  it('ajoute des ancres aux titres h2/h3', () => {
    const html = renderReaderMarkdown('## Mon Titre\n\ntexte');
    expect(html).toContain('<h2 id="mon-titre">Mon Titre</h2>');
  });
  it('rend les listes et le gras', () => {
    const html = renderReaderMarkdown('- a\n- b\n\n**fort**');
    expect(html).toContain('<li>a</li>');
    expect(html).toContain('<strong>fort</strong>');
  });
});

describe('highlightCode', () => {
  it('colore du json connu', () => {
    expect(highlightCode('{"a":1}', 'json')).toContain('token');
  });
  it('échappe un langage inconnu', () => {
    expect(highlightCode('<x>', 'cobol-inconnu')).toBe('&lt;x&gt;');
  });
});
