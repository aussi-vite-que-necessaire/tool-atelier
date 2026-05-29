# Thème de docs customisable — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à chaque opérateur de brander et piloter le thème de son espace public (`docs`) depuis une page de réglages dans `ressources` : nom de marque, choix d'un preset, et personnalisation fine des tokens.

**Architecture:** Un thème est un jeu de tokens (couleurs, typo, forme) validé par Zod. Les presets sont des jeux de tokens nommés. Un cœur pur `lib/theme/` (résolution preset+overrides → CSS) est partagé entre `ressources` (éditeur + aperçu) et `docs` (injection runtime) via `scripts/sync-shared.sh`. Le thème est stocké sur la table `operators` (`brand_name`, `theme jsonb`) et injecté en `:root` par les pages publiques.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (Postgres), Tailwind v4 (tokens CSS), Zod, Vitest.

---

## File Structure

**`ressources` (propriétaire) :**
- Create: `projects/ressources/lib/theme/tokens.ts` — schéma Zod + types + allowlist polices + défaut
- Create: `projects/ressources/lib/theme/presets.ts` — 4 presets (jeux de tokens) + métadonnées
- Create: `projects/ressources/lib/theme/resolve.ts` — `resolveTheme`, `themeToCss`
- Create: `projects/ressources/lib/theme/index.ts` — ré-exports
- Create: `projects/ressources/lib/theme/resolve.test.ts`, `presets.test.ts`
- Create: `projects/ressources/lib/actions/settings.ts` — server action de sauvegarde
- Create: `projects/ressources/lib/actions/settings.test.ts`
- Create: `projects/ressources/components/admin/theme-editor.tsx` — éditeur client + aperçu live
- Create: `projects/ressources/app/admin/settings/page.tsx` — page réglages
- Modify: `projects/ressources/db/schema/operators.ts` — colonnes `brandName`, `theme`
- Modify: `projects/ressources/lib/auth/operator.ts` — charger `brandName`/`theme`
- Modify: `projects/ressources/app/admin/layout.tsx` — lien nav « Réglages »
- Create: `projects/ressources/drizzle/0005_*.sql` (généré)
- Modify: `scripts/sync-shared.sh` — ajouter `lib/theme` au contrat partagé

**`docs` (consommateur) :**
- Generated (via sync): `projects/docs/lib/theme/*`
- Modify: `projects/docs/lib/auth/operator.ts` — charger `brandName`/`theme`
- Create: `projects/docs/components/theme-style.tsx` — `<style>` d'injection
- Modify: `projects/docs/components/reader/reader-shell.tsx` — prop `themeCss`
- Modify: `projects/docs/app/(public)/o/[handle]/r/[slug]/render.tsx` — injecter le thème
- Modify: `projects/docs/app/(public)/o/[handle]/page.tsx` — injecter le thème + nom de marque

---

## Task 1: Schéma des tokens (`lib/theme/tokens.ts`)

**Files:**
- Create: `projects/ressources/lib/theme/tokens.ts`

- [ ] **Step 1: Écrire le module tokens**

```ts
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

// Couleur de tokens (les clés couleur), utile pour l'éditeur.
export const COLOR_TOKENS = [
  "paper", "paper2", "ink", "inkSoft", "accent", "accentInk", "accentSoft", "info", "success", "warn",
] as const satisfies readonly (keyof ThemeTokens)[]

// Config stockée sur l'operator : un preset + des overrides partiels.
export const themeConfigSchema = z.object({
  preset: z.string().min(1),
  overrides: themeTokensSchema.partial().default({}),
})

export type ThemeConfig = z.infer<typeof themeConfigSchema>
```

- [ ] **Step 2: Vérifier que ça compile**

