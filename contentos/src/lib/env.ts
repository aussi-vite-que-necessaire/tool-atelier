import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_URL: z.string().url(),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  RESEND_FROM: z.string().email().optional(),
  LINKEDIN_CLIENT_ID: z.string().optional(),
  LINKEDIN_CLIENT_SECRET: z.string().optional(),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  CONTENT_OS_LINKEDIN_STUB: z.enum(['0', '1']).default('0'),
  CONTENT_OS_MEDIA_STUB: z.enum(['0', '1', 'fs']).default('0'),
  MEDIA_STUB_DIR: z.string().optional(),
  MEDIA_ENGINE_URL: z.string().optional(),
  MEDIA_ENGINE_SERVICE_KEY: z.string().optional(),
  // Version de l'API LinkedIn (YYYYMM). LinkedIn ne garde une version active
  // qu'environ 12 mois ; bumper si "NONEXISTENT_VERSION" au moment de publier.
  LINKEDIN_API_VERSION: z.string().default('202604'),
  E2E_TESTING: z.string().optional(),
  // Injecté par deploy.sh : 'prod' en prod, sinon le slug de branche (preview).
  APP_ENV: z.string().optional(),
});

export const env = envSchema.parse(process.env);
