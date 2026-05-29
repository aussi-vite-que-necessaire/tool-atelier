import type { ThemeTokens } from "./tokens"
import { FONT_SANS, FONT_MONO } from "./tokens"

const SANS = Object.fromEntries(FONT_SANS.map((f) => [f.id, f.stack])) as Record<string, string>
const MONO = Object.fromEntries(FONT_MONO.map((f) => [f.id, f.stack])) as Record<string, string>

// Brutalist = le design actuel (cf. globals.css). Sert aussi de défaut.
const brutalist: ThemeTokens = {
  paper: "oklch(0.985 0.005 95)",
  paper2: "oklch(0.955 0.008 95)",
  ink: "oklch(0.2 0.012 60)",
  inkSoft: "oklch(0.46 0.012 60)",
  accent: "oklch(0.63 0.22 27)",
  accentInk: "oklch(0.99 0.01 95)",
  accentSoft: "oklch(0.93 0.07 40)",
  info: "oklch(0.9 0.07 235)",
  success: "oklch(0.9 0.11 150)",
  warn: "oklch(0.92 0.13 90)",
  fontSans: SANS.geist,
  fontMono: MONO["geist-mono"],
  radius: "0",
  shadowStyle: "brutal",
}

const modern: ThemeTokens = {
  paper: "oklch(0.99 0.002 250)",
  paper2: "oklch(0.965 0.004 250)",
  ink: "oklch(0.25 0.02 265)",
  inkSoft: "oklch(0.52 0.02 265)",
  accent: "oklch(0.58 0.18 275)",
  accentInk: "oklch(0.99 0.005 275)",
  accentSoft: "oklch(0.93 0.05 275)",
  info: "oklch(0.9 0.06 235)",
  success: "oklch(0.9 0.1 150)",
  warn: "oklch(0.92 0.12 90)",
  fontSans: SANS.geist,
  fontMono: MONO["geist-mono"],
  radius: "0.75rem",
  shadowStyle: "soft",
}

const dark: ThemeTokens = {
  paper: "oklch(0.21 0.015 265)",
  paper2: "oklch(0.26 0.018 265)",
  ink: "oklch(0.95 0.01 250)",
  inkSoft: "oklch(0.72 0.02 250)",
  accent: "oklch(0.72 0.17 160)",
  accentInk: "oklch(0.18 0.02 265)",
  accentSoft: "oklch(0.32 0.05 160)",
  info: "oklch(0.7 0.1 235)",
  success: "oklch(0.75 0.13 150)",
  warn: "oklch(0.8 0.13 90)",
  fontSans: SANS.geist,
  fontMono: MONO["geist-mono"],
  radius: "0.5rem",
  shadowStyle: "soft",
}

const editorial: ThemeTokens = {
  paper: "oklch(0.98 0.008 85)",
  paper2: "oklch(0.95 0.01 85)",
  ink: "oklch(0.18 0.01 60)",
  inkSoft: "oklch(0.44 0.012 60)",
  accent: "oklch(0.5 0.13 25)",
  accentInk: "oklch(0.98 0.01 85)",
  accentSoft: "oklch(0.9 0.05 35)",
  info: "oklch(0.88 0.07 235)",
  success: "oklch(0.88 0.1 150)",
  warn: "oklch(0.9 0.12 90)",
  fontSans: SANS.serif,
  fontMono: MONO["geist-mono"],
  radius: "0.25rem",
  shadowStyle: "soft",
}

export const PRESETS: Record<string, ThemeTokens> = { brutalist, modern, dark, editorial }

export const DEFAULT_PRESET_ID = "brutalist"

// Métadonnées d'affichage pour le sélecteur de l'éditeur.
export const PRESET_LIST: { id: string; label: string; description: string }[] = [
  { id: "brutalist", label: "Brutalist", description: "Papier/encre, ombres dures, radius 0." },
  { id: "modern", label: "Modern", description: "Doux et arrondi, accent violet." },
  { id: "dark", label: "Dark", description: "Fond sombre, accent vif." },
  { id: "editorial", label: "Editorial", description: "Serif, sobre, contrasté." },
]
