import { resolveTheme, type ThemeConfig, themeToCss } from '@/lib/ressources/theme';

// Injecte les tokens --res-* de l'opérateur sur .docs-scope (écrase les défauts
// de docs.css au runtime). Les valeurs sont validées par Zod (cssColor/cssRadius).
export function ThemeStyle({ theme }: { theme: ThemeConfig | null }) {
  const css = themeToCss(resolveTheme(theme));
  // biome-ignore lint/security/noDangerouslySetInnerHtml: tokens validés, scope --res-
  return <style dangerouslySetInnerHTML={{ __html: `.docs-scope{${css}}` }} />;
}
