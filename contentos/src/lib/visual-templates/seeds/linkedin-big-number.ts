import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-big-number/index.ts).
// Text-only, pas d'image IA.
export const linkedinBigNumber: CreateVisualTemplateInput = {
  slug: 'linkedin-big-number',
  label: 'LinkedIn — Big number (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="big-number">{{bigNumber}}</div>
  <div class="underline"></div>
  <div class="context">{{context}}</div>
  <div class="arrow-block">
    {{#ifNotEmpty subtitle}}
    <svg class="arrow" width="560" height="120" viewBox="0 0 560 120" fill="none" aria-hidden="true">
      <path d="M0 60h470M440 18l80 42-80 42" stroke="#000" stroke-width="22" stroke-linecap="square" stroke-linejoin="miter"/>
    </svg>
    {{/ifNotEmpty}}
  </div>
  {{#ifNotEmpty subtitle}}<div class="subtitle">{{subtitle}}</div>{{/ifNotEmpty}}
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  padding: 110px 96px 96px 96px;
  display: flex;
  flex-direction: column;
}
.big-number {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 168px;
  font-weight: 700;
  line-height: 0.94;
  letter-spacing: -0.035em;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
}
.underline {
  width: 480px;
  height: 14px;
  background: #000;
  margin-top: 40px;
  margin-bottom: 60px;
}
.context {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 64px;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.01em;
  max-width: 820px;
  white-space: pre-line;
  max-height: 215px;
  overflow: hidden;
}
.arrow-block { margin-top: auto; margin-bottom: 56px; }
.arrow { display: block; }
.subtitle {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 34px;
  font-weight: 500;
  line-height: 1.32;
  max-width: 820px;
  white-space: pre-line;
  max-height: 95px;
  overflow: hidden;
  margin-bottom: 28px;
}
.signature {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #525252;
}`,
  variablesSchema: [
    {
      name: 'bigNumber',
      label: 'Statistique',
      type: 'string',
      min: 1,
      max: 8,
      description:
        'Court et frappant : un chiffre + son unité (+10h/sem, -80%, x3, 4 sem.). 8 chars max.',
    },
    {
      name: 'context',
      label: 'Contexte',
      type: 'string',
      min: 20,
      max: 90,
      description: 'Phrase courte qui explique la stat, sans répéter le chiffre.',
    },
    {
      name: 'subtitle',
      label: 'Sous-titre (optionnel)',
      type: 'string',
      max: 140,
      optional: true,
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
    },
  ],
  sampleVars: {
    bigNumber: '+10h/sem',
    context: 'Gagnées par client en automatisant le tri des emails.',
    subtitle: 'Méthode : agent Claude + règles Gmail. 4 semaines de cadrage.',
    signature: 'AVQN.CH',
  },
};
