import { describe, expect, it } from 'vitest';
import { skillArchive } from '@/lib/skills/archive';
import { getSkill, getSkillDir, listSkills } from '@/lib/skills/catalog';

// Le catalogue lit les skills depuis le dossier embarqué (src/lib/skills/catalog).
// Aucune base, aucune env : c'est de la lecture de fichiers versionnés.
describe('catalogue skills', () => {
  it('liste le skill unifié contentos de la suite', async () => {
    const skills = await listSkills();
    const names = skills.map((s) => s.name);
    expect(names).toContain('contentos');
    // skill de suite, en tête de l'ordre stable.
    expect(skills[0]?.tool).toBe('suite');
  });

  it('chaque manifeste a name, tool, version et description', async () => {
    for (const s of await listSkills()) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.tool.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.version)).toBe(true);
      expect(s.description.length).toBeGreaterThan(0);
    }
  });

  it('getSkill renvoie le manifeste pour un nom valide, null sinon', async () => {
    expect((await getSkill('contentos'))?.name).toBe('contentos');
    expect(await getSkill('inconnu-xyz')).toBeNull();
    // rejette les noms hors charte (anti path-traversal)
    expect(await getSkill('../secret')).toBeNull();
    expect(await getSkill('a/b')).toBeNull();
  });

  it('getSkillDir pointe sous le catalogue', () => {
    expect(getSkillDir('contentos').endsWith('catalog/contentos')).toBe(true);
  });
});

// L'archive est un ZIP stocké (sans compression), construit en mémoire — pas de
// dépendance binaire. On vérifie l'entête ZIP (PK\x03\x04) et la présence des
// chemins attendus dans le central directory.
describe('archive zip des skills', () => {
  it('produit un zip qui commence par la signature PK et contient SKILL.md', async () => {
    const buf = await skillArchive('contentos');
    expect(buf).not.toBeNull();
    const bytes = buf!;
    // Signature local file header.
    expect(bytes[0]).toBe(0x50); // P
    expect(bytes[1]).toBe(0x4b); // K
    expect(bytes[2]).toBe(0x03);
    expect(bytes[3]).toBe(0x04);
    // Le nom du fichier d'entrée apparaît en clair (stored, pas compressé).
    const text = Buffer.from(bytes).toString('latin1');
    expect(text).toContain('contentos/SKILL.md');
    expect(text).toContain('contentos/manifest.json');
  });

  it('renvoie null pour un skill inconnu', async () => {
    expect(await skillArchive('inconnu-xyz')).toBeNull();
  });
});
