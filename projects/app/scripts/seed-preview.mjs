// Seed de démo (preview uniquement, jamais en prod). Autonome : n'utilise que
// `pg` (dep de prod) + SQL brut, comme migrate.mjs — l'image `web` ne contient
// PAS les sources TS (src/), donc on ne peut pas réutiliser seedDev ici.
// Insère, pour CHAQUE opérateur de preview (preview-op-1, preview-op-2) :
// 1 voix, 1 template d'écriture, 2 posts d'exemple.
// Idempotent (ids préfixés par userId + ON CONFLICT DO NOTHING).
import pg from 'pg';

if (process.env.APP_ENV === 'prod') {
  console.log('seed: APP_ENV=prod → pas de données de démo (refusé).');
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.log('seed: DATABASE_URL absent — rien à faire');
  process.exit(0);
}

const USERS = [
  { id: 'preview-op-1', label: 'User 1' },
  { id: 'preview-op-2', label: 'User 2' },
];

const VOICE_CONTENT = `# Voix éditoriale

Fondateur indépendant qui écrit pour ses pairs. Direct, factuel, tranché.
Première personne. Pas de tiret cadratin, pas de hook teaser, pas de staccato creux.`;

const TEMPLATE_STRUCTURE = `Format : post LinkedIn de 800 à 1500 caractères.
1. Accroche factuelle ou tranchée (1-2 lignes).
2. Développement : une observation, une décision, un point de vue.
3. Closure : ce qu'on en retient, sans répéter l'accroche.`;

const SAMPLE_POSTS = [
  {
    title: 'Documenter avant de coder',
    content:
      'Documenter une spec avant de coder, ça paraît lent. En réalité ça évite trois allers-retours.',
  },
  {
    title: 'Une base de test dédiée',
    content:
      'Mes tests effaçaient ma base de dev à chaque run. Une base de test dédiée a réglé le problème en cinq minutes.',
  },
];

async function seedForUser(client, userId, label) {
  await client.query(
    `INSERT INTO voice (id, user_id, name, content, created_at, updated_at)
     VALUES ($1, $2, 'Voix principale', $3, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [`seed-voice-${userId}`, userId, VOICE_CONTENT],
  );

  await client.query(
    `INSERT INTO writing_templates (id, user_id, name, platform, structure, created_at, updated_at)
     VALUES ($1, $2, 'Post LinkedIn standard', 'linkedin', $3, now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [`seed-tpl-${userId}`, userId, TEMPLATE_STRUCTURE],
  );

  let posts = 0;
  for (let i = 0; i < SAMPLE_POSTS.length; i++) {
    const p = SAMPLE_POSTS[i];
    const res = await client.query(
      `INSERT INTO posts (id, user_id, title, content, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (id) DO NOTHING
       RETURNING id`,
      [`seed-post-${i + 1}-${userId}`, userId, `${p.title} (${label})`, p.content],
    );
    posts += res.rowCount ?? 0;
  }
  console.log(`seed[${userId}]: voix + template assurés, ${posts} posts insérés`);
}

const pool = new pg.Pool({ connectionString: url, max: 1 });
try {
  const client = await pool.connect();
  try {
    for (const u of USERS) {
      await seedForUser(client, u.id, u.label);
    }
  } finally {
    client.release();
  }
  console.log('seed: OK');
} catch (e) {
  console.error('seed: erreur (non bloquante) —', e.message);
  process.exit(0);
} finally {
  await pool.end();
}
