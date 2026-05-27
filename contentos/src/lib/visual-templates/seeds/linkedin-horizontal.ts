import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-horizontal/index.ts).
// Split brutaliste : image IA edge-to-edge à droite, colonne texte blanche à gauche.
// La carte titre déborde sur l'image (broken layout, shadow 14x14), subtext + signature
// dans le flow de la colonne gauche.
export const linkedinHorizontal: CreateVisualTemplateInput = {
  slug: 'linkedin-horizontal',
  label: 'LinkedIn — Horizontal image à droite (1.91:1)',
  platform: 'linkedin',
  width: 1200,
  height: 627,
  bodyHtml: `<div class="image-col" style="background-image:url('{{image}}')"></div>
<div class="text-col">
  <div class="title-card">
    <div class="title">{{title}}</div>
  </div>
  <div class="subtext">{{subtext}}</div>
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.image-col {
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
}`,
  variablesSchema: [
    { name: 'image', label: 'Image', type: 'image' },
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 20,
      max: 110,
      description:
        "Titre Clash Display 700 sur la carte qui déborde sur l'image. Phrase courte et tranchée, sentence case, 5 à 12 mots. Affirme, ne pose pas de question.",
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
    title: 'Un agent qui bosse pendant que tu dors',
    subtext:
      'Workflow n8n + Claude : les leads entrants sont qualifiés et routés avant ton premier café.',
    signature: 'AVQN.CH',
  },
};
