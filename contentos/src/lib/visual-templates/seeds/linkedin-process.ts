import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-process/index.ts).
// Text-only, pas d'image IA. Workflow brutaliste : titre souligné haut-gauche,
// rangée de cards carrées noires bordées reliées par un trait ondulé SVG, signature
// optionnelle en bas.
export const linkedinProcess: CreateVisualTemplateInput = {
  slug: 'linkedin-process',
  label: 'LinkedIn — Process (1.91:1)',
  platform: 'linkedin',
  width: 1200,
  height: 627,
  bodyHtml: `<div class="container">
  <div class="title">{{title}}</div>
  <svg class="wavy" width="1200" height="627" viewBox="0 0 1200 627" aria-hidden="true" preserveAspectRatio="none">
    <path d="M96 360 Q 348 332 600 360 T 1104 360" stroke="#000" stroke-width="6" fill="none" stroke-linecap="square"/>
  </svg>
  <div class="cards">
    {{#each steps}}
    <div class="step-card"><span class="step-label">{{this}}</span></div>
    {{/each}}
  </div>
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  position: relative;
  overflow: hidden;
  padding: 88px 96px 56px 96px;
}
.title {
  display: inline-block;
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 44px;
  font-weight: 700;
  line-height: 1.06;
  letter-spacing: -0.01em;
  color: #000;
  border-bottom: 4px solid #000;
  padding-bottom: 12px;
  max-width: 100%;
}
.wavy {
  position: absolute;
  inset: 0;
  z-index: 1;
  pointer-events: none;
}
.cards {
  position: absolute;
  left: 96px;
  right: 96px;
  top: 290px;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.step-card {
  width: 140px;
  height: 140px;
  background: #fff;
  border: 1.5px solid #000;
  box-shadow: 8px 8px 0 #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  flex-shrink: 0;
}
.step-label {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 19px;
  font-weight: 600;
  line-height: 1.15;
  text-align: center;
  color: #000;
  word-break: break-word;
}
.signature {
  position: absolute;
  left: 96px;
  bottom: 56px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 17px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #525252;
  text-transform: uppercase;
  z-index: 3;
}`,
  variablesSchema: [
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 20,
      max: 80,
      description:
        'Titre haut-gauche, sentence case, souligné brutaliste. Affirmation courte qui nomme le process ou son résultat. 5 à 10 mots.',
    },
    {
      name: 'steps',
      label: 'Étapes',
      type: 'list',
      minItems: 3,
      maxItems: 5,
      itemMax: 20,
      description:
        "Étapes du workflow dans l'ordre. Noms courts d'outils ou d'étapes (1 à 2 mots), capitalisation préservée (ex : Telegram, OpenAI, n8n, Email). Affichés dans des cards reliées par un trait ondulé.",
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
      description:
        'Signature en bas, capitales tracking-wide (ex AVQN.CH). Vide pour ne rien afficher.',
    },
  ],
  sampleVars: {
    title: 'Du message vocal au post LinkedIn, sans toucher le clavier',
    steps: ['Telegram', 'Whisper', 'Claude', 'n8n', 'LinkedIn'],
    signature: 'AVQN.CH',
  },
};
