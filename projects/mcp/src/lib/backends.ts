import { env } from "./env";

export type Backend = { prefix: string; baseUrl: string; serviceKey: string };

// Registre statique (v1 = media seul). Ajouter cast/ressources = specs suivants.
// Fonction (et non const) : lecture paresseuse d'env, comme `env` lui-même —
// importer ce module ne doit pas parser process.env (sinon les tests cassent).
// Invariant : un `prefix` ne contient pas de `_` (sert à dé-préfixer les noms
// de tools `<prefix>_<tool>` côté gateway.ts). Service-key par backend, qui
// réutilise la clé de service existante du backend (media : MEDIA_ENGINE_SERVICE_KEY).
export function getBackends(): Backend[] {
  return [
    { prefix: "media", baseUrl: env.MEDIA_INTERNAL_URL, serviceKey: env.MEDIA_SERVICE_KEY },
  ];
}
