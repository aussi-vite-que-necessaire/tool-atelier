// Backfill one-shot du passage single-tenant → multi-tenant (ADR-0002).
// À lancer UNE FOIS sur la prod au cutover, APRÈS la migration de schéma 0004
// (qui ajoute resources.operator_id). Idempotent : ré-exécutable sans dégât.
//
// Pourquoi un script séparé et pas la migration drizzle : `ALTER TABLE resources
// ADD COLUMN operator_id NOT NULL` échoue sur une table peuplée tant que les
// lignes existantes n'ont pas de valeur, et le SQL pur ne connaît pas l'id de
// l'ancien admin. La preview part d'une base vide seedée → non concernée.
//
// En pratique, sur prod, jouer dans cet ordre au cutover :
//   1) appliquer 0004 en variante "nullable" (ou créer operators + la colonne
//      nullable à la main), 2) ce script (crée l'opérateur + backfille), puis
//   3) poser la contrainte NOT NULL. Voir CLAUDE.md (section migration).
//
// Variables : DATABASE_URL, SEED_OPERATOR_USER_ID (ancien ADMIN_USER_IDS),
// SEED_OPERATOR_HANDLE, SEED_OPERATOR_NAME.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
const userId = process.env.SEED_OPERATOR_USER_ID;
const handle = process.env.SEED_OPERATOR_HANDLE;
const name = process.env.SEED_OPERATOR_NAME ?? handle;

if (!url || !userId || !handle) {
  console.error(
    "backfill-operators: DATABASE_URL, SEED_OPERATOR_USER_ID et SEED_OPERATOR_HANDLE requis",
  );
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  // 1) upsert l'opérateur
  await sql`
    INSERT INTO operators (id, handle, name)
    VALUES (${userId}, ${handle}, ${name})
    ON CONFLICT (id) DO UPDATE SET handle = EXCLUDED.handle, name = EXCLUDED.name
  `;

  // 2) rattacher les ressources orphelines
  const res = await sql`
    UPDATE resources SET operator_id = ${userId} WHERE operator_id IS NULL
  `;
  console.log(`backfill-operators: ${res.count} ressource(s) rattachée(s)`);

  // 3) peupler audience_members depuis les abonnements existants (distinct user)
  const aud = await sql`
    INSERT INTO audience_members (operator_id, user_id)
    SELECT DISTINCT r.operator_id, s.user_id
    FROM subscriptions s
    JOIN resources r ON r.id = s.resource_id
    ON CONFLICT (operator_id, user_id) DO NOTHING
  `;
  console.log(`backfill-operators: ${aud.count} membre(s) d'audience rattaché(s)`);
  console.log("backfill-operators: OK");
} catch (e) {
  console.error("backfill-operators failed:", e.message);
  process.exit(1);
} finally {
  await sql.end();
}
