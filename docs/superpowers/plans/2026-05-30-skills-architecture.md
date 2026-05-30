# Architecture des skills + workflow contentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:test-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passer le catalogue de skills au standard Agent Skills (frontmatter source unique) et poser le workflow `contentos` « rédige-moi un post » découpé en steps, avec un pas de tir sous-agents.

**Architecture:** `SKILL.md` à frontmatter YAML (name/description + bloc `metadata`) parsé par un mini-parseur maison (zéro dépendance, à la `archive.ts`). `catalog.ts` lit le frontmatter au lieu de `manifest.json`. Le skill `contentos` devient un workflow (`steps/`, `agents/`, `references/`).

**Tech Stack:** TypeScript, Vitest, Next.js (App Router), Node fs.

---

## File Structure

- `src/lib/skills/frontmatter.ts` — **créer** : `parseFrontmatter(raw)` → `{ name, description, metadata }` + validation standard.
- `src/lib/skills/catalog.ts` — **modifier** : lit le frontmatter ; type `SkillManifest` = `{ name, description, kind, domain, version, tagline, requires_mcp? }` ; tri sur `domain`.
- `src/lib/skills/catalog/contentos/SKILL.md` — **réécrire** : frontmatter + vue d'ensemble + checklist.
- `src/lib/skills/catalog/contentos/steps/{1-cadrer,2-plan,3-voix,4-mise-en-page,5-poser}.md` — **créer**.
- `src/lib/skills/catalog/contentos/agents/critique-editoriale.md` — **créer** (squelette).
- `src/lib/skills/catalog/contentos/references/outils-mcp.md` — **créer**.
- `src/lib/skills/catalog/contentos/manifest.json` — **supprimer**.
- `src/lib/skills/catalog/README.md` — **modifier** : documenter la convention.
- `src/app/(app)/skills/page.tsx` — **modifier** : `domain` + badge `kind`.
- `test/unit/skills-frontmatter.test.ts` — **créer**.
- `test/unit/skills-catalog.test.ts` — **modifier** (s'aligne sur frontmatter/domain).
- `test/unit/skills-conformance.test.ts` — **créer**.

---

## Task 1: Mini-parseur de frontmatter

**Files:**
- Create: `src/lib/skills/frontmatter.ts`
- Test: `test/unit/skills-frontmatter.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/skills-frontmatter.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Write minimal implementation**

```ts
// Mini-parseur de frontmatter YAML dédié au schéma des skills (zéro dépendance,
// à la archive.ts). Gère : scalaires `clé: valeur`, un bloc `metadata:` indenté
// (scalaires + tableaux inline `[a, b]`), nombres, chaînes guillemetées.

export type SkillMetadata = {
  kind: 'workflow' | 'atomic';
  domain: string;
  version: number;
  tagline: string;
  requires_mcp?: string[];
};

export type Frontmatter = { name: string; description: string; metadata: SkillMetadata };

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function parseScalar(v: string): string | number {
  const t = v.trim();
  if (/^-?\d+$/.test(t)) return Number.parseInt(t, 10);
  return unquote(t);
}

function parseInlineArray(v: string): string[] {
  const inner = v.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
  if (inner === '') return [];
  return inner.split(',').map((s) => unquote(s));
}

export function parseFrontmatter(raw: string): Frontmatter {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) throw new Error('Frontmatter absent (bloc --- requis).');
  const lines = m[1].split('\n');

  const top: Record<string, string> = {};
  const meta: Record<string, string | number | string[]> = {};
  let inMeta = false;

  for (const line of lines) {
    if (line.trim() === '') continue;
    if (/^metadata:\s*$/.test(line)) {
      inMeta = true;
      continue;
    }
    const indented = /^\s+/.test(line);
    if (inMeta && indented) {
      const [k, ...rest] = line.trim().split(':');
      const val = rest.join(':').trim();
      meta[k] = val.startsWith('[') ? parseInlineArray(val) : parseScalar(val);
    } else {
      inMeta = false;
      const [k, ...rest] = line.split(':');
      top[k.trim()] = rest.join(':').trim();
    }
  }

  const name = unquote(top.name ?? '');
  const description = unquote(top.description ?? '');
  if (!name) throw new Error('Frontmatter: `name` manquant.');
  if (!description) throw new Error('Frontmatter: `description` manquant.');

  return {
    name,
    description,
    metadata: {
      kind: (meta.kind as 'workflow' | 'atomic') ?? 'atomic',
      domain: (meta.domain as string) ?? 'suite',
      version: typeof meta.version === 'number' ? meta.version : 1,
      tagline: (meta.tagline as string) ?? '',
      requires_mcp: Array.isArray(meta.requires_mcp) ? (meta.requires_mcp as string[]) : undefined,
    },
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run test/unit/skills-frontmatter.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/skills/frontmatter.ts test/unit/skills-frontmatter.test.ts
git commit -m "feat(skills): mini-parseur de frontmatter (standard Agent Skills)"
```

---

## Task 2: `catalog.ts` lit le frontmatter

**Files:**
- Modify: `src/lib/skills/catalog.ts`
- Modify: `test/unit/skills-catalog.test.ts`

- [ ] **Step 1: Update the test** (remplacer le contenu par les assertions frontmatter/domain ; ZIP contient `SKILL.md` + `steps/` au lieu de `manifest.json`)

```ts
import { describe, expect, it } from 'vitest';
import { skillArchive } from '@/lib/skills/archive';
import { getSkill, getSkillDir, listSkills } from '@/lib/skills/catalog';

describe('catalogue skills', () => {
  it('liste le skill workflow contentos en tête (domaine suite)', async () => {
    const skills = await listSkills();
    expect(skills.map((s) => s.name)).toContain('contentos');
    expect(skills[0]?.domain).toBe('suite');
  });

  it('chaque skill a name, description, kind, domain et version (frontmatter)', async () => {
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
    expect((s?.version ?? 0)).toBeGreaterThanOrEqual(2);
  });

  it('getSkill rejette les noms hors charte (anti path-traversal)', async () => {
    expect(await getSkill('inconnu-xyz')).toBeNull();
    expect(await getSkill('../secret')).toBeNull();
    expect(await getSkill('a/b')).toBeNull();
  });

  it('getSkillDir pointe sous le catalogue', () => {
    expect(getSkillDir('contentos').endsWith('catalog/contentos')).toBe(true);
  });
});

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/skills-catalog.test.ts`
Expected: FAIL (`SkillManifest` n'a pas `kind`/`domain` ; lit encore `manifest.json`).

- [ ] **Step 3: Implement** — réécrire la lecture dans `catalog.ts` :

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter';

export type SkillManifest = {
  name: string;
  description: string;
  kind: 'workflow' | 'atomic';
  domain: string;
  version: number;
  tagline: string;
  requires_mcp?: string[];
};
```

Remplacer le corps de `listSkills`/`getSkill` : lire `SKILL.md`, `parseFrontmatter`, mapper vers `SkillManifest` (`{ name, description, ...metadata }`). Le tri stable utilise `domain` (TOOL_ORDER → `['suite','ressources','cast','media']`). `getSkill(name)` lit `<root>/<name>/SKILL.md` (toujours gardé par `isValidName`). `getSkillDir`/`getSkillDirAsync`/`catalogRoot` inchangés.

- [ ] **Step 4: Run test to verify it passes** (échouera tant que Task 3 n'a pas écrit le frontmatter de contentos — enchaîner Task 3 puis relancer).

Run: `npx vitest run test/unit/skills-catalog.test.ts`

- [ ] **Step 5: Commit** (après Task 3 vert)

---

## Task 3: Refonte du skill `contentos` (workflow)

**Files:**
- Rewrite: `src/lib/skills/catalog/contentos/SKILL.md`
- Create: `steps/1-cadrer.md`, `steps/2-plan.md`, `steps/3-voix.md`, `steps/4-mise-en-page.md`, `steps/5-poser.md`
- Create: `agents/critique-editoriale.md`
- Create: `references/outils-mcp.md`
- Delete: `manifest.json`

- [ ] **Step 1:** Écrire `SKILL.md` avec frontmatter conforme (name `contentos`, description 3e personne « ce que ça fait + quand »), vue d'ensemble courte, **checklist copiable** des 5 étapes, et liens **un seul niveau** vers chaque `steps/*.md`, `references/outils-mcp.md`, et la note sur `agents/`. Corps < 500 lignes, concis.
- [ ] **Step 2:** Écrire les 5 `steps/*.md` (concis, mini) selon §3 de la spec : 1-cadrer (menus format+voix via `list_publication_formats`/`list_voices`), 2-plan (matière+structure → plan + boucle de challenge via `agents/`), 3-voix (rédige dans la voix, sans mise en page), 4-mise-en-page (writingRules), 5-poser (`create_post` + montrer).
- [ ] **Step 3:** Écrire `agents/critique-editoriale.md` : squelette de sous-agent (frontmatter `name`/`description` + rôle court). Contenu mince (pas de tir).
- [ ] **Step 4:** Écrire `references/outils-mcp.md` : cheat-sheet des outils MCP par domaine (table des matières en tête, > 100 lignes → TOC).
- [ ] **Step 5:** `git rm src/lib/skills/catalog/contentos/manifest.json`.
- [ ] **Step 6: Run** `npx vitest run test/unit/skills-catalog.test.ts test/unit/skills-frontmatter.test.ts` → PASS.
- [ ] **Step 7: Commit**

```bash
git add src/lib/skills/catalog/contentos src/lib/skills/catalog.ts test/unit/skills-catalog.test.ts
git rm src/lib/skills/catalog/contentos/manifest.json
git commit -m "feat(skills): contentos devient un workflow (steps + agents + references), frontmatter source unique"
```

---

## Task 4: Test de conformité du catalogue

**Files:**
- Create: `test/unit/skills-conformance.test.ts`

- [ ] **Step 1: Write the test**

```ts
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { getSkillDir, listSkills } from '@/lib/skills/catalog';

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
```

- [ ] **Step 2: Run** `npx vitest run test/unit/skills-conformance.test.ts` → PASS.
- [ ] **Step 3: Commit**

```bash
git add test/unit/skills-conformance.test.ts
git commit -m "test(skills): conformité frontmatter Agent Skills du catalogue"
```

---

## Task 5: Hub `/skills` — `domain` + badge `kind`

**Files:**
- Modify: `src/app/(app)/skills/page.tsx`

- [ ] **Step 1:** Remplacer `TOOL_LABEL`/`skill.tool` par `DOMAIN_LABEL`/`skill.domain` ; ajouter un badge `kind` (`workflow`/`atomic`) à côté de la version. Le reste (tagline, description, requires_mcp, download) inchangé.
- [ ] **Step 2: Run** `npx vitest run test/unit/home-dashboard.test.ts` (sanity) + `npm run build` (la page compile) — Expected: OK.
- [ ] **Step 3:** `/apercu` sur `/skills` (mobile + desktop), Read les PNG, critiquer le rendu (badge kind lisible, hiérarchie), corriger si besoin.
- [ ] **Step 4: Commit**

```bash
git add "src/app/(app)/skills/page.tsx"
git commit -m "feat(skills): hub affiche domaine + type (workflow/atomic)"
```

---

## Task 6: Doc de convention + revue MCP

**Files:**
- Modify: `src/lib/skills/catalog/README.md`

- [ ] **Step 1:** Réécrire le README : convention frontmatter (name/description + metadata), arbo (`steps/`, `agents/`, `references/`), `kind`/`domain`, comment versionner.
- [ ] **Step 2: Commit**

```bash
git add src/lib/skills/catalog/README.md
git commit -m "docs(skills): convention frontmatter + arbo workflow/steps/agents"
```

---

## Task 7: Vérification globale + PR

- [ ] **Step 1: Run** la suite unitaire ciblée + lint : `npx vitest run test/unit/` puis `npx biome check src/lib/skills test/unit/skills-* "src/app/(app)/skills"`.
- [ ] **Step 2: Run** `npm run build` (sanity build Next).
- [ ] **Step 3:** Commit du spec + plan s'ils ne le sont pas déjà.
- [ ] **Step 4:** `git push -u origin claude/eager-dirac-7tL0G` (retries backoff si réseau).
- [ ] **Step 5:** Ouvrir la PR (titre + corps FR récapitulant revue MCP + archi skills). Puis `subscribe_pr_activity` (CI + revues) — d'office.

---

## Self-Review

- **Spec coverage** : revue MCP (Task 6 + spec §1) ; principes Anthropic (spec §2) ; frontmatter source unique (Task 1–2) ; workflow contentos steps/agents/references (Task 3) ; hub (Task 5) ; tests (Task 1,2,4) ; archive conforme (Task 2). ✓
- **Placeholders** : le contenu markdown des steps/agents est rédigé en Task 3 (prose = livrable). Pas de TODO logique. ✓
- **Type consistency** : `SkillManifest` = `{ name, description, kind, domain, version, tagline, requires_mcp? }` utilisé en catalog.ts (Task 2), page.tsx (Task 5), tests (Task 2,4). `parseFrontmatter` → `{ name, description, metadata }` (Task 1) consommé par catalog.ts (Task 2). ✓
