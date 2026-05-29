import { z } from 'zod';

// ── Validateurs de valeurs CSS (les tokens finissent injectés dans un <style>,
// on interdit donc tout caractère qui pourrait casser/échapper le bloc CSS). ──
const cssColor = z
  .string()
  .regex(/^(#[0-9a-fA-F]{3,8}|(oklch|rgb|rgba|hsl|hsla)\([^;{}<>]*\))$/, 'couleur CSS invalide');

const cssRadius = z.string().regex(/^(0|[0-9]*\.?[0-9]+(px|rem|em|%))$/, 'radius invalide');

// Familles de police autorisées (allowlist : on ne stocke que des stacks connues,
// jamais une valeur libre — sécurité + cohérence du rendu).
export const FONT_SANS = [
  {
    id: 'geist',
    label: 'Geist (défaut)',
    stack: 'var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif',
  },
  {
    id: 'system',
    label: 'Système',
    stack: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
  },
  { id: 'serif', label: 'Serif', stack: "Georgia, Cambria, 'Times New Roman', serif" },
] as const;

export const FONT_MONO = [
  {
    id: 'geist-mono',
    label: 'Geist Mono (défaut)',
    stack: 'var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  {
    id: 'system-mono',
    label: 'Système mono',
    stack: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
] as const;

const sansStacks = FONT_SANS.map((f) => f.stack) as [string, ...string[]];
const monoStacks = FONT_MONO.map((f) => f.stack) as [string, ...string[]];

// Le jeu de tokens canonique : tout ce qui pilote le design d'un espace.
export const themeTokensSchema = z.object({
  // couleurs
  paper: cssColor,
  paper2: cssColor,
  ink: cssColor,
  inkSoft: cssColor,
  accent: cssColor,
  accentInk: cssColor,
  accentSoft: cssColor,
  info: cssColor,
  success: cssColor,
  warn: cssColor,
  // typo
  fontSans: z.enum(sansStacks),
  fontMono: z.enum(monoStacks),
  // forme
  radius: cssRadius,
  shadowStyle: z.enum(['brutal', 'soft']),
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;

// Clés des tokens couleur, utile pour l'éditeur.
export const COLOR_TOKENS = [
  'paper',
  'paper2',
  'ink',
  'inkSoft',
  'accent',
  'accentInk',
  'accentSoft',
  'info',
  'success',
  'warn',
] as const satisfies readonly (keyof ThemeTokens)[];

// Config stockée par opérateur : un preset + des overrides partiels.
export const themeConfigSchema = z.object({
  preset: z.string().min(1),
  overrides: themeTokensSchema.partial().default({}),
});

export type ThemeConfig = z.infer<typeof themeConfigSchema>;

const SANS = Object.fromEntries(FONT_SANS.map((f) => [f.id, f.stack])) as Record<string, string>;
const MONO = Object.fromEntries(FONT_MONO.map((f) => [f.id, f.stack])) as Record<string, string>;

// Brutalist = le design éditorial par défaut du lecteur docs.
const brutalist: ThemeTokens = {
  paper: 'oklch(0.985 0.005 95)',
  paper2: 'oklch(0.955 0.008 95)',
  ink: 'oklch(0.2 0.012 60)',
  inkSoft: 'oklch(0.46 0.012 60)',
  accent: 'oklch(0.63 0.22 27)',
  accentInk: 'oklch(0.99 0.01 95)',
  accentSoft: 'oklch(0.93 0.07 40)',
  info: 'oklch(0.9 0.07 235)',
  success: 'oklch(0.9 0.11 150)',
  warn: 'oklch(0.92 0.13 90)',
  fontSans: SANS.geist!,
  fontMono: MONO['geist-mono']!,
  radius: '0',
  shadowStyle: 'brutal',
};

const modern: ThemeTokens = {
  paper: 'oklch(0.99 0.002 250)',
  paper2: 'oklch(0.965 0.004 250)',
  ink: 'oklch(0.25 0.02 265)',
  inkSoft: 'oklch(0.52 0.02 265)',
  accent: 'oklch(0.58 0.18 275)',
  accentInk: 'oklch(0.99 0.005 275)',
  accentSoft: 'oklch(0.93 0.05 275)',
  info: 'oklch(0.9 0.06 235)',
  success: 'oklch(0.9 0.1 150)',
  warn: 'oklch(0.92 0.12 90)',
  fontSans: SANS.geist!,
  fontMono: MONO['geist-mono']!,
  radius: '0.75rem',
  shadowStyle: 'soft',
};

const dark: ThemeTokens = {
  paper: 'oklch(0.21 0.015 265)',
  paper2: 'oklch(0.26 0.018 265)',
  ink: 'oklch(0.95 0.01 250)',
  inkSoft: 'oklch(0.72 0.02 250)',
  accent: 'oklch(0.72 0.17 160)',
  accentInk: 'oklch(0.18 0.02 265)',
  accentSoft: 'oklch(0.32 0.05 160)',
  info: 'oklch(0.7 0.1 235)',
  success: 'oklch(0.75 0.13 150)',
  warn: 'oklch(0.8 0.13 90)',
  fontSans: SANS.geist!,
  fontMono: MONO['geist-mono']!,
  radius: '0.5rem',
  shadowStyle: 'soft',
};

const editorial: ThemeTokens = {
  paper: 'oklch(0.98 0.008 85)',
  paper2: 'oklch(0.95 0.01 85)',
  ink: 'oklch(0.18 0.01 60)',
  inkSoft: 'oklch(0.44 0.012 60)',
  accent: 'oklch(0.5 0.13 25)',
  accentInk: 'oklch(0.98 0.01 85)',
  accentSoft: 'oklch(0.9 0.05 35)',
  info: 'oklch(0.88 0.07 235)',
  success: 'oklch(0.88 0.1 150)',
  warn: 'oklch(0.9 0.12 90)',
  fontSans: SANS.serif!,
  fontMono: MONO['geist-mono']!,
  radius: '0.25rem',
  shadowStyle: 'soft',
};

export const PRESETS: Record<string, ThemeTokens> = { brutalist, modern, dark, editorial };

export const DEFAULT_PRESET_ID = 'brutalist';

// Métadonnées d'affichage pour le sélecteur de l'éditeur.
export const PRESET_LIST: { id: string; label: string; description: string }[] = [
  { id: 'brutalist', label: 'Brutalist', description: 'Papier/encre, ombres dures, radius 0.' },
  { id: 'modern', label: 'Modern', description: 'Doux et arrondi, accent violet.' },
  { id: 'dark', label: 'Dark', description: 'Fond sombre, accent vif.' },
  { id: 'editorial', label: 'Editorial', description: 'Serif, sobre, contrasté.' },
];

// Résout la config (preset + overrides) en jeu de tokens complet. Robuste : preset
// inconnu/null → défaut ; overrides invalides → ignorés (jamais d'exception).
export function resolveTheme(config: ThemeConfig | null | undefined): ThemeTokens {
  const base = (config && PRESETS[config.preset]) || PRESETS[DEFAULT_PRESET_ID]!;
  if (!config?.overrides) return base;
  const safe = themeTokensSchema.partial().safeParse(config.overrides);
  return safe.success ? { ...base, ...safe.data } : base;
}

// Dérive les 4 ombres signature depuis le style choisi.
function shadowVars(style: ThemeTokens['shadowStyle']): Record<string, string> {
  if (style === 'soft') {
    return {
      '--res-shadow-sm': '0 1px 2px 0 color-mix(in oklch, var(--res-ink) 16%, transparent)',
      '--res-shadow': '0 4px 12px -2px color-mix(in oklch, var(--res-ink) 22%, transparent)',
      '--res-shadow-lg': '0 10px 28px -6px color-mix(in oklch, var(--res-ink) 28%, transparent)',
      '--res-shadow-accent':
        '0 4px 14px -2px color-mix(in oklch, var(--res-accent) 40%, transparent)',
    };
  }
  return {
    '--res-shadow-sm': '2px 2px 0 0 var(--res-ink)',
    '--res-shadow': '4px 4px 0 0 var(--res-ink)',
    '--res-shadow-lg': '6px 6px 0 0 var(--res-ink)',
    '--res-shadow-accent': '4px 4px 0 0 var(--res-accent)',
  };
}

// Génère le contenu d'un bloc de variables (sans le sélecteur), préfixé `--res-`
// pour ne pas écraser les tokens de la suite — le lecteur docs est scopé.
export function themeToCss(t: ThemeTokens): string {
  const vars: Record<string, string> = {
    '--res-paper': t.paper,
    '--res-paper-2': t.paper2,
    '--res-ink': t.ink,
    '--res-ink-soft': t.inkSoft,
    '--res-accent': t.accent,
    '--res-accent-ink': t.accentInk,
    '--res-accent-soft': t.accentSoft,
    '--res-info': t.info,
    '--res-success': t.success,
    '--res-warn': t.warn,
    '--res-radius': t.radius,
    '--res-font-sans': t.fontSans,
    '--res-font-mono': t.fontMono,
    ...shadowVars(t.shadowStyle),
  };
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(' ');
}
