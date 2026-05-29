import { z } from "zod"

// ── Validateurs de valeurs CSS (les tokens finissent injectés dans un <style>,
// on interdit donc tout caractère qui pourrait casser/échapper le bloc CSS). ──
const cssColor = z
  .string()
  .regex(
    /^(#[0-9a-fA-F]{3,8}|(oklch|rgb|rgba|hsl|hsla)\([^;{}<>]*\))$/,
    "couleur CSS invalide",
  )

const cssRadius = z.string().regex(/^(0|[0-9]*\.?[0-9]+(px|rem|em|%))$/, "radius invalide")

// Familles de police autorisées (allowlist : on ne stocke que des stacks connues,
// jamais une valeur libre — sécurité + cohérence du rendu).
export const FONT_SANS = [
  { id: "geist", label: "Geist (défaut)", stack: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif" },
  { id: "system", label: "Système", stack: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif" },
  { id: "serif", label: "Serif", stack: "Georgia, Cambria, 'Times New Roman', serif" },
] as const

export const FONT_MONO = [
  { id: "geist-mono", label: "Geist Mono (défaut)", stack: "var(--font-geist-mono), ui-monospace, SFMono-Regular, Menlo, monospace" },
  { id: "system-mono", label: "Système mono", stack: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" },
] as const

const sansStacks = FONT_SANS.map((f) => f.stack) as [string, ...string[]]
const monoStacks = FONT_MONO.map((f) => f.stack) as [string, ...string[]]

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
  shadowStyle: z.enum(["brutal", "soft"]),
})

export type ThemeTokens = z.infer<typeof themeTokensSchema>

// Clés des tokens couleur, utile pour l'éditeur.
export const COLOR_TOKENS = [
  "paper", "paper2", "ink", "inkSoft", "accent", "accentInk", "accentSoft", "info", "success", "warn",
] as const satisfies readonly (keyof ThemeTokens)[]

// Config stockée sur l'operator : un preset + des overrides partiels.
export const themeConfigSchema = z.object({
  preset: z.string().min(1),
  overrides: themeTokensSchema.partial().default({}),
})

export type ThemeConfig = z.infer<typeof themeConfigSchema>
