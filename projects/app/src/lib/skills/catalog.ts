import { promises as fs } from 'node:fs';
import path from 'node:path';

// Manifeste d'un skill agentique (méta affichées sur le hub + nom de l'archive).
export type SkillManifest = {
  name: string;
  tool: string;
  version: number;
  tagline: string;
  description: string;
  requires_mcp?: string[];
  latest_changes?: string;
};

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
    try {
      const raw = await fs.readFile(path.join(root, e.name, 'manifest.json'), 'utf8');
      out.push(JSON.parse(raw) as SkillManifest);
    } catch {
      // dossier sans manifest → ignoré
    }
  }
  out.sort((a, b) => {
    const aw = TOOL_ORDER.indexOf(a.tool);
    const bw = TOOL_ORDER.indexOf(b.tool);
    const ai = aw === -1 ? TOOL_ORDER.length : aw;
    const bi = bw === -1 ? TOOL_ORDER.length : bw;
    if (ai !== bi) return ai - bi;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function getSkill(name: string): Promise<SkillManifest | null> {
  if (!isValidName(name)) return null;
  const root = await catalogRoot();
  try {
    const raw = await fs.readFile(path.join(root, name, 'manifest.json'), 'utf8');
    return JSON.parse(raw) as SkillManifest;
  } catch {
    return null;
  }
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
