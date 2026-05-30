import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { sendEmail } from '@/lib/email';
import { env } from '@/lib/env';

// Instance serveur BetterAuth, intégrée in-app : même base, même session, une
// seule origine (env.APP_URL). Pas de SSO cross-subdomain ni de provider OIDC —
// la suite est une app unique, sans client externe.
export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_URL,
  trustedOrigins: [
    env.APP_URL,
    'https://contentos.ch',
    'https://*.contentos.ch',
    'https://*.preview.contentos.ch',
  ],
  emailAndPassword: {
    enabled: true,
    // Inscription self-serve : la création de compte ouvre la session dans la foulée.
    autoSignIn: true,
    async sendResetPassword({ user, url }) {
      await sendEmail({
        to: user.email,
        subject: 'Réinitialiser ton mot de passe',
        html: `<p>Réinitialise ton mot de passe : <a href="${url}">${url}</a></p>`,
      });
    },
  },
  // Rôle de l'opérateur dans la suite. input:false → un client ne peut pas se
  // l'attribuer à l'inscription/update ; l'octroi est un acte d'administration.
  user: {
    additionalFields: {
      role: {
        type: 'string',
        required: false,
        defaultValue: 'operator',
        input: false,
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
