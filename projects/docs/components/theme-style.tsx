import { resolveTheme, themeToCss, type ThemeConfig } from "@/lib/theme"

// Injecte les tokens de l'espace en :root (écrase les défauts de globals.css au runtime).
export function ThemeStyle({ theme }: { theme: ThemeConfig | null }) {
  const css = themeToCss(resolveTheme(theme))
  return <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} />
}
