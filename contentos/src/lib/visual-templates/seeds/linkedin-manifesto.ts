import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-manifesto/index.ts).
// Text-only, citation manifesto.
export const linkedinManifesto: CreateVisualTemplateInput = {
  slug: 'linkedin-manifesto',
  label: 'LinkedIn — Manifesto / Quote (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="quote-mark">&ldquo;</div>
  <div class="quote">{{quote}}</div>
  <div class="spacer"></div>
  {{#ifNotEmpty author}}
  <div class="attribution">
    <div class="author">{{author}}</div>
    {{#ifNotEmpty role}}<div class="role">{{role}}</div>{{/ifNotEmpty}}
  </div>
  {{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  padding: 96px 88px 0 88px;
  display: flex;
  flex-direction: column;
  position: relative;
}
.quote-mark {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 280px;
  font-weight: 700;
  color: #000;
  line-height: 0.7;
  margin-bottom: 16px;
  margin-left: -8px;
  height: 200px;
  overflow: hidden;
}
.quote {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 80px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.005em;
  max-width: 920px;
  white-space: pre-line;
  max-height: 510px;
  overflow: hidden;
}
.spacer { flex: 1; min-height: 40px; }
.attribution {
  background: #000;
  color: #fff;
  margin: 0 -88px;
  padding: 44px 88px 56px 88px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.author {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 38px;
  font-weight: 700;
  line-height: 1.15;
  color: #fff;
}
.role {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1.3;
  color: #a3a3a3;
  text-transform: uppercase;
}`,
  variablesSchema: [
    {
      name: 'quote',
      label: 'Citation',
      type: 'string',
      min: 30,
      max: 220,
      description: 'Affirmation tranchée, sentence case, sans guillemets (le visuel les ajoute).',
    },
    {
      name: 'author',
      label: 'Auteur (optionnel)',
      type: 'string',
      max: 50,
      optional: true,
    },
    {
      name: 'role',
      label: 'Rôle (optionnel)',
      type: 'string',
      max: 60,
      optional: true,
    },
  ],
  sampleVars: {
    quote: 'On ne livre pas une feature, on livre un effet sur la vie du user.',
    author: 'Manu AVQN',
    role: 'AUTOMATISATION IA — AVQN',
  },
};
