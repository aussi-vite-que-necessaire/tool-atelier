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
    const hrefOf = (id: string) => CREATION_MODES.find((m) => m.id === id)?.href;
    expect(hrefOf('generate')).toBe('/media/gallery/generate');
    expect(hrefOf('import')).toBe('/media/gallery/import');
    expect(hrefOf('template')).toBe('/media/templates');
    expect(hrefOf('assemble')).toBe('/media/gallery/assemble');
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
