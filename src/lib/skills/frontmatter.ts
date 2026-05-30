// Mini-parseur de frontmatter YAML dédié au schéma des skills (zéro dépendance,
// dans l'esprit de archive.ts qui écrit le ZIP à la main). Il gère exactement
// notre forme : scalaires `clé: valeur` au premier niveau, un bloc `metadata:`
// indenté (scalaires + tableaux inline `[a, b]`), nombres et chaînes
// guillemetées. Pas un parseur YAML général — strictement notre standard skill.

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
  if (!m?.[1]) throw new Error('Frontmatter absent (bloc --- requis).');
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
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      const k = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim();
      meta[k] = val.startsWith('[') ? parseInlineArray(val) : parseScalar(val);
    } else {
      inMeta = false;
      const idx = line.indexOf(':');
      if (idx === -1) continue;
      top[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
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
      kind: meta.kind === 'workflow' ? 'workflow' : 'atomic',
      domain: typeof meta.domain === 'string' ? meta.domain : 'suite',
      version: typeof meta.version === 'number' ? meta.version : 1,
      tagline: typeof meta.tagline === 'string' ? meta.tagline : '',
      requires_mcp: Array.isArray(meta.requires_mcp) ? meta.requires_mcp : undefined,
    },
  };
}
