// Contenu seed par défaut pour les nouveaux users.
// Copié verbatim du repo v1 (content-os) au moment du portage Spec 3.

import {
  createPublicationFormat,
  listPublicationFormats,
} from '../repositories/publication-formats';
import { createVoice, listVoices } from '../repositories/voice';

export const DEFAULT_VOICE_NAME = 'Voix principale';

export const DEFAULT_VOICE_CONTENT = `# Voix éditoriale

Identité immuable de l'auteur quand il écrit. Indépendante du format, de la plateforme et du type de post. S'applique à toutes les générations.

## Persona

Fondateur indépendant. Construit en solo, à l'intersection produit, stratégie et exécution. Pratique la production éditoriale assistée par agents IA. Écrit pour ses pairs : fondateurs, opérateurs solo, créateurs de contenu pro.

## Ton

- Direct, factuel, tranché. L'auteur ne hedge pas, il assume une position.
- Première personne du singulier, ou phrase déclarative.
- Le post raconte une observation, une décision, ou un point de vue. Pas un tutoriel.
- Pas d'analogies niaises, pas de métaphores filées, pas de "imaginez si...".

## Anti-patterns absolus

Inviolables, peu importe le format ou le template.

- **Jamais de tiret cadratin** (\`—\`). Remplacer par virgule, parenthèses ou deux-points.
- **Pas de staccato creux** : éviter les cascades de phrases tronquées style "Il la lit. Il l'applique. Il avance." C'est du bruit.
- **Pas de négation performative** : ne jamais décrire ce qu'on "ne fait pas". Reformuler positivement ou supprimer.
- **Pas de hook teaser systématique** "hier j'ai... demain je...". Préférer un hook factuel ou tranché.
- **Pas de répétitions** : ne pas répéter les mots-clés saillants entre corps et closure.
`;

export const DEFAULT_PUBLICATION_FORMAT = {
  name: 'Post LinkedIn standard',
  platform: 'linkedin',
  structure: `Format : post LinkedIn de 800 à 1500 caractères, idéalement autour de 1000.

Squelette :
- HOOK : 1 à 2 phrases d'accroche, factuelles ou tranchées. Doivent pouvoir se lire seules.
- CORPS : 2 à 4 idées qui se déroulent. Aération avec retours à la ligne. Pas de paragraphes denses.
- CLOSURE : 1 phrase qui ouvre, propose une suite de pensée, ou tranche. Ne récapitule pas le hook.`,
  visualIntent: null as string | null,
  writingRules: null as string | null,
};

export async function seedUserDefaults(userId: string): Promise<void> {
  if ((await listVoices(userId)).length === 0) {
    await createVoice(userId, { name: DEFAULT_VOICE_NAME, content: DEFAULT_VOICE_CONTENT });
  }
  const formats = await listPublicationFormats(userId);
  if (!formats.some((t) => t.name === DEFAULT_PUBLICATION_FORMAT.name)) {
    await createPublicationFormat(userId, DEFAULT_PUBLICATION_FORMAT);
  }
}
