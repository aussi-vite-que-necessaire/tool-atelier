import { describe, expect, it } from 'vitest';
import { provenanceLabel } from '@/lib/media/provenance';
import type { MediaSource } from '@/lib/media/types';

describe('provenanceLabel', () => {
  it('maps each source to a French label', () => {
    const cases: Record<MediaSource, string> = {
      gemini_generate: 'Généré (IA)',
      gemini_edit: 'Édité (IA)',
      template_render: 'Depuis un template',
      html_render: 'Rendu HTML',
      upload: 'Importé',
      pdf_aggregate: 'Assemblé',
    };
    for (const [source, label] of Object.entries(cases)) {
      expect(provenanceLabel(source as MediaSource)).toBe(label);
    }
  });
});
