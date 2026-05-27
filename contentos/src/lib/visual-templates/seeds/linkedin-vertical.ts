import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-vertical/index.ts).
// Image IA edge-to-edge sur la moitié haute, carte titre blanche brutaliste qui
// mord le bas de l'image (broken layout, shadow 18x18), subtext + signature en bas.
export const linkedinVertical: CreateVisualTemplateInput = {
  slug: 'linkedin-vertical',
  label: 'LinkedIn — Vertical avec image (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="image-band" style="background-image:url('{{image}}')"></div>
<div class="title-card">
  <div class="title">{{title}}</div>
</div>
<div class="subtext-block">
  <div class="subtext">{{subtext}}</div>
</div>
{{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}`,
  css: `.image-band {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 800px;
  z-index: 1;
  background-size: cover;
  background-position: center;
  background-color: #000;
}
.title-card {
  position: absolute;
  top: 620px;
  left: 64px;
  width: 952px;
  background: #fff;
  border: 1.5px solid #000;
  box-shadow: 18px 18px 0 #000;
  padding: 44px 48px 50px 48px;
  z-index: 3;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 74px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: 0;
  word-spacing: 0.12em;
  color: #000;
  white-space: pre-line;
  max-height: 320px;
  overflow: hidden;
}
.subtext-block {
  position: absolute;
  left: 64px;
  right: 64px;
  top: 1090px;
  z-index: 2;
}
.subtext {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 28px;
  font-weight: 400;
  line-height: 1.42;
  color: #000;
  max-width: 880px;
  white-space: pre-line;
  max-height: 165px;
  overflow: hidden;
}
.signature {
  position: absolute;
  left: 64px;
  bottom: 56px;
  z-index: 2;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.18em;
  color: #525252;
  text-transform: uppercase;
}`,
  variablesSchema: [
    { name: 'image', label: 'Image', type: 'image' },
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 20,
      max: 130,
      description:
        'Titre principal sur la carte blanche. Clash Display Bold, 4 lignes max, sentence case, 5 à 14 mots. Affirme une thèse, ne pose pas de question.',
    },
    {
      name: 'subtext',
      label: 'Sous-texte',
      type: 'string',
      min: 30,
      max: 200,
      description:
        "Une à deux phrases qui prolongent l'affirmation. Ton sobre, sans répéter le titre.",
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
      description: 'Capitales tracking-wide (ex "AVQN.CH"). Vide pour ne rien afficher.',
    },
  ],
  sampleVars: {
    title: "L'automatisation ne remplace pas ton métier, elle te rend les heures",
    subtext:
      'Un agent Claude qui trie, route et répond. Tu gardes les décisions, lui prend la charge mentale.',
    signature: 'AVQN.CH',
  },
};
