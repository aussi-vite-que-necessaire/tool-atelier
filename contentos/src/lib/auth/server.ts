import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { magicLink, mcp } from 'better-auth/plugins';
import { db } from '@/lib/db/client';
import { seedUserDefaults } from '@/lib/db/seeds/user-defaults';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_URL,
  trustedOrigins: [env.APP_URL],
  plugins: [
    magicLink({
      expiresIn: 600,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: 'Connexion à Contentos',
          html: `<p>Clique ici pour te connecter : <a href="${url}">${url}</a></p><p>Lien valable 10 minutes.</p>`,
        });
      },
    }),
    mcp({
      loginPage: '/signin',
      oidcConfig: {
        loginPage: '/signin',
        allowDynamicClientRegistration: true,
        requirePKCE: true,
      },
    }),
  ],
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser) => {
          await seedUserDefaults(createdUser.id);
        },
      },
    },
  },
});

export type Session = typeof auth.$Infer.Session;
