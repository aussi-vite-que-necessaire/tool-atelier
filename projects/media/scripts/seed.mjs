// Seed de démo (preview uniquement, jamais en prod).
// Insère pour le PREVIEW_USER_ID ("preview-user") : marque, 2 styles, 1 charte,
// 1 template LinkedIn. Idempotent : ON CONFLICT DO NOTHING.
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.log("seed: DATABASE_URL absent — rien à faire");
  process.exit(0);
}

// L'auth est déléguée au SSO ; en preview, l'app court-circuite avec ce userId
// stable (cf. src/lib/auth/preview.ts).
const USER_ID = "preview-user";

const sql = postgres(url, { max: 1 });

try {
  // --- Marque (PK = user_id désormais) ---
  const brandResult = await sql`
    INSERT INTO brand (user_id, name, signature, logo_url, updated_at)
    VALUES (${USER_ID}, 'AVQN', '— Manu', NULL, now())
    ON CONFLICT (user_id) DO NOTHING
    RETURNING user_id
  `;

  // --- Styles visuels ---
  const stylesResult = await sql`
    INSERT INTO visual_styles (id, user_id, name, prompt, created_at, updated_at)
    VALUES
      (
        'seed-style-3d',
        ${USER_ID},
        '3D doux',
        'Rendu 3D photoréaliste mais doux : éclairage studio diffus, ombres portées légères, formes arrondies et volumes généreux, palette pastel désaturée. Matières lisses ou légèrement texturées, profondeur de champ douce, fond neutre clair.',
        now(), now()
      ),
      (
        'seed-style-flat2d',
        ${USER_ID},
        'Flat 2D',
        'Illustration vectorielle flat 2D : couleurs unies franches sans dégradés, formes géométriques simples, contours nets ou absents. Composition aérée, palette limitée à 4–6 teintes, aucune ombre réaliste.',
        now(), now()
      )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  // --- Charte graphique ---
  const guideResult = await sql`
    INSERT INTO style_guides (id, user_id, name, content, created_at, updated_at)
    VALUES (
      'seed-guide-avqn',
      ${USER_ID},
      'Charte AVQN',
      ${'# Charte AVQN\n\n## Palette\n- `#0A0A0A` — Noir profond (texte, bordures)\n- `#F5F5F0` — Blanc cassé (fond)\n- `#1A1AFF` — Bleu électrique (accent)\n- `#525252` — Gris moyen (signatures, métadonnées)\n\n## Typographie\n- **Titres** : Clash Display 700 — tranchant, espacé\n- **Corps** : General Sans 400 — lisible, neutre\n\n## Ton\nDirect, concis, sans jargon inutile. Affirme plutôt que suggère. Sentence case partout.'},
      now(), now()
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  // --- Template LinkedIn horizontal (porté depuis contentos) ---
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

  const templateResult = await sql`
    INSERT INTO visual_templates
      (id, user_id, slug, label, platform, width, height, body_html, css, variables_schema, sample_vars, style_guide_id, created_at, updated_at)
    VALUES (
      'seed-tpl-linkedin-horizontal',
      ${USER_ID},
      'linkedin-horizontal',
      'LinkedIn — Horizontal image à droite (1.91:1)',
      'linkedin',
      1200,
      627,
      ${templateBodyHtml},
      ${templateCss},
      ${sql.json(variablesSchema)},
      ${sql.json(sampleVars)},
      'seed-guide-avqn',
      now(), now()
    )
    ON CONFLICT (id) DO NOTHING
    RETURNING id
  `;

  // Résumé
  const inserted = (r) => r.length > 0 ? "inséré" : "déjà présent";
  console.log(`seed: marque          → ${inserted(brandResult)}`);
  console.log(`seed: styles visuels  → ${stylesResult.length}/2 insérés`);
  console.log(`seed: charte          → ${inserted(guideResult)}`);
  console.log(`seed: template        → ${inserted(templateResult)}`);
  console.log("seed: OK");
} catch (e) {
  console.error("seed: erreur (non bloquante) —", e.message);
  process.exit(0);
} finally {
  await sql.end();
}
