#!/usr/bin/env tsx
import { config as loadEnv } from 'dotenv';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { adminUrl, dbNameFromUrl } from '@/lib/db/admin-url';

loadEnv();
loadEnv({ path: '.env.test', override: true });

async function main(): Promise<void> {
  const target = process.env.DATABASE_URL;
  if (!target) throw new Error('DATABASE_URL manquant');
  const name = dbNameFromUrl(target);

  // 1. Crée la base de test si absente (connexion sur "postgres").
  const admin = new Pool({ connectionString: adminUrl(target) });
  try {
    await admin.query(`CREATE DATABASE ${name}`);
    console.log(`  créé  ${name}`);
  } catch (e) {
    if ((e as { code?: string }).code === '42P04') console.log(`  skip  ${name} (existe déjà)`);
    else throw e;
  } finally {
    await admin.end();
  }

  // 2. Applique les migrations sur la base de test.
  const pool = new Pool({ connectionString: target });
  await migrate(drizzle(pool), { migrationsFolder: './drizzle' });
  await pool.end();
  console.log('  migrations OK');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
