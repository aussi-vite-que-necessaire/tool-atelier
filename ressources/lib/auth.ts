import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import { nextCookies } from "better-auth/next-js"
import { emailOTP, mcp } from "better-auth/plugins"
import { db } from "@/db"
import {
  user,
  session,
  account,
  verification,
  oauthApplication,
  oauthAccessToken,
  oauthConsent,
} from "@/db/schema"
import { sendOtpEmail } from "@/lib/email"

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification, oauthApplication, oauthAccessToken, oauthConsent },
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  session: { expiresIn: 60 * 60 * 24 * 365, updateAge: 60 * 60 * 24 * 30 },
  user: {
    additionalFields: {
      isAdmin: { type: "boolean", input: false, defaultValue: false },
    },
  },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      async sendVerificationOTP({ email, otp }) {
        await sendOtpEmail({ to: email, code: otp })
      },
    }),
    mcp({
      loginPage: "/connexion",
      oidcConfig: {
        loginPage: "/connexion",
        allowDynamicClientRegistration: true,
        consentPage: "/oauth/consent",
      },
    }),
    nextCookies(),
  ],
})
