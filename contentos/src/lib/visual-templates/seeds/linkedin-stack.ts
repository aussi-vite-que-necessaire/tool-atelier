import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-stack/index.ts).
// Text-only, pas d'image IA. Chaîne d'outils brutaliste : fond dot pattern, titre
// Clash Display souligné, description, suite de cards d'outils carrées reliées par un
// trait ondulé SVG, footer outcome + signature optionnels en caps tracking-wide.
export const linkedinStack: CreateVisualTemplateInput = {
  slug: 'linkedin-stack',
  label: 'LinkedIn — Stack (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="title">{{title}}</div>
  <div class="description">{{description}}</div>
  <div class="chain">
    <svg class="chain-wave" width="920" height="220" viewBox="0 0 920 220" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 110 Q 230 -30 460 110 T 920 110" stroke="#000" stroke-width="9" fill="none"/>
    </svg>
    <div class="chain-inner">
      {{#each tools}}
      <div class="tool-card"><span class="tool-label">{{this}}</span></div>
      {{/each}}
    </div>
  </div>
  {{#ifNotEmpty outcome}}<div class="outcome">{{outcome}}</div>{{/ifNotEmpty}}
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  background-image: radial-gradient(#d4d4d8 1.8px, transparent 1.8px);
  background-size: 24px 24px;
  background-position: 0 0;
  color: #000;
  padding: 88px 80px 80px 80px;
  display: flex;
  flex-direction: column;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 68px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.01em;
  word-spacing: 0.06em;
  color: #000;
  padding-bottom: 24px;
  border-bottom: 5px solid #000;
  white-space: pre-line;
  max-height: 165px;
  overflow: hidden;
}
.description {
  margin-top: 56px;
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 48px;
  font-weight: 700;
  line-height: 1.12;
  letter-spacing: -0.005em;
  word-spacing: 0.06em;
  color: #000;
  max-width: 920px;
  white-space: pre-line;
  max-height: 175px;
  overflow: hidden;
}
.chain {
  position: relative;
  margin-top: auto;
  margin-bottom: 60px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.chain-wave {
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  transform: translateY(-50%);
  z-index: 1;
  pointer-events: none;
}
.chain-inner {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: 56px;
}
.tool-card {
  width: 160px;
  height: 160px;
  background: #fff;
  border: 1.5px solid #000;
  box-shadow: 10px 10px 0 #000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  flex-shrink: 0;
}
.tool-card:nth-child(odd) { transform: translateY(42px); }
.tool-card:nth-child(even) { transform: translateY(-42px); }
.tool-label {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 26px;
  font-weight: 700;
  color: #000;
  text-align: center;
  line-height: 1.1;
  letter-spacing: -0.005em;
  word-break: break-word;
}
.outcome {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 26px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #525252;
  line-height: 1.35;
  text-align: center;
  max-width: 880px;
  margin-left: auto;
  margin-right: auto;
  max-height: 90px;
  overflow: hidden;
}
.signature {
  margin-top: 18px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #000;
  text-align: center;
}`,
  variablesSchema: [
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 8,
      max: 50,
      description:
        "Titre court souligné, 2 à 6 mots, sentence case, qui pose le sujet du process (ex Le studio LinkedIn, Tri d'emails). Tient sur 2 lignes max.",
    },
    {
      name: 'description',
      label: 'Description',
      type: 'string',
      min: 30,
      max: 180,
      description:
        "Phrase explicative, 1 à 3 phrases courtes décrivant ce que fait la chaîne d'outils. 3 lignes max. Évite les tirets cadratins.",
    },
    {
      name: 'tools',
      label: 'Outils',
      type: 'list',
      minItems: 3,
      maxItems: 5,
      itemMax: 16,
      description:
        "3 à 5 outils chaînés dans l'ordre du flow (ex Telegram, OpenAI, n8n, LinkedIn). Chaque label tient dans une card carrée : court (1-2 mots). Pas d'emoji ni markdown.",
    },
    {
      name: 'outcome',
      label: 'Résultat (optionnel)',
      type: 'string',
      max: 90,
      optional: true,
      description:
        'Phrase résultat en bas, affichée en CAPITALES tracking-wide. Résume le bénéfice. Vide pour ne rien afficher.',
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
      description:
        'Signature sous le résultat (ex AVQN.CH), capitales tracking-wide. Vide pour ne rien afficher.',
    },
  ],
  sampleVars: {
    title: 'Le studio LinkedIn',
    description:
      "Une note vocale entre, un post calibré sort. L'agent rédige, je valide depuis mon téléphone.",
    tools: ['Telegram', 'Whisper', 'Claude', 'n8n', 'LinkedIn'],
    outcome: 'Un post LinkedIn en 2 minutes, sans ouvrir mon laptop.',
    signature: 'AVQN.CH',
  },
};
