import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-poster/index.ts).
// Text-only, affiche manifesto : énorme titre Clash Display, trait souligné dans
// la couleur accent, sous-titre, signature absolue en bas à droite. Pas d'image.
export const linkedinPoster: CreateVisualTemplateInput = {
  slug: 'linkedin-poster',
  label: 'LinkedIn — Poster (1.91:1)',
  platform: 'linkedin',
  width: 1200,
  height: 627,
  bodyHtml: `<div class="container">
  <div class="title-wrap">
    <div class="title">{{title}}</div>
    <div class="underline"></div>
  </div>
  <div class="subtitle">{{subtitle}}</div>
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  font-family: 'General Sans', -apple-system, sans-serif;
  padding: 88px 96px;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.title-wrap {
  max-width: 850px;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 76px;
  font-weight: 700;
  line-height: 0.98;
  letter-spacing: -0.025em;
  color: #000;
  white-space: pre-line;
  max-height: 232px;
  overflow: hidden;
}
.underline {
  height: 6px;
  background: {{accent}};
  margin-top: 24px;
  width: 100%;
}
.subtitle {
  margin-top: 32px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 24px;
  font-weight: 400;
  line-height: 1.4;
  color: #000;
  max-width: 850px;
  white-space: pre-line;
  max-height: 70px;
  overflow: hidden;
}
.signature {
  position: absolute;
  right: 96px;
  bottom: 56px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #525252;
  text-transform: uppercase;
}`,
  variablesSchema: [
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 30,
      max: 90,
      description:
        'Énorme titre manifesto, sentence case. 2 à 3 lignes (8 à 14 mots). Pas de question.',
    },
    {
      name: 'subtitle',
      label: 'Sous-titre',
      type: 'string',
      min: 40,
      max: 180,
      description: 'Prolonge ou nuance l’affirmation, ton sobre, sans répéter le titre.',
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
    },
    {
      name: 'accent',
      label: 'Couleur du trait',
      type: 'color',
      default: '#000000',
      description: 'Couleur du trait souligné sous le titre.',
    },
  ],
  sampleVars: {
    title: 'Pas un problème d’outils, un problème de process.',
    subtitle:
      'Avant d’automatiser quoi que ce soit, on cartographie. Un agent IA sur un process flou ne fait qu’accélérer le chaos.',
    signature: 'AVQN.CH',
    accent: '#1d4ed8',
  },
};
