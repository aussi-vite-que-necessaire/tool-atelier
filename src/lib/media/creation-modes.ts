// Modes de création proposés par le lanceur « Ajouter un élément ». Le lanceur ne contient
// pas de formulaire : il redirige vers la sous-partie de création correspondante.
export type CreationModeId = 'generate' | 'import' | 'template' | 'assemble';

export interface CreationMode {
  id: CreationModeId;
  label: string;
  description: string;
  href: string;
  requiresGemini: boolean;
}

export const CREATION_MODES: CreationMode[] = [
  {
    id: 'generate',
    label: 'Générer (IA)',
    description: 'Décris une image, Gemini la crée.',
    href: '/media/gallery/generate',
    requiresGemini: true,
  },
  {
    id: 'import',
    label: 'Importer',
    description: 'Ajoute une image, une vidéo ou un PDF depuis ton appareil.',
    href: '/media/gallery/import',
    requiresGemini: false,
  },
  {
    id: 'template',
    label: 'Depuis un template',
    description: 'Rends un visuel à partir d’un de tes templates.',
    href: '/media/templates',
    requiresGemini: false,
  },
  {
    id: 'assemble',
    label: 'Assembler un PDF',
    description: 'Réunis plusieurs images dans un seul PDF.',
    href: '/media/gallery/assemble',
    requiresGemini: false,
  },
];
