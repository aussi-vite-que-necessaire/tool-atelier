import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-command/index.ts).
// Text-only, pas d'image IA. Zoom sur une commande CLI : grille papier en fond, card
// noire avec la commande en mono massif, sous-titre Clash Display, liste à puces
// carrées qui détaille, astuce optionnelle en bas avec trait noir vertical.
export const linkedinCommand: CreateVisualTemplateInput = {
  slug: 'linkedin-command',
  label: 'LinkedIn — Command (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="command-card">
    <span class="command-prompt">&gt;</span>
    <span class="command-text">{{command}}</span>
  </div>
  <h2 class="subtitle">{{subtitle}}</h2>
  <ul class="items">
    {{#each items}}
    <li class="item">{{this}}</li>
    {{/each}}
  </ul>
  {{#ifNotEmpty tip}}
  <aside class="tip-block">
    <div class="tip-label">Astuce</div>
    <div class="tip-text">{{tip}}</div>
  </aside>
  {{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  background-image:
    linear-gradient(#e7e5e4 1px, transparent 1px),
    linear-gradient(90deg, #e7e5e4 1px, transparent 1px);
  background-size: 40px 40px;
  background-position: -1px -1px;
  color: #000;
  padding: 96px 80px 96px 80px;
  display: flex;
  flex-direction: column;
}
.command-card {
  background: #000;
  border: 1.5px solid #000;
  box-shadow: 16px 16px 0 #d4d4d8;
  padding: 48px 40px 52px 40px;
  display: flex;
  align-items: baseline;
  gap: 18px;
  overflow: hidden;
}
.command-prompt {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 36px;
  font-weight: 400;
  color: #737373;
  flex-shrink: 0;
  line-height: 1;
}
.command-text {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 56px;
  font-weight: 700;
  color: #fff;
  letter-spacing: -0.01em;
  line-height: 1.15;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: anywhere;
}
.subtitle {
  margin-top: 64px;
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 48px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: 0;
  word-spacing: 0.08em;
  color: #000;
  max-width: 900px;
  white-space: pre-line;
  max-height: 170px;
  overflow: hidden;
}
.items {
  margin-top: 44px;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.item {
  position: relative;
  padding-left: 44px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 36px;
  font-weight: 500;
  line-height: 1.35;
  color: #000;
  max-width: 900px;
}
.item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0.42em;
  width: 18px;
  height: 18px;
  background: #000;
}
.tip-block {
  margin-top: auto;
  padding: 4px 0 4px 32px;
  border-left: 6px solid #000;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.tip-label {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 18px;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #525252;
}
.tip-text {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 28px;
  font-weight: 500;
  line-height: 1.4;
  color: #000;
  white-space: pre-line;
  max-height: 200px;
  overflow: hidden;
}`,
  variablesSchema: [
    {
      name: 'command',
      label: 'Commande',
      type: 'string',
      min: 2,
      max: 80,
      description:
        "La commande à mettre en avant, telle qu'on la taperait (ex /deploy, gh pr create, claude --agent X). Court et percutant, peut wrapper sur 2-3 lignes.",
    },
    {
      name: 'subtitle',
      label: 'Sous-titre',
      type: 'string',
      min: 20,
      max: 180,
      description:
        'Sous-titre éditorial qui contextualise la commande en 1 à 3 phrases courtes. Affirmatif, sentence case. 3 lignes max.',
    },
    {
      name: 'items',
      label: 'Points clés',
      type: 'list',
      minItems: 2,
      maxItems: 4,
      itemMax: 110,
      description:
        "2 à 4 points clés sur la commande : ce qu'elle fait, les pièges évités, les combos utiles. Phrases courtes type bullet, sans redondance avec le sous-titre.",
    },
    {
      name: 'tip',
      label: 'Astuce (optionnel)',
      type: 'string',
      max: 200,
      optional: true,
      description:
        'Astuce non triviale : flag utile, piège évité, combo, comportement caché. 1 à 2 phrases. Vide si rien à dire.',
    },
  ],
  sampleVars: {
    command: 'claude --agent ghostwriter --resume',
    subtitle: "Je relance mon agent rédacteur là où je l'avais laissé, contexte intact.",
    items: [
      'Reprend le dernier thread sans re-coller le brief.',
      'Garde la voix et les contraintes de marque en mémoire.',
      'Combine avec --print pour pousser direct en brouillon.',
    ],
    tip: "Ajoute --verbose pour voir les appels d'outils : pratique quand un agent boucle.",
  },
};
