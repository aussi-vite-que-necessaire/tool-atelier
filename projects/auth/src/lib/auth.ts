import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { isPreview, PREVIEW_OTP } from "@/lib/auth-preview";

const baseURL = process.env.APP_URL ?? "http://localhost:3000";

// Cookie partagé entre les sous-domaines de la suite contentos
// (auth.contentos.ch → .contentos.ch ; auth-<branche>.preview.contentos.ch → .preview.contentos.ch).
function cookieDomain(url: string): string | undefined {
  try {
    const host = new URL(url).hostname;
    if (host === "auth.contentos.ch") return ".contentos.ch";
    if (host.endsWith(".preview.contentos.ch")) return ".preview.contentos.ch";
    return undefined;
  } catch {
    return undefined;
  }
}

const sharedDomain = cookieDomain(baseURL);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [
    baseURL,
    "https://contentos.ch",
    "https://*.contentos.ch",
    "https://*.preview.contentos.ch",
  ],
  ...(sharedDomain
    ? {
        advanced: {
          crossSubDomainCookies: { enabled: true, domain: sharedDomain },
          defaultCookieAttributes: { sameSite: "lax", secure: true },
        },
      }
    : {}),
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      ...(isPreview ? { generateOTP: () => PREVIEW_OTP } : {}),
      async sendVerificationOTP({ email, otp }) {
        if (isPreview) return;
        await sendEmail({
          to: email,
          subject: "Ton code de connexion",
          html: `<p>Ton code : <b>${otp}</b> (expire dans 10 minutes).</p>`,
        });
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
