// Applique les migrations SQL committées (dossier ./drizzle) à la base.
// Lancé par la plateforme dans un conteneur one-shot, AVANT le démarrage de l'app,
// avec DATABASE_URL injecté. N'utilise que drizzle-orm + postgres (deps de prod),
// donc fonctionne dans l'image standalone slim — pas besoin de drizzle-kit.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("migrate: DATABASE_URL manquant");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("migrate: OK");
} catch (e) {
  console.error("migrate failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
