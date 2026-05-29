import { type ThemeTokens, type ThemeConfig, themeTokensSchema } from "./tokens"
import { PRESETS, DEFAULT_PRESET_ID } from "./presets"

// Résout la config (preset + overrides) en jeu de tokens complet. Robuste : preset
// inconnu/null → défaut ; overrides invalides → ignorés (jamais d'exception).
export function resolveTheme(config: ThemeConfig | null | undefined): ThemeTokens {
  const base = (config && PRESETS[config.preset]) || PRESETS[DEFAULT_PRESET_ID]
  if (!config?.overrides) return base
  const safe = themeTokensSchema.partial().safeParse(config.overrides)
  return safe.success ? { ...base, ...safe.data } : base
}

// Dérive les 4 ombres signature depuis le style choisi.
function shadowVars(style: ThemeTokens["shadowStyle"]): Record<string, string> {
  if (style === "soft") {
    return {
      "--shadow-brutal-sm": "0 1px 2px 0 color-mix(in oklch, var(--ink) 16%, transparent)",
      "--shadow-brutal": "0 4px 12px -2px color-mix(in oklch, var(--ink) 22%, transparent)",
      "--shadow-brutal-lg": "0 10px 28px -6px color-mix(in oklch, var(--ink) 28%, transparent)",
      "--shadow-brutal-accent": "0 4px 14px -2px color-mix(in oklch, var(--accent) 40%, transparent)",
    }
  }
  return {
    "--shadow-brutal-sm": "2px 2px 0 0 var(--ink)",
    "--shadow-brutal": "4px 4px 0 0 var(--ink)",
    "--shadow-brutal-lg": "6px 6px 0 0 var(--ink)",
    "--shadow-brutal-accent": "4px 4px 0 0 var(--accent)",
  }
}

// Génère le contenu d'un bloc `:root { … }` (sans le sélecteur). Mappe les tokens
// camelCase vers les noms de variables CSS de globals.css.
export function themeToCss(t: ThemeTokens): string {
  const vars: Record<string, string> = {
    "--paper": t.paper,
    "--paper-2": t.paper2,
    "--ink": t.ink,
    "--ink-soft": t.inkSoft,
    "--accent": t.accent,
    "--accent-ink": t.accentInk,
    "--accent-soft": t.accentSoft,
    "--c-info": t.info,
    "--c-success": t.success,
    "--c-warn": t.warn,
    "--radius": t.radius,
    "--font-sans": t.fontSans,
    "--font-mono": t.fontMono,
    ...shadowVars(t.shadowStyle),
  }
  return Object.entries(vars)
    .map(([k, v]) => `${k}: ${v};`)
    .join(" ")
}