Run: `cd projects/ressources && npx tsc --noEmit`
Expected: PASS (pas d'erreur sur ce fichier ; d'autres fichiers non encore créés peuvent manquer — ignorer les imports inexistants à ce stade, il ne doit pas y avoir d'erreur DANS tokens.ts).

- [ ] **Step 3: Commit**

```bash
git add projects/ressources/lib/theme/tokens.ts
git commit -m "feat(ressources): schéma Zod des tokens de thème"
```

---

## Task 2: Presets (`lib/theme/presets.ts`)

**Files:**
- Create: `projects/ressources/lib/theme/presets.ts`
- Test: `projects/ressources/lib/theme/presets.test.ts`

- [ ] **Step 1: Écrire le test (les 4 presets sont des jeux de tokens valides)**

```ts
import { describe, it, expect } from "vitest"
import { themeTokensSchema } from "./tokens"
import { PRESETS, PRESET_LIST, DEFAULT_PRESET_ID } from "./presets"

describe("presets", () => {
  it("expose au moins brutalist, modern, dark, editorial", () => {
    for (const id of ["brutalist", "modern", "dark", "editorial"]) {
      expect(PRESETS[id]).toBeDefined()
    }
  })

  it("chaque preset valide contre themeTokensSchema", () => {
    for (const [id, tokens] of Object.entries(PRESETS)) {
      const r = themeTokensSchema.safeParse(tokens)
      expect(r.success, `preset ${id}: ${r.success ? "" : JSON.stringify(r.error.issues)}`).toBe(true)
    }
  })

  it("le preset par défaut existe et PRESET_LIST couvre tous les presets", () => {
    expect(PRESETS[DEFAULT_PRESET_ID]).toBeDefined()
    expect(PRESET_LIST.map((p) => p.id).sort()).toEqual(Object.keys(PRESETS).sort())
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd projects/ressources && npx vitest run lib/theme/presets.test.ts`
Expected: FAIL (module `./presets` introuvable).

- [ ] **Step 3: Écrire les presets**

```ts
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
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd projects/ressources && npx vitest run lib/theme/presets.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/ressources/lib/theme/presets.ts projects/ressources/lib/theme/presets.test.ts
git commit -m "feat(ressources): presets de thème (brutalist, modern, dark, editorial)"
```

---

## Task 3: Résolution + génération CSS (`lib/theme/resolve.ts` + `index.ts`)

**Files:**
- Create: `projects/ressources/lib/theme/resolve.ts`
- Create: `projects/ressources/lib/theme/index.ts`
- Test: `projects/ressources/lib/theme/resolve.test.ts`

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest"
import { resolveTheme, themeToCss } from "./resolve"
import { PRESETS } from "./presets"

describe("resolveTheme", () => {
  it("résout un preset seul", () => {
    expect(resolveTheme({ preset: "modern", overrides: {} })).toEqual(PRESETS.modern)
  })

  it("applique des overrides partiels par-dessus le preset", () => {
    const r = resolveTheme({ preset: "brutalist", overrides: { accent: "#ff0000" } })
    expect(r.accent).toBe("#ff0000")
    expect(r.paper).toBe(PRESETS.brutalist.paper)
  })

  it("retombe sur le défaut (brutalist) pour un preset inconnu ou null", () => {
    expect(resolveTheme({ preset: "nope", overrides: {} })).toEqual(PRESETS.brutalist)
    expect(resolveTheme(null)).toEqual(PRESETS.brutalist)
    expect(resolveTheme(undefined)).toEqual(PRESETS.brutalist)
  })

  it("ignore des overrides invalides plutôt que de planter", () => {
    const r = resolveTheme({ preset: "brutalist", overrides: { accent: "red; } body{display:none}" } as never })
    expect(r.accent).toBe(PRESETS.brutalist.accent)
  })
})

describe("themeToCss", () => {
  it("produit les variables CSS attendues", () => {
    const css = themeToCss(PRESETS.brutalist)
    expect(css).toContain("--paper: oklch(0.985 0.005 95)")
    expect(css).toContain("--paper-2: oklch(0.955 0.008 95)")
    expect(css).toContain("--ink-soft:")
    expect(css).toContain("--accent-ink:")
    expect(css).toContain("--c-info:")
    expect(css).toContain("--radius: 0")
    expect(css).toContain("--font-sans:")
    expect(css).toContain("--font-mono:")
  })

  it("dérive les ombres dures en style brutal", () => {
    const css = themeToCss(PRESETS.brutalist)
    expect(css).toContain("--shadow-brutal: 4px 4px 0 0 var(--ink)")
    expect(css).toContain("--shadow-brutal-accent: 4px 4px 0 0 var(--accent)")
  })

  it("dérive des ombres floues en style soft", () => {
    const css = themeToCss({ ...PRESETS.modern, shadowStyle: "soft" })
    expect(css).toContain("--shadow-brutal:")
    expect(css).not.toContain("0 0 var(--ink)")
    expect(css).toContain("color-mix")
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd projects/ressources && npx vitest run lib/theme/resolve.test.ts`
Expected: FAIL (module `./resolve` introuvable).

- [ ] **Step 3: Écrire `resolve.ts`**

```ts
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
```

- [ ] **Step 4: Écrire `index.ts`**

```ts
export * from "./tokens"
export * from "./presets"
export * from "./resolve"
```

- [ ] **Step 5: Lancer le test (succès attendu)**

Run: `cd projects/ressources && npx vitest run lib/theme/resolve.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/ressources/lib/theme/resolve.ts projects/ressources/lib/theme/index.ts projects/ressources/lib/theme/resolve.test.ts
git commit -m "feat(ressources): résolution preset+overrides et génération CSS du thème"
```

---

## Task 4: Colonnes DB + migration + sync du cœur partagé

**Files:**
- Modify: `projects/ressources/db/schema/operators.ts`
- Modify: `scripts/sync-shared.sh`
- Create: `projects/ressources/drizzle/0005_*.sql` (généré)

- [ ] **Step 1: Ajouter les colonnes au schéma**

Dans `projects/ressources/db/schema/operators.ts`, remplacer le bloc `pgTable` par :

```ts
import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core"
import type { ThemeConfig } from "@/lib/theme"

export const operators = pgTable("operators", {
  id: text("id").primaryKey(),
  handle: text("handle").notNull().unique(),
  name: text("name").notNull(),
  // Branding de l'espace public (docs). brandName = nom de marque affiché ;
  // theme = { preset, overrides } piloté depuis /admin/settings (null = défaut).
  brandName: text("brand_name"),
  theme: jsonb("theme").$type<ThemeConfig>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
})

export type OperatorRow = typeof operators.$inferSelect
```

- [ ] **Step 2: Générer la migration**

Run: `cd projects/ressources && npx drizzle-kit generate --name add_operator_theme`
Expected: crée `drizzle/0005_add_operator_theme.sql` contenant `ALTER TABLE "operators" ADD COLUMN "brand_name" text;` et `ADD COLUMN "theme" jsonb;`. (La génération ne se connecte pas à la base.)

- [ ] **Step 3: Vérifier la migration générée**

Run: `cat projects/ressources/drizzle/0005_add_operator_theme.sql`
Expected: deux `ADD COLUMN` (brand_name, theme), tous deux nullable (pas de `NOT NULL`). Si autre chose apparaît, corriger le schéma et régénérer.

- [ ] **Step 4: Ajouter `lib/theme` au contrat partagé**

Dans `scripts/sync-shared.sh`, étendre le tableau `SHARED` :

```bash
SHARED=(
  "db/schema"
  "db/index.ts"
  "lib/theme"
)
```

Et mettre à jour le commentaire au-dessus (lignes ~26-30) pour mentionner que `lib/theme` (logique pure des tokens de thème) doit rester identique entre admin et public.

- [ ] **Step 5: Synchroniser**

Run: `bash scripts/sync-shared.sh`
Expected: `✓ contrat de données synchronisé : ressources → docs`. Vérifier : `ls projects/docs/lib/theme/` montre `tokens.ts presets.ts resolve.ts index.ts` (+ les `.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add projects/ressources/db/schema/operators.ts projects/ressources/drizzle/ scripts/sync-shared.sh projects/docs/lib/theme/
git commit -m "feat: colonnes operator brand_name/theme + lib/theme dans le contrat partagé"
```

---

## Task 5: Charger brandName/theme dans `operator.ts` (les 2 projets)

**Files:**
- Modify: `projects/ressources/lib/auth/operator.ts`
- Modify: `projects/docs/lib/auth/operator.ts`

Ces deux fichiers ne sont PAS synchronisés (chaque app a le sien) — éditer les deux identiquement sur ces points.

- [ ] **Step 1: Étendre le type et le mapping (ressources ET docs)**

Dans CHACUN des deux fichiers, remplacer les lignes 11-15 (type `Operator` + `toOperator`) par :

```ts
import type { ThemeConfig } from "@/lib/theme"

export type Operator = {
  id: string
  handle: string
  name: string
  brandName: string | null
  theme: ThemeConfig | null
}

function toOperator(row: typeof operators.$inferSelect | undefined): Operator | null {
  return row
    ? { id: row.id, handle: row.handle, name: row.name, brandName: row.brandName ?? null, theme: row.theme ?? null }
    : null
}
```

(L'`import type { ThemeConfig }` va en tête de fichier avec les autres imports.)

- [ ] **Step 2: Vérifier la compilation des deux projets**

Run: `cd projects/ressources && npx tsc --noEmit && cd ../docs && npx tsc --noEmit`
Expected: PASS pour les deux (les colonnes existent dans le schéma synchronisé des deux côtés).

- [ ] **Step 3: Commit**

```bash
git add projects/ressources/lib/auth/operator.ts projects/docs/lib/auth/operator.ts
git commit -m "feat: exposer brandName/theme sur le type Operator (ressources + docs)"
```

---

## Task 6: Server action de sauvegarde (`lib/actions/settings.ts`)

**Files:**
- Create: `projects/ressources/lib/actions/settings.ts`
- Test: `projects/ressources/lib/actions/settings.test.ts`

La fonction de validation/normalisation du payload est extraite (pure) pour être testable sans DB ni session.

- [ ] **Step 1: Écrire le test**

```ts
import { describe, it, expect } from "vitest"
import { parseSettingsInput } from "./settings"

describe("parseSettingsInput", () => {
  it("accepte un nom de marque et une config valides", () => {
    const r = parseSettingsInput({
      brandName: "Atelier de Manu",
      theme: { preset: "modern", overrides: { accent: "#5b21b6" } },
    })
    expect(r).not.toBeNull()
    expect(r!.brandName).toBe("Atelier de Manu")
    expect(r!.theme.preset).toBe("modern")
    expect(r!.theme.overrides.accent).toBe("#5b21b6")
  })

  it("normalise un nom de marque vide en null", () => {
    const r = parseSettingsInput({ brandName: "   ", theme: { preset: "brutalist", overrides: {} } })
    expect(r!.brandName).toBeNull()
  })

  it("rejette un override de couleur dangereux", () => {
    const r = parseSettingsInput({
      brandName: "x",
      theme: { preset: "brutalist", overrides: { accent: "red; } body{}" } },
    })
    expect(r).toBeNull()
  })

  it("rejette une police hors allowlist", () => {
    const r = parseSettingsInput({
      brandName: "x",
      theme: { preset: "brutalist", overrides: { fontSans: "Comic Sans MS" } },
    })
    expect(r).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run: `cd projects/ressources && npx vitest run lib/actions/settings.test.ts`
Expected: FAIL (module introuvable).

- [ ] **Step 3: Écrire l'action**

```ts
"use server"

import { eq } from "drizzle-orm"
import { z } from "zod"
import { db } from "@/db"
import { operators } from "@/db/schema"
import { requireOperator } from "@/lib/auth/operator"
import { themeConfigSchema, type ThemeConfig } from "@/lib/theme"

const inputSchema = z.object({
  brandName: z.string(),
  theme: themeConfigSchema,
})

export type SettingsInput = z.input<typeof inputSchema>

// Validation/normalisation pure (testable sans DB) : trim du nom (vide → null),
// validation stricte de la config via Zod. Renvoie null si le payload est invalide.
export function parseSettingsInput(raw: unknown): { brandName: string | null; theme: ThemeConfig } | null {
  const parsed = inputSchema.safeParse(raw)
  if (!parsed.success) return null
  const brandName = parsed.data.brandName.trim()
  return { brandName: brandName === "" ? null : brandName, theme: parsed.data.theme }
}

export async function saveSettingsAction(raw: SettingsInput): Promise<{ ok: boolean }> {
  const op = await requireOperator()
  const clean = parseSettingsInput(raw)
  if (!clean) return { ok: false }
  await db
    .update(operators)
    .set({ brandName: clean.brandName, theme: clean.theme })
    .where(eq(operators.id, op.id))
  return { ok: true }
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run: `cd projects/ressources && npx vitest run lib/actions/settings.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add projects/ressources/lib/actions/settings.ts projects/ressources/lib/actions/settings.test.ts
git commit -m "feat(ressources): server action de sauvegarde des réglages de thème"
```

---

## Task 7: Éditeur de thème (client) — `components/admin/theme-editor.tsx`

**Files:**
- Create: `projects/ressources/components/admin/theme-editor.tsx`

Composant client : sélection du preset, édition des overrides (couleurs, police, radius, ombres), aperçu live (via `themeToCss`/`resolveTheme`), soumission via la server action.

- [ ] **Step 1: Écrire le composant**

```tsx
"use client"

import { useMemo, useState, useTransition } from "react"
import {
  COLOR_TOKENS, FONT_SANS, FONT_MONO, PRESET_LIST, PRESETS, DEFAULT_PRESET_ID,
  resolveTheme, themeToCss, type ThemeConfig, type ThemeTokens,
} from "@/lib/theme"
import { saveSettingsAction } from "@/lib/actions/settings"

const COLOR_LABELS: Record<(typeof COLOR_TOKENS)[number], string> = {
  paper: "Fond", paper2: "Fond 2", ink: "Texte", inkSoft: "Texte doux",
  accent: "Accent", accentInk: "Texte sur accent", accentSoft: "Accent doux",
  info: "Info", success: "Succès", warn: "Alerte",
}

// oklch(...) n'est pas accepté par <input type=color> (qui veut du #hex). On édite
// donc les couleurs en hex via le color picker ; les valeurs oklch des presets
// restent visibles tant qu'on ne les touche pas (champ texte miroir).
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
    setOverrides((o) => {
      const next = { ...o }
      if (value === undefined || value === "") delete next[key]
      else next[key] = value
      return next
    })
  }

  // Changer de preset repart de zéro côté overrides (le preset EST le point de départ).
  function pickPreset(id: string) {
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
            onChange={(e) => setBrandName(e.target.value)}
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
            <label className="label" htmlFor="shadow">Style d'ombres</label>
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

      {/* Aperçu live : un sous-arbre isolé avec les tokens résolus en style local. */}
      <div className="lg:sticky lg:top-20 lg:self-start">
        <span className="label">Aperçu</span>
        <div style={{ all: "revert" } as React.CSSProperties}>
          <style dangerouslySetInnerHTML={{ __html: `.theme-preview { ${previewCss} }` }} />
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
              Un paragraphe d'exemple pour visualiser le rendu de votre espace.
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
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `cd projects/ressources && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add projects/ressources/components/admin/theme-editor.tsx
git commit -m "feat(ressources): éditeur de thème avec aperçu live"
```

---

## Task 8: Page réglages + lien nav

**Files:**
- Create: `projects/ressources/app/admin/settings/page.tsx`
- Modify: `projects/ressources/app/admin/layout.tsx`

- [ ] **Step 1: Écrire la page**

```tsx
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
          Personnalisez le nom et le thème de votre espace public ({" "}
          <span className="font-mono">/o/{op.handle}</span>).
        </p>
      </header>
      <ThemeEditor initialBrandName={op.brandName ?? ""} initialTheme={theme} />
    </div>
  )
}
```

- [ ] **Step 2: Ajouter le lien nav**

Dans `projects/ressources/app/admin/layout.tsx`, dans le `<nav>` (après le lien Audience, avant « Espace ↗ »), ajouter :

```tsx
<Link href="/admin/settings" className="hover:text-ink">
  Réglages
</Link>
```

- [ ] **Step 3: Vérifier la compilation**

Run: `cd projects/ressources && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add projects/ressources/app/admin/settings/page.tsx projects/ressources/app/admin/layout.tsx
git commit -m "feat(ressources): page /admin/settings et lien nav"
```

---

## Task 9: Injection du thème côté docs

**Files:**
- Create: `projects/docs/components/theme-style.tsx`
- Modify: `projects/docs/components/reader/reader-shell.tsx`
- Modify: `projects/docs/app/(public)/o/[handle]/r/[slug]/render.tsx`
- Modify: `projects/docs/app/(public)/o/[handle]/page.tsx`

- [ ] **Step 1: Créer le composant d'injection**

`projects/docs/components/theme-style.tsx` :

```tsx
import { resolveTheme, themeToCss, type ThemeConfig } from "@/lib/theme"

// Injecte les tokens de l'espace en :root (écrase les défauts de globals.css au runtime).
export function ThemeStyle({ theme }: { theme: ThemeConfig | null }) {
  const css = themeToCss(resolveTheme(theme))
  return <style dangerouslySetInnerHTML={{ __html: `:root{${css}}` }} />
}
```

- [ ] **Step 2: Ajouter une prop `themeCss` au ReaderShell**

Dans `projects/docs/components/reader/reader-shell.tsx` : ajouter `theme` aux props et l'injecter en haut du rendu.

Ajouter l'import en tête :
```tsx
import { ThemeStyle } from "@/components/theme-style"
import type { ThemeConfig } from "@/lib/theme"
```
Ajouter `theme` à la signature des props (avec son type `theme: ThemeConfig | null`) et au destructuring. Puis, juste après `<div className="min-h-screen">` (ligne 38), insérer :
```tsx
      <ThemeStyle theme={theme} />
```

- [ ] **Step 3: Passer le thème depuis le reader**

Dans `projects/docs/app/(public)/o/[handle]/r/[slug]/render.tsx`, sur la balise `<ReaderShell …>` (ligne 97), ajouter la prop `theme={operator.theme}` :

```tsx
    <ReaderShell theme={operator.theme} resourceTitle={data.resource.title} root={root} basePath={basePath} currentId={page.id} toc={toc}>
```

- [ ] **Step 4: Injecter le thème + nom de marque sur la page d'espace**

Dans `projects/docs/app/(public)/o/[handle]/page.tsx` :

Ajouter l'import :
```tsx
import { ThemeStyle } from "@/components/theme-style"
```
Juste après `<div className="min-h-screen">` (ligne 20), insérer :
```tsx
      <ThemeStyle theme={op.theme} />
```
Et remplacer l'eyebrow `{op.name}` (ligne 25) par le nom de marque avec repli :
```tsx
          <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-accent">{op.brandName ?? op.name}</p>
```

- [ ] **Step 5: Vérifier la compilation de docs**

Run: `cd projects/docs && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add projects/docs/components/theme-style.tsx projects/docs/components/reader/reader-shell.tsx "projects/docs/app/(public)/o/[handle]/r/[slug]/render.tsx" "projects/docs/app/(public)/o/[handle]/page.tsx"
git commit -m "feat(docs): injecter le thème de l'espace et afficher le nom de marque"
```

---

## Task 10: Vérification globale

**Files:** aucun (vérification).

- [ ] **Step 1: Resync du contrat partagé (idempotent, garde CI verte)**

Run: `bash scripts/sync-shared.sh && git status --short`
Expected: pas de diff non committé sur `projects/docs/lib/theme/` (sinon committer).

- [ ] **Step 2: Tests + typecheck + lint des deux projets**

Run:
```bash
cd projects/ressources && npx vitest run && npx tsc --noEmit && npm run lint
cd ../docs && npx tsc --noEmit && npm run lint
```
Expected: tous les tests verts (les 81 existants de `ressources` + les nouveaux ~14), typecheck OK, lint OK pour les deux.

- [ ] **Step 3: Vérifier l'absence de dérive du schéma synchronisé**

Run: `bash scripts/sync-shared.sh && git diff --exit-code -- projects/docs/db projects/docs/lib/theme`
Expected: code de sortie 0 (aucune dérive).

- [ ] **Step 4: Push**

```bash
git push -u origin claude/kind-feynman-ctZPN
```

---

## Notes d'exécution

- `npx drizzle-kit generate` ne se connecte pas à la base (diff schéma ↔ journal de migrations) : OK sans `DATABASE_URL`.
- `lib/theme/` ne doit importer que `zod` (rester pur) pour être synchronisable et utilisable côté client (aperçu) comme serveur.
- Les noms de classes Tailwind `shadow-brutal*` sont conservés ; seules les valeurs des variables changent selon `shadowStyle` → aucun composant à toucher pour les ombres.
- Rétrocompatible : `theme = null` → preset `brutalist` = rendu actuel inchangé.
```
