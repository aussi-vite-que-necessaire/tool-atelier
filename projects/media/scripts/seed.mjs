// Seed de démo (preview uniquement, jamais en prod).
// Insère pour CHAQUE opérateur de preview (preview-op-1, preview-op-2) : marque,
// 2 styles, 1 charte, 1 template LinkedIn. Idempotent : ON CONFLICT DO NOTHING.
// Ids de seed préfixés par userId pour éviter les collisions de PK entre users.
import postgres from "postgres";

if (process.env.APP_ENV === "prod") {
  console.log("seed: APP_ENV=prod → pas de données de démo (refusé).");
  process.exit(0);
}
const url = process.env.DATABASE_URL;
if (!url) {
  console.log("seed: DATABASE_URL absent — rien à faire");
  process.exit(0);
}

// Opérateurs de preview (ids alignés avec le seed auth + les autres clients).
const USERS = [
  { id: "preview-op-1", label: "User 1" },
  { id: "preview-op-2", label: "User 2" },
];

// ── Constantes partagées (identiques pour chaque user, seul l'id varie) ──
const templateBodyHtml = `<div class="image-col" style="background-image:url('{{image}}')"></div>
<div class="text-col">
  <div class="title-card">
    <div class="title">{{title}}</div>
  </div>
  <div class="subtext">{{subtext}}</div>
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`;

const templateCss = `.image-col {
  position: absolute;
  top: 0;
  right: 0;
  width: 600px;
  height: 627px;
  z-index: 1;
  background-size: cover;
  background-position: center;
  background-color: #000;
}
.text-col {
  position: relative;
  width: 600px;
  height: 627px;
  padding: 56px 48px 44px 48px;
  display: flex;
  flex-direction: column;
  z-index: 2;
  overflow: visible;
}
.title-card {
  width: 700px;
  background: #fff;
  border: 1.5px solid #000;
  box-shadow: 14px 14px 0 #000;
  padding: 26px 32px 30px 32px;
  position: relative;
  z-index: 3;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 54px;
  font-weight: 700;
  letter-spacing: 0;
  word-spacing: 0.12em;
  line-height: 1.04;
  color: #000;
  white-space: pre-line;
  max-height: 230px;
  overflow: hidden;
}
.subtext {
  margin-top: 40px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 21px;
  font-weight: 400;
  line-height: 1.45;
  color: #000;
  max-width: 484px;
  white-space: pre-line;
  max-height: 180px;
  overflow: hidden;
}
.signature {
  margin-top: auto;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #525252;
  text-transform: uppercase;
}`;

const variablesSchema = [
  { name: "image", label: "Image", type: "image" },
  {
    name: "title",
    label: "Titre",
    type: "string",
    min: 20,
    max: 110,
    description:
      "Titre Clash Display 700 sur la carte qui déborde sur l'image. Phrase courte et tranchée, sentence case, 5 à 12 mots. Affirme, ne pose pas de question.",
  },
  {
    name: "subtext",
    label: "Sous-texte",
    type: "string",
    min: 30,
    max: 200,
    description:
      "Une à deux phrases qui prolongent l'affirmation. Ton sobre, sans répéter le titre.",
  },
  {
    name: "signature",
    label: "Signature (optionnel)",
    type: "string",
    max: 30,
    optional: true,
    description: 'Capitales tracking-wide (ex "AVQN.CH"). Vide pour ne rien afficher.',
  },
];

const sampleVars = {
  title: "Un agent qui bosse pendant que tu dors",
  subtext:
    "Workflow n8n + Claude : les leads entrants sont qualifiés et routés avant ton premier café.",
  signature: "AVQN.CH",
};

const guideContent =
  "# Charte AVQN\n\n## Palette\n- `#0A0A0A` — Noir profond (texte, bordures)\n- `#F5F5F0` — Blanc cassé (fond)\n- `#1A1AFF` — Bleu électrique (accent)\n- `#525252` — Gris moyen (signatures, métadonnées)\n\n## Typographie\n- **Titres** : Clash Display 700 — tranchant, espacé\n- **Corps** : General Sans 400 — lisible, neutre\n\n## Ton\nDirect, concis, sans jargon inutile. Affirme plutôt que suggère. Sentence case partout.";

async function seedForUser(sql, userId, label) {
  const guideId = `seed-guide-avqn-${userId}`;

  const brandResult = await sql`
    INSERT INTO brand (user_id, name, signature, logo_url, updated_at)
    VALUES (${userId}, ${`AVQN (${label})`}, ${`— ${label}`}, NULL, now())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  `;

  const stylesResult = await sql`
    INSERT INTO visual_styles (id, user_id, name, prompt, created_at, updated_at)
    VALUES
      (
        ${`seed-style-3d-${userId}`},
        ${userId},
        '3D doux',
        'Rendu 3D photoréaliste mais doux : éclairage studio diffus, ombres portées légères, formes arrondies et volumes généreux, palette pastel désaturée. Matières lisses ou légèrement texturées, profondeur de champ douce, fond neutre clair.',
        now(), now()
      ),
      (
        ${`seed-style-flat2d-${userId}`},
        ${userId},
        'Flat 2D',
        'Illustration vectorielle flat 2D : couleurs unies franches sans dégradés, formes géométriques simples, contours nets ou absents. Composition aérée, palette limitée à 4–6 teintes, aucune ombre réaliste.',
        now(), now()
      )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  const guideResult = await sql`
    INSERT INTO style_guides (id, user_id, name, content, created_at, updated_at)
    VALUES (${guideId}, ${userId}, 'Charte AVQN', ${guideContent}, now(), now())
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  const templateResult = await sql`
    INSERT INTO visual_templates
      (id, user_id, slug, label, platform, width, height, body_html, css, variables_schema, sample_vars, style_guide_id, created_at, updated_at)
    VALUES (
      ${`seed-tpl-linkedin-horizontal-${userId}`},
      ${userId},
      'linkedin-horizontal',
      'LinkedIn — Horizontal image à droite (1.91:1)',
      'linkedin',
      1200,
      627,
      ${templateBodyHtml},
      ${templateCss},
      ${sql.json(variablesSchema)},
      ${sql.json(sampleVars)},
      ${guideId},
      now(), now()
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  const inserted = (r) => (r.length > 0 ? "inséré" : "déjà présent");
  console.log(`seed[${userId}]: marque ${inserted(brandResult)} | styles ${stylesResult.length}/2 | charte ${inserted(guideResult)} | template ${inserted(templateResult)}`);
}

const sql = postgres(url, { max: 1 });
try {
  for (const u of USERS) {
    await seedForUser(sql, u.id, u.label);
  }
  console.log("seed: OK");
} catch (e) {
  console.error("seed: erreur (non bloquante) —", e.message);
  process.exit(0);
} finally {
  await sql.end();
}
