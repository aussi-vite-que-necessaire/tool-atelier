import { z } from "zod";

// Env typé, lecture paresseuse (ne parse pas au build).
const envSchema = z.object({
  APP_URL: z.string().url(),
  AUTH_URL: z.string().url().default("https://auth.contentos.ch"),
  APP_ENV: z.string().optional(),
  // Clé interne partagée présentée aux backends (scope global). Vide en preview :
  // les endpoints /internal des backends court-circuitent la vérif en preview.
  MCP_INTERNAL_KEY: z.string().default(""),
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
