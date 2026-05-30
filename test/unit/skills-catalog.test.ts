import { describe, expect, it } from 'vitest';
import { skillArchive } from '@/lib/skills/archive';
import { getSkill, getSkillDir, listSkills } from '@/lib/skills/catalog';

// Le catalogue lit les skills depuis le dossier embarqué (src/lib/skills/catalog),
// frontmatter de SKILL.md comme source unique. Aucune base, aucune env.
describe('catalogue skills', () => {
  it('liste le skill workflow contentos en tête (domaine suite)', async () => {
    const skills = await listSkills();
    expect(skills.map((s) => s.name)).toContain('contentos');
    expect(skills[0]?.domain).toBe('suite');
  });

  it('chaque skill a name, description, kind, domain et version', async () => {
    for (const s of await listSkills()) {
      expect(s.name.length).toBeGreaterThan(0);
      expect(s.description.length).toBeGreaterThan(0);
      expect(['workflow', 'atomic']).toContain(s.kind);
      expect(s.domain.length).toBeGreaterThan(0);
      expect(Number.isInteger(s.version)).toBe(true);
    }
  });

  it('contentos est un workflow en version >= 2', async () => {
    const s = await getSkill('contentos');
    expect(s?.kind).toBe('workflow');
    expect(s?.version ?? 0).toBeGreaterThanOrEqual(2);
  });

  it('getSkill rejette les noms hors charte (anti path-traversal)', async () => {
    expect((await getSkill('contentos'))?.name).toBe('contentos');
    expect(await getSkill('inconnu-xyz')).toBeNull();
    expect(await getSkill('../secret')).toBeNull();
    expect(await getSkill('a/b')).toBeNull();
  });

  it('getSkillDir pointe sous le catalogue', () => {
    expect(getSkillDir('contentos').endsWith('catalog/contentos')).toBe(true);
  });
});

// L'archive est un ZIP stocké (sans compression), construit en mémoire. On
// vérifie l'entête ZIP (PK\x03\x04) et la présence des chemins attendus —
// dont un fichier de step (divulgation progressive bundlée).
describe('archive zip des skills', () => {
  it('zip signé PK contenant SKILL.md et un fichier steps/', async () => {
    const buf = await skillArchive('contentos');
    expect(buf).not.toBeNull();
    const bytes = buf!;
    expect([bytes[0], bytes[1], bytes[2], bytes[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const text = Buffer.from(bytes).toString('latin1');
    expect(text).toContain('contentos/SKILL.md');
    expect(text).toContain('contentos/steps/');
  });

  it('renvoie null pour un skill inconnu', async () => {
    expect(await skillArchive('inconnu-xyz')).toBeNull();
  });
});
