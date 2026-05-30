import { describe, expect, it } from 'vitest';
import { CREATION_MODES } from '@/lib/media/creation-modes';

describe('CREATION_MODES', () => {
  it('offers the four creation modes', () => {
    expect(CREATION_MODES.map((m) => m.id)).toEqual([
      'generate',
      'import',
      'template',
      'assemble',
    ]);
  });

  it('points each mode at its destination', () => {
    const byId = Object.fromEntries(CREATION_MODES.map((m) => [m.id, m]));
    expect(byId.generate.href).toBe('/media/gallery/generate');
    expect(byId.import.href).toBe('/media/gallery/import');
    expect(byId.template.href).toBe('/media/templates');
    expect(byId.assemble.href).toBe('/media/gallery/assemble');
  });

  it('flags only the AI generation mode as requiring Gemini', () => {
    const requiring = CREATION_MODES.filter((m) => m.requiresGemini).map((m) => m.id);
    expect(requiring).toEqual(['generate']);
  });

  it('gives every mode a label and a description', () => {
    for (const mode of CREATION_MODES) {
      expect(mode.label.length).toBeGreaterThan(0);
      expect(mode.description.length).toBeGreaterThan(0);
    }
  });
});
