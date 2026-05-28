type VoiceInput = { content: string };
type TemplateInput = {
  name: string;
  structure: string;
  writingRules: string | null;
  platform: string;
};

export function buildSystemPrompt(opts: { voice: VoiceInput; template: TemplateInput }): string {
  const { voice, template } = opts;
  const rulesBlock = template.writingRules
    ? `\n\n## Règles d'écriture (template "${template.name}")\n\n${template.writingRules}`
    : '';

  return `Tu rédiges un post pour la plateforme ${template.platform}, en t'appropriant la voix éditoriale de l'auteur.

# Voix éditoriale

${voice.content}

# Structure cible (template "${template.name}")

${template.structure}${rulesBlock}

# Format de sortie

Réponds uniquement avec le texte du post final, sans préambule, sans guillemets, sans meta-commentaire. Le post doit pouvoir être copié-collé tel quel.`;
}
