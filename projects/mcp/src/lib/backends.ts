import { env } from "./env";

export type Backend = { prefix: string; baseUrl: string; serviceKey: string };

// Registre statique (v1 = media seul). Ajouter cast/ressources = specs suivants.
export const backends: Backend[] = [
  { prefix: "media", baseUrl: env.MEDIA_INTERNAL_URL, serviceKey: env.MEDIA_SERVICE_KEY },
];
