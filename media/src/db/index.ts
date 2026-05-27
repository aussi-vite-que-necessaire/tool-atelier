import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { schema } from "./schema";

// Connexion paresseuse : DATABASE_URL n'existe qu'au runtime (injecté par la
// plateforme), pas au build. On ne lit l'env et on n'ouvre la connexion qu'au
// premier accès, pour que `next build` n'ait jamais besoin de la base.
type DB = ReturnType<typeof drizzle<typeof schema>>;
let _db: DB | null = null;

function getDb(): DB {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL manquant");
  }
  _db = drizzle(postgres(connectionString), { schema });
  return _db;
}

// Proxy : se comporte comme l'instance drizzle, mais initialise à la demande.
export const db = new Proxy({} as DB, {
  get(_target, prop) {
    const instance = getDb() as unknown as Record<string | symbol, unknown>;
    const value = instance[prop];
    return typeof value === "function" ? value.bind(instance) : value;
  },
}) as DB;
