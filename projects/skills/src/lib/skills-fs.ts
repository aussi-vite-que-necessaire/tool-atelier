import { promises as fs } from "node:fs";
import path from "node:path";

export type Manifest = {
  name: string;
  tool: string;
  version: number;
  tagline: string;
  description: string;
  requires_mcp?: string[];
  latest_changes?: string;
};

// Racine des skills, relative au CWD du process Next.
// En dev : <repo>/skills/skills. En standalone runtime : <container>/skills.
const SKILLS_ROOT = path.join(process.cwd(), "skills");

// Ordre stable d'affichage : meta en tête, puis par tool, puis alpha.
const TOOL_ORDER = ["suite", "ressources", "contentos", "media"];

export async function listSkills(): Promise<Manifest[]> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(SKILLS_ROOT, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: Manifest[] = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const manifestPath = path.join(SKILLS_ROOT, e.name, "manifest.json");
    try {
      const raw = await fs.readFile(manifestPath, "utf8");
      out.push(JSON.parse(raw) as Manifest);
    } catch {
      // dossier sans manifest → ignoré
    }
  }
  out.sort((a, b) => {
    const ai = TOOL_ORDER.indexOf(a.tool);
    const bi = TOOL_ORDER.indexOf(b.tool);
    const aw = ai === -1 ? TOOL_ORDER.length : ai;
    const bw = bi === -1 ? TOOL_ORDER.length : bi;
    if (aw !== bw) return aw - bw;
    return a.name.localeCompare(b.name);
  });
  return out;
}

export async function getSkill(name: string): Promise<Manifest | null> {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) return null;
  try {
    const raw = await fs.readFile(path.join(SKILLS_ROOT, name, "manifest.json"), "utf8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return null;
  }
}

export function getSkillDir(name: string): string {
  return path.join(SKILLS_ROOT, name);
}
