import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // URL du provider d'auth de la suite contentos. Défaut prod = auth.contentos.ch.
  // En preview, isPreview court-circuite tout fetch vers auth.
  AUTH_URL: z.string().url().default('https://auth.contentos.ch'),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
  // URL du service media de la suite contentos. Défaut prod = media.contentos.ch
  // (origine publique, cert valide), surchargeable par env pour le dev local.
  MEDIA_ENGINE_URL: z.string().url().default('https://media.contentos.ch'),
  MEDIA_ENGINE_SERVICE_KEY: z.string().optional(),
  LINKEDIN_API_VERSION: z.string().default('202604'),
  E2E_TESTING: z.string().optional(),
  // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
  APP_ENV: z.string().optional(),
});

export const env = envSchema.parse(process.env);
