import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import { schema } from "@/db/schema";

// Instance serveur BetterAuth.
// - DATABASE_URL : via l'adaptateur Drizzle (db).
// - BETTER_AUTH_SECRET : signe les sessions/cookies — OBLIGATOIRE au runtime.
// - BETTER_AUTH_URL : URL publique de l'app (ex. https://<projet>.lab.avqn.ch).
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
});
