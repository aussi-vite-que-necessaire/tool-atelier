import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  // Secret de signature des sessions BetterAuth (auth in-app). Requis.
  BETTER_AUTH_SECRET: z.string().min(1),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
  // Module media (in-app). Tous optionnels au boot : l'app démarre sans, et chaque
  // capacité se désactive proprement si son secret manque (cf. src/lib/media/config).
  GEMINI_API_KEY: z.string().optional(),
  BROWSER_URL: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_S3_ENDPOINT: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  R2_PUBLIC_BASE_URL: z.string().optional(),
  // Force le mode dégradé du module media (jamais d'appel R2/Gemini/Chromium).
  CONTENT_OS_MEDIA_STUB: z.enum(['0', '1']).default('0'),
  LINKEDIN_API_VERSION: z.string().default('202604'),
  E2E_TESTING: z.string().optional(),
  // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
  APP_ENV: z.string().optional(),
});

export const env = envSchema.parse(process.env);
