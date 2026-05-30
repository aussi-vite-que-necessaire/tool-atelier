import { describe, expect, it } from 'vitest';
import { parseFrontmatter } from '@/lib/skills/frontmatter';

const SAMPLE = `---
name: contentos
description: Rédige un post de bout en bout. Use when the user asks "rédige-moi un post".
metadata:
  kind: workflow
  domain: suite
  version: 2
  tagline: "Produire un post, piloté par l'agent."
  requires_mcp: [contentos]
---

# Corps
`;

describe('parseFrontmatter', () => {
  it('parse name, description et le bloc metadata', () => {
    const fm = parseFrontmatter(SAMPLE);
    expect(fm.name).toBe('contentos');
    expect(fm.description).toContain('rédige-moi un post');
    expect(fm.metadata.kind).toBe('workflow');
    expect(fm.metadata.domain).toBe('suite');
    expect(fm.metadata.version).toBe(2);
    expect(fm.metadata.tagline).toBe("Produire un post, piloté par l'agent.");
    expect(fm.metadata.requires_mcp).toEqual(['contentos']);
  });

  it('lève si pas de bloc frontmatter', () => {
    expect(() => parseFrontmatter('# pas de frontmatter')).toThrow();
  });

  it('lève si name ou description manquant', () => {
    expect(() => parseFrontmatter('---\nname: x\n---\n')).toThrow();
  });

  it('tolère un tableau inline vide et les nombres', () => {
    const fm = parseFrontmatter(
      '---\nname: x\ndescription: y\nmetadata:\n  version: 7\n  requires_mcp: []\n---\n',
    );
    expect(fm.metadata.version).toBe(7);
    expect(fm.metadata.requires_mcp).toEqual([]);
  });
});
