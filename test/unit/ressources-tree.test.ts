import { describe, expect, it } from 'vitest';
import { resolvePageByPath } from '@/lib/ressources/resolve';
import { buildPageTree, type FlatPage } from '@/lib/ressources/tree';

const flat: FlatPage[] = [
  { id: 'root', parentId: null, slug: '', title: 'Racine', position: 0 },
  { id: 'b', parentId: 'root', slug: 'b', title: 'B', position: 1 },
  { id: 'a', parentId: 'root', slug: 'a', title: 'A', position: 0 },
  { id: 'a1', parentId: 'a', slug: 'un', title: 'A1', position: 0 },
];

describe('buildPageTree', () => {
  it('construit et trie par position', () => {
    const root = buildPageTree(flat)!;
    expect(root.id).toBe('root');
    expect(root.children.map((c) => c.id)).toEqual(['a', 'b']);
    expect(root.children[0]!.children[0]!.id).toBe('a1');
  });
  it('renvoie null sans racine', () => {
    expect(
      buildPageTree([{ id: 'x', parentId: 'y', slug: 'x', title: 'X', position: 0 }]),
    ).toBeNull();
  });
});

describe('resolvePageByPath', () => {
  it('résout un chemin imbriqué', () => {
    const root = buildPageTree(flat)!;
    expect(resolvePageByPath(root, ['a', 'un'])?.id).toBe('a1');
  });
  it('renvoie null pour un chemin inconnu', () => {
    const root = buildPageTree(flat)!;
    expect(resolvePageByPath(root, ['zzz'])).toBeNull();
  });
});
