import { defineConfig } from "drizzle-kit";

// Utilisé par `drizzle-kit generate` (création des migrations SQL au dev).
// L'application des migrations en prod se fait via scripts/migrate.mjs.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});
