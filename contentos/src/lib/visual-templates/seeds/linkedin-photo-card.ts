import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Carte photo + titre (4:5) : image en haut, bandeau titre en bas.
// Démontre une variable de type image (Spec 7) combinée à du texte.
export const linkedinPhotoCard: CreateVisualTemplateInput = {
  slug: 'linkedin-photo-card',
  label: 'LinkedIn — Photo + titre (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="photo" style="background-image:url('{{photo}}')"></div>
  <div class="banner">
    <div class="title">{{title}}</div>
    {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
  </div>
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}
.photo {
  flex: 1;
  background-size: cover;
  background-position: center;
  background-color: #e5e5e5;
}
.banner {
  background: #000;
  color: #fff;
  padding: 64px 72px 72px 72px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.title {
  font-family: 'Clash Display', -apple-system, sans-serif;
  font-size: 72px;
  font-weight: 700;
  line-height: 1.05;
  letter-spacing: -0.02em;
  white-space: pre-line;
  max-height: 300px;
  overflow: hidden;
}
.signature {
  font-family: 'General Sans', -apple-system, sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: #a3a3a3;
}`,
  variablesSchema: [
    { name: 'photo', label: 'Photo', type: 'image' },
    {
      name: 'title',
      label: 'Titre',
      type: 'string',
      min: 5,
      max: 90,
      description: 'Titre en bas sur le bandeau noir.',
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
    title: 'Le visuel qui fait scroller',
    signature: 'AVQN.CH',
  },
};
