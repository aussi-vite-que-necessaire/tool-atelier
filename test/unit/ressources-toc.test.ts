import { describe, expect, it } from 'vitest';
import { extractSections, extractToc, Slugger } from '@/lib/ressources/toc';

describe('Slugger', () => {
  it('dé-duplique les ancres', () => {
    const s = new Slugger();
    expect(s.slug('Intro')).toBe('intro');
    expect(s.slug('Intro')).toBe('intro-1');
  });
});

describe('extractToc', () => {
  it('extrait h2/h3 hors blocs de code', () => {
    const md = ['## Titre', '```', '## Pas un titre', '```', '### Sous-titre'].join('\n');
    expect(extractToc(md)).toEqual([
      { depth: 2, text: 'Titre', id: 'titre' },
      { depth: 3, text: 'Sous-titre', id: 'sous-titre' },
    ]);
  });
});

describe('extractSections', () => {
  it('aplatit plusieurs textes markdown', () => {
    const out = extractSections(['## A', '## B']);
    expect(out.map((s) => s.title)).toEqual(['A', 'B']);
  });
});
