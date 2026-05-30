import { describe, expect, it } from 'vitest';
import { PRESETS, resolveTheme, themeToCss } from '@/lib/ressources/theme';

describe('resolveTheme', () => {
  it('preset par défaut si config nulle', () => {
    expect(resolveTheme(null)).toEqual(PRESETS.brutalist);
  });
  it('preset inconnu → défaut', () => {
    expect(resolveTheme({ preset: 'inexistant', overrides: {} })).toEqual(PRESETS.brutalist);
  });
  it('applique les overrides valides', () => {
    const t = resolveTheme({ preset: 'modern', overrides: { accent: '#ff0000' } });
    expect(t.accent).toBe('#ff0000');
  });
  it('ignore les overrides invalides', () => {
    const t = resolveTheme({
      preset: 'modern',
      overrides: { accent: 'javascript:alert(1)' } as never,
    });
    expect(t.accent).toBe(PRESETS.modern!.accent);
  });
});

describe('themeToCss', () => {
  it('préfixe les variables en --res-', () => {
    const css = themeToCss(PRESETS.brutalist!);
    expect(css).toContain('--res-paper:');
    expect(css).toContain('--res-accent:');
    expect(css).not.toContain('--paper:');
  });
});
