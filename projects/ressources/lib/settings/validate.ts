import { z } from "zod"
import { themeConfigSchema, type ThemeConfig } from "@/lib/theme"

// Logique pure de validation des réglages (hors « use server » : testable et
// importable sans contrainte d'export async).
export const settingsInputSchema = z.object({
  brandName: z.string(),
  theme: themeConfigSchema,
})

export type SettingsInput = z.input<typeof settingsInputSchema>

// Trim du nom (vide → null), validation stricte de la config via Zod.
// Renvoie null si le payload est invalide.
export function parseSettingsInput(raw: unknown): { brandName: string | null; theme: ThemeConfig } | null {
  const parsed = settingsInputSchema.safeParse(raw)
  if (!parsed.success) return null
  const brandName = parsed.data.brandName.trim()
  return { brandName: brandName === "" ? null : brandName, theme: parsed.data.theme }
}
