// Seed preview uniquement (jamais prod). Insère les 3 users de test de la suite.
// Valeurs à garder EN PHASE avec src/lib/preview-users.ts (pas d'import : JS pur).
import postgres from "postgres";

const appEnv = process.env.APP_ENV;
if (appEnv === "prod") {
  console.log("seed: APP_ENV=prod → aucun user de test (refusé).");
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("seed: DATABASE_URL absent — rien à faire");
  process.exit(0);
}

const USERS = [
  { id: "preview-op-1", email: "user1@avqn.ch", name: "User 1 (preview)", accountType: "operator" },
  { id: "preview-op-2", email: "user2@avqn.ch", name: "User 2 (preview)", accountType: "operator" },
  { id: "preview-aud-3", email: "user3@avqn.ch", name: "User 3 (preview)", accountType: "audience" },
];

const sql = postgres(url, { max: 1 });
try {
  for (const u of USERS) {
    await sql`
      INSERT INTO "user" (id, name, email, email_verified, account_type, created_at, updated_at)
      VALUES (${u.id}, ${u.name}, ${u.email}, true, ${u.accountType}, now(), now())
      ON CONFLICT (id) DO UPDATE
        SET email = EXCLUDED.email, name = EXCLUDED.name,
            email_verified = true, account_type = EXCLUDED.account_type, updated_at = now()
    `;
  }
  console.log(`seed: ${USERS.length} users de preview assurés (op1, op2, aud3).`);
} catch (e) {
  console.error("seed: erreur —", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
