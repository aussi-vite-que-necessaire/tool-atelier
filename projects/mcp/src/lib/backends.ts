import { env } from "./env";

export type Backend = { prefix: string; baseUrl: string; serviceKey: string };

// Dérive l'origine d'un backend depuis celle de la passerelle : on remplace le
// préfixe de sous-domaine `mcp` par celui du backend.
//   prod    : mcp.contentos.ch            → media.contentos.ch
//   preview : mcp-<branche>.preview.…     → media-<branche>.preview.…
// La passerelle parle ainsi aux backends du **même environnement** (preview de
// la même branche, ou prod), sans variable d'URL à injecter.
export function backendBaseUrl(prefix: string, appUrl: string): string {
  const u = new URL(appUrl);
  const [first, ...rest] = u.hostname.split(".");
  u.hostname = [first.replace(/^mcp/, prefix), ...rest].join(".");
  return u.origin;
}

// Registre statique des backends fédérés. Préfixe = nom logique (sans `_`, sert
// à dé-préfixer les noms de tools `<prefix>_<tool>`). Lecture paresseuse d'env.
export function getBackends(): Backend[] {
  const appUrl = env.APP_URL;
  const serviceKey = env.MCP_INTERNAL_KEY;
  return ["media", "cast", "ressources"].map((prefix) => ({
    prefix,
    baseUrl: backendBaseUrl(prefix, appUrl),
    serviceKey,
  }));
}
