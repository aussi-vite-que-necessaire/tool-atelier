// Constante pure (sans dépendance serveur) : importable côté client ET serveur.
// Séparée de generate-image.ts qui importe @google/genai + env (serveur only).
export const IMAGE_ASPECT_RATIOS = ['1:1', '4:5', '16:9'] as const;
export type ImageAspectRatio = (typeof IMAGE_ASPECT_RATIOS)[number];
