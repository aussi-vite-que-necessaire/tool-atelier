import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, mcp } from 'better-auth/plugins';
import { isPreview, PREVIEW_OTP } from '@/lib/auth/preview';
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
    emailOTP({
      otpLength: 6,
      expiresIn: 600, // 10 minutes
      // En preview : code déterministe + aucun email (permet l'auto-login).
      // Clé incluse uniquement en preview : passer `generateOTP: undefined`
      // écraserait le générateur par défaut de better-auth (merge `...options`).
      ...(isPreview ? { generateOTP: () => PREVIEW_OTP } : {}),
      sendVerificationOTP: async ({ email, otp }) => {
        if (isPreview) return;
        await sendEmail({
          to: email,
          subject: 'Ton code de connexion à Contentos',
          html: otpEmailHtml(otp),
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

function otpEmailHtml(code: string): string {
  return `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
  <h1 style="font-size:20px;font-weight:700">Ton code de connexion</h1>
  <p>Saisis ce code pour te connecter à Contentos :</p>
  <p style="font-size:32px;font-weight:800;letter-spacing:8px;margin:16px 0">${code}</p>
  <p style="color:#666">Ce code expire dans 10 minutes.</p>
</div>`;
}
