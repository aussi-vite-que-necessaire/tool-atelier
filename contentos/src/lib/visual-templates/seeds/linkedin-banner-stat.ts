import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-banner-stat/index.ts).
// Text-only, split brutaliste : grand chiffre dans la couleur accent à gauche,
// trait noir vertical, titre + sous-texte + signature à droite.
export const linkedinBannerStat: CreateVisualTemplateInput = {
  slug: 'linkedin-banner-stat',
  label: 'LinkedIn — Banner stat (1.91:1)',
  platform: 'linkedin',
  width: 1200,
  height: 627,
  bodyHtml: `<div class="container">
  <div class="left-col">
    <div class="big-number">{{bigNumber}}</div>
  </div>
  <div class="divider"></div>
  <div class="right-col">
    <div class="title">{{title}}</div>
    <div class="subtext">{{subtext}}</div>
    {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
  </div>
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  font-family: 'General Sans', -apple-system, sans-serif;
  display: flex;
  overflow: hidden;
}
.left-col {
  width: 550px;
  height: 100%;
  padding: 64px 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.big-number {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 88px;
  font-weight: 700;
  line-height: 0.94;
  letter-spacing: -0.04em;
  color: {{accent}};
  white-space: nowrap;
  overflow: hidden;
  text-align: center;
  max-width: 100%;
}
.divider {
  width: 2px;
  background: #000;
  align-self: stretch;
}
.right-col {
  flex: 1;
  height: 100%;
  padding: 56px 56px 44px 56px;
  display: flex;
  flex-direction: column;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 52px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.01em;
  word-spacing: 0.08em;
  color: #000;
  white-space: pre-line;
  max-height: 232px;
  overflow: hidden;
}
.subtext {
  margin-top: 28px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 22px;
  font-weight: 400;
  line-height: 1.45;
  color: #000;
  white-space: pre-line;
  max-height: 200px;
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
    {
      name: 'bigNumber',
      label: 'Statistique',
      type: 'string',
      min: 1,
      max: 9,
      description:
        'Court et frappant : signe + unité (-80%, +10h/sem, x3, 4 sem.). Jamais un mot. 8 chars idéal.',
    },
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 20,
      max: 90,
      description: 'Affirmation tranchée, sentence case, qui pose l’angle. Tient sur 4 lignes.',
    },
    {
      name: 'subtext',
      label: 'Sous-texte',
      type: 'string',
      min: 40,
      max: 200,
      description: 'Contextualise la stat (méthode, conditions, durée), sans répéter le chiffre.',
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
      label: 'Couleur du chiffre',
      type: 'color',
      default: '#000000',
      description: 'Couleur du grand chiffre à gauche.',
    },
  ],
  sampleVars: {
    bigNumber: '+10h/sem',
    title: 'Une heure par jour rendue à chaque client grâce aux agents IA.',
    subtext:
      'Tri des emails, relances, comptes-rendus : automatisés avec Claude en 4 semaines de cadrage, sans changer leurs outils.',
    signature: 'AVQN.CH',
    accent: '#1d4ed8',
  },
};
