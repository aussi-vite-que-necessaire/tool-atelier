import { promises as fs } from 'node:fs';
import path from 'node:path';
import { parseFrontmatter } from './frontmatter';

// Méta d'un skill agentique, dérivées du frontmatter de SKILL.md (source unique,
// standard Agent Skills) : `name`/`description` standard + bloc `metadata` atelier.
export type SkillManifest = {
  name: string;
  description: string;
  kind: 'workflow' | 'atomic';
  domain: string;
  version: number;
  tagline: string;
  requires_mcp?: string[];
};

// Lit et mappe le frontmatter de SKILL.md d'un skill (null si absent/illisible).
async function readManifest(root: string, name: string): Promise<SkillManifest | null> {
  try {
    const raw = await fs.readFile(path.join(root, name, 'SKILL.md'), 'utf8');
    const fm = parseFrontmatter(raw);
    return {
      name: fm.name,
      description: fm.description,
      kind: fm.metadata.kind,
      domain: fm.metadata.domain,
      version: fm.metadata.version,
      tagline: fm.metadata.tagline,
      requires_mcp: fm.metadata.requires_mcp,
    };
  } catch {
    return null;
  }
}

// Racine des skills embarqués. En dev/test : le dossier source versionné. En
// runtime standalone : le Dockerfile copie ce dossier sous ./skills-catalog
// (cwd = /app), pris en priorité s'il existe (résolu paresseusement).
const SOURCE_ROOT = path.join(process.cwd(), 'src/lib/skills/catalog');
const RUNTIME_ROOT = path.join(process.cwd(), 'skills-catalog');

let cachedRoot: string | null = null;
async function catalogRoot(): Promise<string> {
  if (cachedRoot) return cachedRoot;
  try {
    await fs.access(RUNTIME_ROOT);
    cachedRoot = RUNTIME_ROOT;
  } catch {
    cachedRoot = SOURCE_ROOT;
  }
  return cachedRoot;
}

// Ordre stable d'affichage : meta (suite) en tête, puis par domaine, puis alpha.
const TOOL_ORDER = ['suite', 'ressources', 'cast', 'media'];

function isValidName(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*$/.test(name);
}

export async function listSkills(): Promise<SkillManifest[]> {
  const root = await catalogRoot();
  let entries: import('node:fs').Dirent[];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: SkillManifest[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifest = await readManifest(root, e.name);
    if (manifest) out.push(manifest);
    // dossier sans SKILL.md valide → ignoré
  }
  out.sort((a, b) => {
    const aw = TOOL_ORDER.indexOf(a.domain);
    const bw = TOOL_ORDER.indexOf(b.domain);
    const ai = aw === -1 ? TOOL_ORDER.length : aw;
    const bi = bw === -1 ? TOOL_ORDER.length : bw;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function getSkill(name: string): Promise<SkillManifest | null> {
  if (!isValidName(name)) return null;
  return readManifest(await catalogRoot(), name);
}

// Chemin absolu du dossier d'un skill (validé). Lève si nom hors charte.
export async function getSkillDirAsync(name: string): Promise<string> {
  if (!isValidName(name)) throw new Error(`Nom de skill invalide: ${name}`);
  return path.join(await catalogRoot(), name);
}

// Variante synchrone basée sur la racine source — utilisée par les tests pour
// vérifier le chemin sans toucher au cache runtime.
export function getSkillDir(name: string): string {
  return path.join(SOURCE_ROOT, name);
}
