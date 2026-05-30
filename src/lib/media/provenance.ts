import type { MediaSource } from './types';

// Libellé de provenance affiché sur une vignette de la galerie. Un média n'a plus de
// "kind render" : sa nature visible, c'est son origine, déduite de `source`.
const LABELS: Record<MediaSource, string> = {
  gemini_generate: 'Généré (IA)',
  gemini_edit: 'Édité (IA)',
  template_render: 'Depuis un template',
  html_render: 'Rendu HTML',
  upload: 'Importé',
  pdf_aggregate: 'Assemblé',
};

export function provenanceLabel(source: MediaSource): string {
  return LABELS[source];
}
