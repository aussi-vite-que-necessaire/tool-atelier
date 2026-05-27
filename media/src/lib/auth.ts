import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink, mcp } from "better-auth/plugins";
import { db } from "@/db";
import { schema } from "@/db/schema";
import { sendEmail } from "@/lib/email";

// URL publique dérivée de l'environnement de déploiement (APP_ENV injecté par deploy.sh) :
// prod → media.lab.avqn.ch ; preview → media-<branche>.lab.avqn.ch. Indispensable pour que
// l'OAuth/magic-link émette des URLs absolues correctes sur chaque environnement.
const APP_ENV = process.env.APP_ENV ?? "dev";
const baseURL =
  process.env.BETTER_AUTH_URL ??
  (APP_ENV === "prod" ? "https://media.lab.avqn.ch" : `https://media-${APP_ENV}.lab.avqn.ch`);

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL,
  trustedOrigins: [baseURL],
  plugins: [
    magicLink({
      expiresIn: 600,
      sendMagicLink: async ({ email, url }) => {
        await sendEmail({
          to: email,
          subject: "Connexion à media",
          html: `<p>Connexion : <a href="${url}">${url}</a></p><p>Lien valable 10 minutes.</p>`,
        });
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
