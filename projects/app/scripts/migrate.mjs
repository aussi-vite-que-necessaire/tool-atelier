// Applique les migrations SQL committées (dossier ./drizzle) à la base.
// Lancé par la plateforme lab dans un conteneur one-shot, AVANT le démarrage de
// l'app, avec DATABASE_URL injecté. N'utilise que drizzle-orm + pg (deps de prod),
// donc fonctionne sans drizzle-kit (devDep). Driver node-postgres, comme l'app
// (src/lib/db/client.ts).
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('migrate: DATABASE_URL manquant');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  console.log('migrate: OK');
} catch (e) {
  console.error('migrate failed:', e.message);
  process.exit(1);
} finally {
  await pool.end();
}
