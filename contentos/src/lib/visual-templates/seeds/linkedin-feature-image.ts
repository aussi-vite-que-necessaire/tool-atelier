import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-feature-image/index.ts).
// Image IA mise en valeur, encadrée brutaliste (bordure 1.5px + shadow 14x14),
// centrée en haut. Caption sobre en dessous, signature optionnelle en bas.
export const linkedinFeatureImage: CreateVisualTemplateInput = {
  slug: 'linkedin-feature-image',
  label: 'LinkedIn — Image centrée + caption (1.91:1)',
  platform: 'linkedin',
  width: 1200,
  height: 627,
  bodyHtml: `<div class="image-frame" style="background-image:url('{{image}}')"></div>
<div class="caption">{{caption}}</div>
{{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}`,
  css: `.image-frame {
  width: 900px;
  height: 396px;
  border: 1.5px solid #000;
  box-shadow: 14px 14px 0 #000;
  margin: 36px auto 0 auto;
  margin-right: calc(50% - 450px + 14px);
  margin-left: calc(50% - 450px);
  background-size: cover;
  background-position: center;
  background-color: #000;
}
.caption {
  margin: 40px auto 0 auto;
  max-width: 920px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 500;
  line-height: 1.35;
  color: #000;
  text-align: center;
  white-space: pre-line;
  max-height: 56px;
  overflow: hidden;
  padding: 0 96px;
}
.signature {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: 24px;
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #525252;
  text-transform: uppercase;
}`,
  variablesSchema: [
    { name: 'image', label: 'Image', type: 'image' },
    {
      name: 'caption',
      label: 'Légende',
      type: 'string',
      min: 30,
      max: 160,
      description:
        "Légende sobre qui contextualise l'image sans la décrire. General Sans Medium, 2 lignes max. Ton affirmé, sans baratin.",
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
    caption: "Trois mois sans toucher au process. L'agent tourne, je regarde les chiffres monter.",
    signature: 'AVQN.CH',
  },
};
