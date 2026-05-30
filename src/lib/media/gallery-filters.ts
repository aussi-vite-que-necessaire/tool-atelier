import type { MediaKind } from './types';

// Filtres de la galerie, libellés en français. Pas de "render" : un render est une image
// (sa provenance vit dans `source`, affichée en badge).
export interface GalleryFilter {
  kind: MediaKind;
  label: string;
}

export const GALLERY_FILTERS: GalleryFilter[] = [
  { kind: 'image', label: 'Images' },
  { kind: 'video', label: 'Vidéos' },
  { kind: 'pdf', label: 'PDF' },
];
