import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSkillDir, listSkills } from '@/lib/skills/catalog';

// Garde-fou : tout skill du catalogue reste conforme au standard Agent Skills
// (frontmatter name/description) — sinon il n'est pas téléchargeable proprement.
const NAME_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
const RESERVED = ['claude', 'anthropic'];

describe('conformité Agent Skills', () => {
  it('chaque skill a un SKILL.md et un name/description conformes', async () => {
    const skills = await listSkills();
    expect(skills.length).toBeGreaterThan(0);
    for (const s of skills) {
      const md = path.join(getSkillDir(s.name), 'SKILL.md');
      await expect(fs.access(md)).resolves.toBeUndefined();
      expect(NAME_RE.test(s.name)).toBe(true);
      expect(RESERVED.some((w) => s.name.includes(w))).toBe(false);
      expect(s.description.length).toBeGreaterThan(0);
      expect(s.description.length).toBeLessThanOrEqual(1024);
    }
  });
});
