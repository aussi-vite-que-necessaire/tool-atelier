import { z } from "zod";

// Petit env typé pour les variables consommées partout (URL publique, provider d'auth).
// Le reste des secrets (R2, Gemini, MEDIA_ENGINE_SERVICE_KEY, BROWSER_URL) est lu
// paresseusement via `src/lib/config.ts` pour ne pas faire échouer `next build`.
// Lecture paresseuse ici aussi : on ne parse process.env qu'au premier accès.
const envSchema = z.object({
  // URL publique du déploiement (injectée par deploy.sh, vide en local sans hôte).
  APP_URL: z.string().url(),
  // URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
  // En preview, isPreview court-circuite tout fetch vers auth.
  AUTH_URL: z.string().url().default("https://auth.contentos.ch"),
  // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
  APP_ENV: z.string().optional(),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;
function read(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}

// Proxy : se comporte comme l'objet parsé, mais ne lit process.env qu'au premier accès.
export const env = new Proxy({} as Env, {
  get(_t, prop) {
    return (read() as unknown as Record<string | symbol, unknown>)[prop];
  },
}) as Env;
