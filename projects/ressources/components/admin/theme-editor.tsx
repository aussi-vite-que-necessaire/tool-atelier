"use client"

import { useMemo, useState, useTransition } from "react"
import {
  COLOR_TOKENS, FONT_SANS, FONT_MONO, PRESET_LIST, DEFAULT_PRESET_ID,
  resolveTheme, themeToCss, type ThemeConfig, type ThemeTokens,
} from "@/lib/theme"
import { saveSettingsAction } from "@/lib/actions/settings"

const COLOR_LABELS: Record<(typeof COLOR_TOKENS)[number], string> = {
  paper: "Fond", paper2: "Fond 2", ink: "Texte", inkSoft: "Texte doux",
  accent: "Accent", accentInk: "Texte sur accent", accentSoft: "Accent doux",
  info: "Info", success: "Succès", warn: "Alerte",
}

// oklch(...) n'est pas accepté par <input type=color> (qui veut du #hex). On édite
// donc les couleurs en hex via le color picker ; la valeur courante (oklch des
// presets incluse) reste lisible dans le champ texte miroir.
export function ThemeEditor({
  initialBrandName,
  initialTheme,
}: {
  initialBrandName: string
  initialTheme: ThemeConfig
}) {
  const [brandName, setBrandName] = useState(initialBrandName)
  const [preset, setPreset] = useState(initialTheme.preset || DEFAULT_PRESET_ID)
  const [overrides, setOverrides] = useState<Partial<ThemeTokens>>(initialTheme.overrides ?? {})
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)

  const config: ThemeConfig = useMemo(() => ({ preset, overrides }), [preset, overrides])
  const tokens = useMemo(() => resolveTheme(config), [config])
  const previewCss = useMemo(() => themeToCss(tokens), [tokens])

  function setToken<K extends keyof ThemeTokens>(key: K, value: ThemeTokens[K] | undefined) {
    setSaved(false)
    setOverrides((o) => {
      const next = { ...o }
      if (value === undefined || value === "") delete next[key]
      else next[key] = value
      return next
    })
  }

  // Changer de preset repart de zéro côté overrides (le preset EST le point de départ).
  function pickPreset(id: string) {
    setSaved(false)
    setPreset(id)
    setOverrides({})
  }

  function save() {
    setSaved(false)
    startTransition(async () => {
      const r = await saveSettingsAction({ brandName, theme: config })
      setSaved(r.ok)
    })
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div className="space-y-8">
        <div>
          <label className="label" htmlFor="brandName">Nom de marque</label>
          <input
            id="brandName"
            className="field"
            value={brandName}
            onChange={(e) => { setBrandName(e.target.value); setSaved(false) }}
            placeholder="Le nom affiché sur votre espace public"
          />
        </div>

        <div>
          <span className="label">Thème de départ</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {PRESET_LIST.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => pickPreset(p.id)}
                className={`press border-2 border-ink p-3 text-left shadow-brutal-sm ${
                  preset === p.id ? "bg-accent text-accent-ink" : "bg-paper"
                }`}
              >
                <span className="block font-bold uppercase tracking-wide">{p.label}</span>
                <span className="block text-xs opacity-80">{p.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="label">Couleurs (personnalisation)</span>
          <div className="grid gap-3 sm:grid-cols-2">
            {COLOR_TOKENS.map((key) => (
              <div key={key} className="flex items-center gap-3 border-2 border-ink p-2">
                <input
                  type="color"
                  aria-label={COLOR_LABELS[key]}
                  className="size-9 cursor-pointer border-2 border-ink bg-paper"
                  onChange={(e) => setToken(key, e.target.value)}
                />
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-wide">{COLOR_LABELS[key]}</div>
                  <div className="truncate font-mono text-xs text-ink-soft">{tokens[key]}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fontSans">Police principale</label>
            <select id="fontSans" className="field" value={tokens.fontSans} onChange={(e) => setToken("fontSans", e.target.value as ThemeTokens["fontSans"])}>
              {FONT_SANS.map((f) => <option key={f.id} value={f.stack}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="fontMono">Police mono</label>
            <select id="fontMono" className="field" value={tokens.fontMono} onChange={(e) => setToken("fontMono", e.target.value as ThemeTokens["fontMono"])}>
              {FONT_MONO.map((f) => <option key={f.id} value={f.stack}>{f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="radius">Arrondi des angles</label>
            <select id="radius" className="field" value={tokens.radius} onChange={(e) => setToken("radius", e.target.value)}>
              {["0", "0.25rem", "0.5rem", "0.75rem", "1rem"].map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="shadow">Style d&apos;ombres</label>
            <select id="shadow" className="field" value={tokens.shadowStyle} onChange={(e) => setToken("shadowStyle", e.target.value as ThemeTokens["shadowStyle"])}>
              <option value="brutal">Dures (brutal)</option>
              <option value="soft">Douces (soft)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button type="button" onClick={save} disabled={pending} className="press border-2 border-ink bg-ink px-5 py-2.5 font-bold uppercase tracking-wide text-paper shadow-brutal-sm disabled:opacity-50">
            {pending ? "Enregistrement…" : "Enregistrer"}
          </button>
          {saved && <span className="font-mono text-xs font-bold uppercase tracking-wide text-ink-soft">Enregistré ✓</span>}
        </div>
      </div>

      {/* Aperçu live : un sous-arbre avec les tokens résolus appliqués localement. */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <span className="label">Aperçu</span>
        <style dangerouslySetInnerHTML={{ __html: `.theme-preview{${previewCss}}` }} />
        <div
          className="theme-preview overflow-hidden border-2 p-5"
          style={{
            background: "var(--paper)", color: "var(--ink)", borderColor: "var(--ink)",
            borderRadius: "var(--radius)", boxShadow: "var(--shadow-brutal)", fontFamily: "var(--font-sans)",
          }}
        >
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--accent)" }}>
            {brandName || "Votre marque"}
          </div>
          <h3 className="mt-2 text-xl font-black" style={{ letterSpacing: "-0.02em" }}>Titre de ressource</h3>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-soft)" }}>
            Un paragraphe d&apos;exemple pour visualiser le rendu de votre espace.
          </p>
          <span
            className="mt-4 inline-block px-3 py-1.5 text-xs font-bold uppercase"
            style={{ background: "var(--accent)", color: "var(--accent-ink)", borderRadius: "var(--radius)" }}
          >
            Bouton
          </span>
        </div>
      </div>
    </div>
  )
}
