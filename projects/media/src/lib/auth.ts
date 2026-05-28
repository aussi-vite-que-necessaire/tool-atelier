import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP, mcp } from "better-auth/plugins";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { sendOtpEmail } from "@/lib/email";

// URL publique dérivée de l'environnement de déploiement (APP_ENV injecté par deploy.sh) :
// prod → media.contentos.ch ; preview → media-<branche>.preview.contentos.ch. Indispensable
// pour que l'OAuth émette des URLs absolues correctes sur chaque environnement.
const APP_ENV = process.env.APP_ENV ?? "dev";
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (APP_ENV === "prod"
    ? "https://media.contentos.ch"
    : `https://media-${APP_ENV}.preview.contentos.ch`);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail({ to: email, code: otp });
      },
    }),
    mcp({
      loginPage: "/sign-in",
      oidcConfig: {
        loginPage: "/sign-in",
        allowDynamicClientRegistration: true,
        requirePKCE: true,
      },
    }),
  ],
});
