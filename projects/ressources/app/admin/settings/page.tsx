import { requireOperator } from "@/lib/auth/operator"
import { DEFAULT_PRESET_ID, type ThemeConfig } from "@/lib/theme"
import { ThemeEditor } from "@/components/admin/theme-editor"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const op = await requireOperator()
  const theme: ThemeConfig = op.theme ?? { preset: DEFAULT_PRESET_ID, overrides: {} }

  return (
    <div>
      <header className="mb-8">
        <h1 className="accent-rule text-3xl font-black tracking-tight">Réglages</h1>
        <p className="mt-3 max-w-2xl text-ink-soft">
          Personnalisez le nom et le thème de votre espace public (
          <span className="font-mono">/o/{op.handle}</span>).
        </p>
      </header>
      <ThemeEditor initialBrandName={op.brandName ?? ""} initialTheme={theme} />
    </div>
  )
}
