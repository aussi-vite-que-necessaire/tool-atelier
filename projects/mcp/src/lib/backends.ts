import { env } from "./env";

export type Backend = { prefix: string; baseUrl: string; serviceKey: string };

// Registre statique (v1 = media seul). Ajouter cast/ressources = specs suivants.
// Fonction (et non const) : lecture paresseuse d'env, comme `env` lui-même —
// importer ce module ne doit pas parser process.env (sinon les tests cassent).
export function getBackends(): Backend[] {
  return [
    { prefix: "media", baseUrl: env.MEDIA_INTERNAL_URL, serviceKey: env.MEDIA_SERVICE_KEY },
  ];
}
