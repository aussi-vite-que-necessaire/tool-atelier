import { z } from "zod"

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  // URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
  // En preview, isPreview court-circuite tout fetch vers auth.
  AUTH_URL: z.string().url().default("https://auth.contentos.ch"),
  // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
  APP_ENV: z.string().optional(),
})

export const env = envSchema.parse(process.env)
