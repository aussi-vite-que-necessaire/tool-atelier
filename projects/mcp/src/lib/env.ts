import { z } from "zod";

// Env typé, lecture paresseuse (ne parse pas au build). MEDIA_* = backend pilote.
const envSchema = z.object({
  APP_URL: z.string().url(),
  AUTH_URL: z.string().url().default("https://auth.contentos.ch"),
  APP_ENV: z.string().optional(),
  // URL interne du backend media sur le réseau lab (injectée par deploy.sh).
  MEDIA_INTERNAL_URL: z.string().url(),
  // Service-key partagée avec media (= MEDIA_ENGINE_SERVICE_KEY côté media).
  MEDIA_SERVICE_KEY: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;
let _env: Env | null = null;
function read(): Env {
  if (_env) return _env;
  _env = envSchema.parse(process.env);
  return _env;
}
export const env = new Proxy({} as Env, {
  get(_t, prop) {
    return (read() as unknown as Record<string | symbol, unknown>)[prop];
  },
}) as Env;
