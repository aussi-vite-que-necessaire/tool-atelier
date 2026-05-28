// One-shot manuel : re-mappe l'ancien user.id de cast vers ton nouveau user.id
// côté auth.contentos.ch. Le DROP des tables locales est fait par la migration
// Drizzle au déploiement — ce script ne fait QUE le remap des FK.
//
// Usage (depuis lab via lab-ssh) :
//   docker exec cast-prod-web-1 node scripts/sso-migrate-user.mjs <NEW_USER_ID>
//
// NEW_USER_ID = id de Manu dans la table user de auth.contentos.ch, obtenu après
// login OTP. Exemple :
//   docker exec lab-platform-postgres-1 psql -U postgres -d auth_prod \
//     -c "SELECT id FROM \"user\" WHERE email='manu@avqn.ch';"
//
// IMPORTANT : exécuter AVANT que la migration drizzle 0025 ne drop la table user.
// Donc avant de déployer la PR. Si déjà déployée, la table user est tombée et
// le script ne peut plus lire OLD_ID : il faut récupérer OLD_ID depuis un dump
// ou un backup.

import postgres from 'postgres';

const NEW = process.argv[2];
if (!NEW) {
  console.error('usage: node sso-migrate-user.mjs <NEW_USER_ID>');
  process.exit(1);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL manquant');
  process.exit(1);
}

const sql = postgres(url, { max: 1 });
try {
  // Vérifie qu'il existe encore une table user (i.e., migration 0025 pas encore appliquée).
  const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name='user'`;
  if (tables.length === 0) {
    console.error('Refus : table "user" inexistante. La migration drop a déjà été appliquée — récupérer OLD_ID depuis un backup.');
    process.exit(1);
  }
  const users = await sql`SELECT id, email FROM "user"`;
  if (users.length === 0) {
    console.log('Aucun user local — rien à migrer.');
    process.exit(0);
  }
  if (users.length > 1) {
    console.error(`Refus : ${users.length} users locaux. Adapter le script pour mapping multiple.`);
    process.exit(1);
  }
  const OLD = users[0].id;
  console.log(`Migration OLD=${OLD} (${users[0].email}) → NEW=${NEW}`);

  await sql.begin(async (t) => {
    const tables = [
      'posts',
      'ideas',
      'voice',
      'settings',
      'publications',
      'social_accounts',
      'writing_templates',
    ];
    for (const tbl of tables) {
      const r = await t.unsafe(`UPDATE "${tbl}" SET user_id = $1 WHERE user_id = $2`, [NEW, OLD]);
      console.log(`  ${tbl}: ${r.count} lignes`);
    }
  });
  console.log('Migration FK OK. Le prochain déploiement appliquera le DROP des tables auth locales.');
} catch (e) {
  console.error('Migration failed:', e.message);
  process.exit(1);
} finally {
  await sql.end();
}
