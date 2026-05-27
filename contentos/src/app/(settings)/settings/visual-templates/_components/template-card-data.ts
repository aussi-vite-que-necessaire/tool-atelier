import type { VisualTemplate } from '@/lib/db/schema';
import type { Brand } from '@/lib/visual-templates/brand';
import { buildPreviewHtml } from '@/lib/visual-templates/preview';

export type TemplateCardData = {
  id: string;
  label: string;
  platform: string;
  slug: string;
  width: number;
  height: number;
  html: string;
};

// Convertit une liste de VisualTemplate en view-models pour la grille.
// Fonction pure : pas de dépendance React, testable en unit sans navigateur.
export function toTemplateCardData(templates: VisualTemplate[], brand: Brand): TemplateCardData[] {
  return templates.map((t) => ({
    id: t.id,
    label: t.label,
    platform: t.platform,
    slug: t.slug,
    width: t.width,
    height: t.height,
    html: buildPreviewHtml(t, (t.sampleVars as Record<string, unknown>) ?? {}, brand),
  }));
}
