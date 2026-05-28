import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { emailOTP } from "better-auth/plugins";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { isPreview, PREVIEW_OTP } from "@/lib/auth-preview";

const baseURL = process.env.APP_URL ?? "http://localhost:3000";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
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
