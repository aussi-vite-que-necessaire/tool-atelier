import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";

// Connexion paresseuse : DATABASE_URL injecté au runtime par la plateforme.
type DB = ReturnType<typeof drizzle<typeof schema>>;
let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL manquant");
  _db = drizzle(postgres(connectionString), { schema });
  return _db;
}

export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as DB;
