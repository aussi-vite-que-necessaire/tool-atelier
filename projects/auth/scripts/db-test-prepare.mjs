// Prépare la base de test en CI : crée la base ciblée par DATABASE_URL si absente,
// puis applique les migrations committées (valide aussi qu'elles passent proprement).
// Le projet n'a pas de tests pour l'instant ; cette étape sert de garde-fou
// migrations (idempotence, ordre) avant le déploiement.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("db:test:prepare: DATABASE_URL manquant");
  process.exit(1);
}

const dbName = new URL(url).pathname.replace(/^\//, "");
// Base de maintenance (postgres) pour créer la base de test au besoin.
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";

const admin = postgres(adminUrl.toString(), { max: 1 });
try {
  const exists = await admin`SELECT 1 FROM pg_database WHERE datname = ${dbName}`;
  if (exists.length === 0) {
    await admin.unsafe(`CREATE DATABASE "${dbName}"`);
    console.log(`db:test:prepare: base ${dbName} créée`);
  }
} finally {
  await admin.end();
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("db:test:prepare: migrations appliquées");
} catch (e) {
  console.error("db:test:prepare failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
