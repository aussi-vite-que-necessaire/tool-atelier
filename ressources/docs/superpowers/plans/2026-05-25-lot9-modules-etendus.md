# Lot 9 — Modules étendus (8 types) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter 8 types de modules (code, prompt, accordion, steps, comparison, quote, cta, gallery) avec coloration Shiki et édition admin dynamique complète.

**Architecture:** Chaque type = schéma Zod (`moduleContentSchemas`) + entrée d'union (`moduleInputSchema`) + composant de rendu + case du registre. `code` est colorisé par un singleton Shiki ; `code`/`prompt` ont un bouton « Copier » (client). Le `ModuleForm` admin est refondu : le composant client construit l'objet `content` en état et le sérialise en JSON ; les server actions valident via `validateModuleInput`. Aucune migration (`content` = jsonb).

**Tech Stack:** shiki, Zod, Next 16 (RSC async pour le code), Drizzle.

---

## Structure des fichiers

```
package.json                         + shiki
lib/modules/schemas.ts               + 8 schémas dans moduleContentSchemas
lib/resources/module-input.ts        + 8 entrées dans moduleInputSchema
lib/resources/module-input.test.ts   + cas valides/invalides
lib/modules/highlighter.ts           highlight(code, lang) via Shiki (fallback plaintext)
components/modules/copy-button.tsx    bouton Copier (client)
components/modules/code-module.tsx    (async) Shiki + Copier
components/modules/prompt-module.tsx
components/modules/accordion-module.tsx
components/modules/steps-module.tsx
components/modules/comparison-module.tsx
components/modules/quote-module.tsx
components/modules/cta-module.tsx
components/modules/gallery-module.tsx
components/modules/registry.tsx       + 8 cases
components/admin/module-form.tsx      refonte (content objet + JSON + éditeurs tableaux)
lib/actions/admin.ts                  add/updateModuleAction lisent content JSON + validateModuleInput
lib/admin/module-content.ts           SUPPRIMÉ (remplacé par validateModuleInput)
lib/admin/module-content.test.ts      SUPPRIMÉ
```

---

## Task 1: Schémas + union (TDD)

**Files:** Modify `package.json`, `lib/modules/schemas.ts`, `lib/resources/module-input.ts`, `lib/resources/module-input.test.ts`

- [ ] **Step 1: Ajouter shiki** : dans `package.json` dependencies `"shiki": "^1.24.0"`, puis `npm install`.

- [ ] **Step 2: Étendre les tests** `lib/resources/module-input.test.ts` (ajouter dans le `describe`)

```ts
  it("accepte les nouveaux types", () => {
    expect(validateModuleInput({ type: "code", content: { language: "ts", code: "const a=1" } }).type).toBe("code")
    expect(validateModuleInput({ type: "prompt", content: { prompt: "Fais X" } }).type).toBe("prompt")
    expect(validateModuleInput({ type: "accordion", content: { title: "T", md: "x" } }).type).toBe("accordion")
    expect(validateModuleInput({ type: "steps", content: { steps: [{ title: "S1", md: "x" }] } }).type).toBe("steps")
    expect(validateModuleInput({ type: "comparison", content: { columns: [{ title: "A", md: "x" }, { title: "B", md: "y" }] } }).type).toBe("comparison")
    expect(validateModuleInput({ type: "quote", content: { text: "citation" } }).type).toBe("quote")
    expect(validateModuleInput({ type: "cta", content: { label: "Go", url: "https://x.co" } }).type).toBe("cta")
    expect(validateModuleInput({ type: "gallery", content: { images: [{ url: "https://x.co/a.png" }] } }).type).toBe("gallery")
  })
  it("rejette les contenus invalides des nouveaux types", () => {
    expect(() => validateModuleInput({ type: "code", content: { code: "x" } })).toThrow() // language manquant
    expect(() => validateModuleInput({ type: "comparison", content: { columns: [{ title: "A", md: "x" }] } })).toThrow() // < 2 colonnes
    expect(() => validateModuleInput({ type: "cta", content: { label: "Go", url: "pas-url" } })).toThrow()
  })
```

- [ ] **Step 3: Lancer (échec attendu)** — `npx vitest run lib/resources/module-input.test.ts` → FAIL.

- [ ] **Step 4: Étendre `moduleContentSchemas`** dans `lib/modules/schemas.ts` (ajouter avant la fermeture `} as const`)

```ts
  code: z.object({ language: z.string(), code: z.string(), filename: z.string().optional() }),
  prompt: z.object({ prompt: z.string(), title: z.string().optional() }),
  accordion: z.object({ title: z.string(), md: z.string(), open: z.boolean().optional() }),
  steps: z.object({ steps: z.array(z.object({ title: z.string(), md: z.string() })).min(1) }),
  comparison: z.object({ columns: z.array(z.object({ title: z.string(), md: z.string() })).min(2).max(3) }),
  quote: z.object({ text: z.string(), author: z.string().optional(), source: z.string().optional(), url: z.string().url().optional() }),
  cta: z.object({ label: z.string(), url: z.string().url(), variant: z.enum(["primary", "secondary"]).optional() }),
  gallery: z.object({ images: z.array(z.object({ url: z.string().url(), alt: z.string().optional(), caption: z.string().optional() })).min(1) }),
```

- [ ] **Step 5: Étendre `moduleInputSchema`** dans `lib/resources/module-input.ts` (ajouter au tableau de la `z.discriminatedUnion`)

```ts
  z.object({ type: z.literal("code"), content: moduleContentSchemas.code }),
  z.object({ type: z.literal("prompt"), content: moduleContentSchemas.prompt }),
  z.object({ type: z.literal("accordion"), content: moduleContentSchemas.accordion }),
  z.object({ type: z.literal("steps"), content: moduleContentSchemas.steps }),
  z.object({ type: z.literal("comparison"), content: moduleContentSchemas.comparison }),
  z.object({ type: z.literal("quote"), content: moduleContentSchemas.quote }),
  z.object({ type: z.literal("cta"), content: moduleContentSchemas.cta }),
  z.object({ type: z.literal("gallery"), content: moduleContentSchemas.gallery }),
```

- [ ] **Step 6: Lancer (succès) + commit**

Run : `npm test`
Expected : PASS (les nouveaux cas inclus).

```bash
git add package.json package-lock.json lib/modules/schemas.ts lib/resources/module-input.ts lib/resources/module-input.test.ts
git commit -m "feat: schémas + union des 8 nouveaux types de modules"
```

---

## Task 2: Highlighter + bouton Copier

**Files:** Create `lib/modules/highlighter.ts`, `components/modules/copy-button.tsx`

- [ ] **Step 1: `lib/modules/highlighter.ts`**

```ts
import { codeToHtml } from "shiki"

export async function highlight(code: string, language: string): Promise<string> {
  try {
    return await codeToHtml(code, { lang: language, theme: "github-light" })
  } catch {
    return await codeToHtml(code, { lang: "text", theme: "github-light" })
  }
}
```

- [ ] **Step 2: `components/modules/copy-button.tsx`** (client)

```tsx
"use client"

import { useState } from "react"

export function CopyButton({ text, label = "Copier" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* presse-papier indisponible */
    }
  }
  return (
    <button type="button" onClick={copy} className="border-2 border-foreground px-2 py-1 text-xs font-bold">
      {copied ? "Copié ✓" : label}
    </button>
  )
}
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/modules/highlighter.ts components/modules/copy-button.tsx
git commit -m "feat: highlighter Shiki + bouton Copier"
```

---

## Task 3: Composants de rendu + registre

**Files:** Create les 8 `components/modules/*-module.tsx` ; Modify `components/modules/registry.tsx`

- [ ] **Step 1: `code-module.tsx`** (async)

```tsx
import { highlight } from "@/lib/modules/highlighter"
import { CopyButton } from "./copy-button"

export async function CodeModule({ language, code, filename }: { language: string; code: string; filename?: string }) {
  const html = await highlight(code, language)
  return (
    <figure className="my-6 border-2 border-foreground">
      <figcaption className="flex items-center justify-between border-b-2 border-foreground px-3 py-1 text-xs font-bold uppercase">
        <span>{filename ?? language}</span>
        <CopyButton text={code} />
      </figcaption>
      <div className="overflow-x-auto p-3 text-sm" dangerouslySetInnerHTML={{ __html: html }} />
    </figure>
  )
}
```

- [ ] **Step 2: `prompt-module.tsx`**

```tsx
import { CopyButton } from "./copy-button"

export function PromptModule({ prompt, title }: { prompt: string; title?: string }) {
  return (
    <figure className="my-6 border-4 border-foreground">
      <figcaption className="flex items-center justify-between border-b-2 border-foreground px-3 py-1 text-xs font-extrabold uppercase">
        <span>{title ?? "Prompt"}</span>
        <CopyButton text={prompt} label="Copier le prompt" />
      </figcaption>
      <pre className="overflow-x-auto whitespace-pre-wrap p-3 font-mono text-sm">{prompt}</pre>
    </figure>
  )
}
```

- [ ] **Step 3: `accordion-module.tsx`**

```tsx
import { Markdown } from "@/components/reader/markdown"

export function AccordionModule({ title, md, open }: { title: string; md: string; open?: boolean }) {
  return (
    <details className="my-4 border-2 border-foreground p-3" open={open ?? false}>
      <summary className="cursor-pointer font-bold">{title}</summary>
      <div className="mt-2">
        <Markdown>{md}</Markdown>
      </div>
    </details>
  )
}
```

- [ ] **Step 4: `steps-module.tsx`**

```tsx
import { Markdown } from "@/components/reader/markdown"

export function StepsModule({ steps }: { steps: { title: string; md: string }[] }) {
  return (
    <ol className="my-6 space-y-5">
      {steps.map((s, i) => (
        <li key={i} className="border-l-4 border-foreground pl-4">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black">{i + 1}</span>
            <h3 className="text-lg font-bold">{s.title}</h3>
          </div>
          <div className="mt-1">
            <Markdown>{s.md}</Markdown>
          </div>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 5: `comparison-module.tsx`** (classes de colonnes statiques)

```tsx
import { Markdown } from "@/components/reader/markdown"

export function ComparisonModule({ columns }: { columns: { title: string; md: string }[] }) {
  const cols = columns.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
  return (
    <div className={`my-6 grid grid-cols-1 gap-4 ${cols}`}>
      {columns.map((c, i) => (
        <div key={i} className="border-2 border-foreground p-3">
          <h3 className="mb-2 border-b-2 border-foreground pb-1 font-extrabold uppercase">{c.title}</h3>
          <Markdown>{c.md}</Markdown>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: `quote-module.tsx`**

```tsx
export function QuoteModule({
  text,
  author,
  source,
  url,
}: {
  text: string
  author?: string
  source?: string
  url?: string
}) {
  return (
    <figure className="my-6 border-l-4 border-foreground pl-4">
      <blockquote className="text-lg italic">“{text}”</blockquote>
      {(author || source) && (
        <figcaption className="mt-2 text-sm font-bold">
          {author}
          {author && source ? " — " : ""}
          {url ? (
            <a href={url} target="_blank" rel="noreferrer" className="underline">
              {source}
            </a>
          ) : (
            source
          )}
        </figcaption>
      )}
    </figure>
  )
}
```

- [ ] **Step 7: `cta-module.tsx`**

```tsx
export function CtaModule({ label, url, variant }: { label: string; url: string; variant?: "primary" | "secondary" }) {
  const cls =
    variant === "secondary"
      ? "border-2 border-foreground"
      : "border-4 border-foreground bg-foreground text-background"
  return (
    <div className="my-6">
      <a href={url} target="_blank" rel="noreferrer" className={`inline-block px-5 py-3 font-bold ${cls}`}>
        {label}
      </a>
    </div>
  )
}
```

- [ ] **Step 8: `gallery-module.tsx`**

```tsx
export function GalleryModule({ images }: { images: { url: string; alt?: string; caption?: string }[] }) {
  return (
    <div className="my-6 grid grid-cols-2 gap-3 md:grid-cols-3">
      {images.map((img, i) => (
        <figure key={i}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img.url} alt={img.alt ?? ""} className="w-full border-2 border-foreground" />
          {img.caption && <figcaption className="mt-1 text-xs text-muted-foreground">{img.caption}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
```

- [ ] **Step 9: Étendre `components/modules/registry.tsx`** (imports + cases)

Ajouter les imports des 8 composants, puis dans le `switch (module.type)` :

```tsx
    case "code":
      return <CodeModule {...module.content} />
    case "prompt":
      return <PromptModule {...module.content} />
    case "accordion":
      return <AccordionModule {...module.content} />
    case "steps":
      return <StepsModule {...module.content} />
    case "comparison":
      return <ComparisonModule {...module.content} />
    case "quote":
      return <QuoteModule {...module.content} />
    case "cta":
      return <CtaModule {...module.content} />
    case "gallery":
      return <GalleryModule {...module.content} />
```

- [ ] **Step 10: Typecheck + build + commit**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur (le `switch` reste exhaustif sur l'union ; `CodeModule` async est rendu côté serveur).

```bash
git add components/modules/
git commit -m "feat: composants de rendu des 8 nouveaux modules + registre"
```

---

## Task 4: Refonte du ModuleForm admin (flux JSON unifié)

**Files:** Modify `components/admin/module-form.tsx`, `lib/actions/admin.ts` ; Delete `lib/admin/module-content.ts`, `lib/admin/module-content.test.ts`

- [ ] **Step 1: Remplacer `components/admin/module-form.tsx`** (content objet + champ JSON caché + éditeurs par type)

```tsx
"use client"

import { useState } from "react"

type Content = Record<string, unknown>
type ModuleData = { id?: string; type: string; content: Content }

const TYPES = [
  "markdown", "callout", "image", "video", "file", "embed",
  "code", "prompt", "accordion", "steps", "comparison", "quote", "cta", "gallery",
]

function defaultContent(type: string): Content {
  switch (type) {
    case "markdown": return { md: "" }
    case "callout": return { variant: "info", md: "" }
    case "image": return { url: "" }
    case "video": return { url: "" }
    case "file": return { url: "", label: "", filename: "" }
    case "embed": return { url: "" }
    case "code": return { language: "ts", code: "" }
    case "prompt": return { prompt: "" }
    case "accordion": return { title: "", md: "" }
    case "steps": return { steps: [{ title: "", md: "" }] }
    case "comparison": return { columns: [{ title: "", md: "" }, { title: "", md: "" }] }
    case "quote": return { text: "" }
    case "cta": return { label: "", url: "", variant: "primary" }
    case "gallery": return { images: [{ url: "" }] }
    default: return {}
  }
}

const field = "w-full border-2 border-foreground px-2 py-1 text-sm"

export function ModuleForm({
  action,
  resourceSlug,
  path,
  module,
}: {
  action: (formData: FormData) => void | Promise<void>
  resourceSlug: string
  path: string[]
  module?: ModuleData
}) {
  const [type, setType] = useState(module?.type ?? "markdown")
  const [content, setContent] = useState<Content>(module?.content ?? defaultContent(module?.type ?? "markdown"))
  const editing = !!module?.id
  const c = content as Record<string, string>

  function changeType(t: string) {
    setType(t)
    setContent(defaultContent(t))
  }
  const set = (patch: Content) => setContent((cur) => ({ ...cur, ...patch }))

  return (
    <form action={action} className="space-y-2 border-2 border-foreground p-3">
      <input type="hidden" name="resourceSlug" value={resourceSlug} />
      <input type="hidden" name="path" value={path.join("/")} />
      {editing && <input type="hidden" name="id" value={module!.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="content" value={JSON.stringify(content)} />

      {editing ? (
        <div className="text-xs font-bold uppercase">{type}</div>
      ) : (
        <select value={type} onChange={(e) => changeType(e.target.value)} className="border-2 border-foreground px-2 py-1 text-sm">
          {TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      )}

      {(type === "markdown" || type === "accordion") && (
        <>
          {type === "accordion" && (
            <input value={c.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="Titre" className={field} />
          )}
          <textarea value={c.md ?? ""} onChange={(e) => set({ md: e.target.value })} rows={5} className={field} placeholder="Markdown…" />
        </>
      )}
      {type === "callout" && (
        <>
          <select value={c.variant ?? "info"} onChange={(e) => set({ variant: e.target.value })} className="border-2 border-foreground px-2 py-1 text-sm">
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="success">success</option>
          </select>
          <textarea value={c.md ?? ""} onChange={(e) => set({ md: e.target.value })} rows={4} className={field} placeholder="Markdown…" />
        </>
      )}
      {(type === "image" || type === "video" || type === "file" || type === "embed") && (
        <input value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="URL (R2 / externe)" className={field} />
      )}
      {type === "image" && (
        <>
          <input value={c.alt ?? ""} onChange={(e) => set({ alt: e.target.value })} placeholder="alt" className={field} />
          <input value={c.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} placeholder="légende" className={field} />
        </>
      )}
      {type === "video" && (
        <input value={c.caption ?? ""} onChange={(e) => set({ caption: e.target.value })} placeholder="légende" className={field} />
      )}
      {type === "file" && (
        <>
          <input value={c.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="libellé" className={field} />
          <input value={c.filename ?? ""} onChange={(e) => set({ filename: e.target.value })} placeholder="nom de fichier" className={field} />
        </>
      )}
      {type === "code" && (
        <>
          <input value={c.language ?? ""} onChange={(e) => set({ language: e.target.value })} placeholder="langage (ts, bash, python…)" className={field} />
          <input value={c.filename ?? ""} onChange={(e) => set({ filename: e.target.value })} placeholder="nom de fichier (optionnel)" className={field} />
          <textarea value={c.code ?? ""} onChange={(e) => set({ code: e.target.value })} rows={6} className={`${field} font-mono`} placeholder="code…" />
        </>
      )}
      {type === "prompt" && (
        <>
          <input value={c.title ?? ""} onChange={(e) => set({ title: e.target.value })} placeholder="titre (optionnel)" className={field} />
          <textarea value={c.prompt ?? ""} onChange={(e) => set({ prompt: e.target.value })} rows={6} className={`${field} font-mono`} placeholder="prompt à copier…" />
        </>
      )}
      {type === "quote" && (
        <>
          <textarea value={c.text ?? ""} onChange={(e) => set({ text: e.target.value })} rows={3} className={field} placeholder="citation" />
          <input value={c.author ?? ""} onChange={(e) => set({ author: e.target.value })} placeholder="auteur" className={field} />
          <input value={c.source ?? ""} onChange={(e) => set({ source: e.target.value })} placeholder="source" className={field} />
          <input value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="url (optionnel)" className={field} />
        </>
      )}
      {type === "cta" && (
        <>
          <input value={c.label ?? ""} onChange={(e) => set({ label: e.target.value })} placeholder="libellé du bouton" className={field} />
          <input value={c.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder="url" className={field} />
          <select value={c.variant ?? "primary"} onChange={(e) => set({ variant: e.target.value })} className="border-2 border-foreground px-2 py-1 text-sm">
            <option value="primary">primary</option>
            <option value="secondary">secondary</option>
          </select>
        </>
      )}

      {type === "steps" && (
        <RowsEditor
          rows={(content.steps as { title: string; md: string }[]) ?? []}
          onChange={(rows) => set({ steps: rows })}
          empty={{ title: "", md: "" }}
          render={(row, upd) => (
            <>
              <input value={row.title} onChange={(e) => upd({ title: e.target.value })} placeholder="titre de l'étape" className={field} />
              <textarea value={row.md} onChange={(e) => upd({ md: e.target.value })} rows={3} className={field} placeholder="contenu (markdown)" />
            </>
          )}
        />
      )}
      {type === "comparison" && (
        <RowsEditor
          rows={(content.columns as { title: string; md: string }[]) ?? []}
          onChange={(rows) => set({ columns: rows })}
          empty={{ title: "", md: "" }}
          min={2}
          max={3}
          render={(row, upd) => (
            <>
              <input value={row.title} onChange={(e) => upd({ title: e.target.value })} placeholder="titre de colonne" className={field} />
              <textarea value={row.md} onChange={(e) => upd({ md: e.target.value })} rows={3} className={field} placeholder="contenu (markdown)" />
            </>
          )}
        />
      )}
      {type === "gallery" && (
        <RowsEditor
          rows={(content.images as { url: string; alt?: string; caption?: string }[]) ?? []}
          onChange={(rows) => set({ images: rows })}
          empty={{ url: "" }}
          render={(row, upd) => (
            <>
              <input value={row.url} onChange={(e) => upd({ url: e.target.value })} placeholder="url image (R2)" className={field} />
              <input value={row.caption ?? ""} onChange={(e) => upd({ caption: e.target.value })} placeholder="légende" className={field} />
            </>
          )}
        />
      )}

      <button type="submit" className="border-4 border-foreground bg-foreground px-3 py-1 font-bold text-background">
        {editing ? "Enregistrer" : "Ajouter le module"}
      </button>
    </form>
  )
}

function RowsEditor<T>({
  rows,
  onChange,
  empty,
  render,
  min = 1,
  max = 99,
}: {
  rows: T[]
  onChange: (rows: T[]) => void
  empty: T
  render: (row: T, upd: (patch: Partial<T>) => void) => React.ReactNode
  min?: number
  max?: number
}) {
  const upd = (i: number, patch: Partial<T>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const add = () => rows.length < max && onChange([...rows, { ...empty }])
  const remove = (i: number) => rows.length > min && onChange(rows.filter((_, j) => j !== i))
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= rows.length) return
    const next = [...rows]
    ;[next[i], next[j]] = [next[j], next[i]]
    onChange(next)
  }
  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="space-y-1 border-2 border-dashed border-foreground p-2">
          <div className="flex justify-end gap-1 text-xs">
            <button type="button" onClick={() => move(i, -1)} className="border-2 border-foreground px-1 font-bold">↑</button>
            <button type="button" onClick={() => move(i, 1)} className="border-2 border-foreground px-1 font-bold">↓</button>
            <button type="button" onClick={() => remove(i)} className="border-2 border-foreground px-1 font-bold">✕</button>
          </div>
          {render(row, (patch) => upd(i, patch))}
        </div>
      ))}
      <button type="button" onClick={add} className="border-2 border-foreground px-2 py-1 text-sm font-bold">+ Ajouter</button>
    </div>
  )
}
```

- [ ] **Step 2: Adapter les server actions** dans `lib/actions/admin.ts` : remplacer l'usage de `buildModuleContent` par lecture du champ `content` (JSON) + `validateModuleInput`

Remplacer l'import :
```ts
import { validateModuleInput } from "@/lib/resources/module-input"
```
(retirer `import { buildModuleContent } from "@/lib/admin/module-content"`)

`addModuleAction` :
```ts
export async function addModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const module = validateModuleInput({ type: str(fd, "type"), content: JSON.parse(str(fd, "content") ?? "{}") })
  await service.addModule({ resourceSlug: slug, path: parsePath(str(fd, "path")), module })
  revalidateResource(slug)
}
```

`updateModuleAction` :
```ts
export async function updateModuleAction(fd: FormData) {
  await requireAdmin()
  const slug = str(fd, "resourceSlug")!
  const module = validateModuleInput({ type: str(fd, "type"), content: JSON.parse(str(fd, "content") ?? "{}") })
  await service.updateModule({ id: str(fd, "id")!, content: module.content })
  revalidateResource(slug)
}
```

- [ ] **Step 3: Supprimer le module obsolète**

```bash
git rm lib/admin/module-content.ts lib/admin/module-content.test.ts
```

- [ ] **Step 4: Typecheck + lint + build + commit**

Run : `npm run typecheck && npm run lint && npm run build`
Expected : aucune erreur ; `buildModuleContent` n'est plus référencé.

```bash
git add components/admin/module-form.tsx lib/actions/admin.ts
git commit -m "refactor: ModuleForm en flux JSON unifié (8 types + éditeurs de tableaux)"
```

---

## Task 5: Vérification + déploiement

- [ ] **Step 1: Tests/gates locaux**

Run : `npm test && npm run typecheck && npm run lint && npm run build`
Expected : tout vert.

- [ ] **Step 2: Smoke service (test d'intégration jetable, base locale)** — créer un module de chaque nouveau type et vérifier qu'il est validé et lisible via `getResource`

```ts
// lib/resources/lot9.smoke.test.ts (jetable)
import { describe, it, expect } from "vitest"
import * as s from "./service"
describe("lot9 smoke", () => {
  it("crée et relit les nouveaux types", async () => {
    const r = await s.createResource({ title: "Lot9 " + Date.now(), published: true })
    try {
      await s.addModules({ resourceSlug: r.slug, path: [], modules: [
        { type: "code", content: { language: "ts", code: "const a = 1" } },
        { type: "prompt", content: { prompt: "Fais X" } },
        { type: "accordion", content: { title: "FAQ", md: "réponse" } },
        { type: "steps", content: { steps: [{ title: "Étape 1", md: "x" }] } },
        { type: "comparison", content: { columns: [{ title: "A", md: "x" }, { title: "B", md: "y" }] } },
        { type: "quote", content: { text: "citation", author: "Manu" } },
        { type: "cta", content: { label: "Go", url: "https://avqn.ch" } },
        { type: "gallery", content: { images: [{ url: "https://placehold.co/600x400" }] } },
      ] })
      const g = (await s.getResource(r.slug)) as { root: { modules: { type: string }[] } }
      expect(g.root.modules.map((m) => m.type)).toEqual(["code","prompt","accordion","steps","comparison","quote","cta","gallery"])
    } finally {
      await s.deleteResource(r.slug)
    }
  })
})
```
Run : `DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" npx vitest run lib/resources/lot9.smoke.test.ts`
Expected : PASS. Puis supprimer le fichier jetable : `rm lib/resources/lot9.smoke.test.ts`.

- [ ] **Step 3: Vérif visuelle rapide** (optionnel) — `npm run db:seed` ne couvre pas ces types ; on s'appuiera sur le rendu en prod via une ressource créée par l'agent.

- [ ] **Step 4: Push + redéploiement (aucune migration)**

```bash
git push origin main
cd ~/Code/cockpit && set -a && . ./.env && set +a
URL="$(bin/secret-get COOLIFY_URL)"; TOK="$(bin/secret-get COOLIFY_TOKEN)"
DEP=$(curl -fsS -H "Authorization: Bearer $TOK" "$URL/api/v1/deploy?uuid=m88ck0gg4sgcs0kkggwgoggs" | jq -r '.deployments[0].deployment_uuid')
# poll jusqu'à finished, puis :
curl -s -o /dev/null -w "/ : %{http_code}\n" https://ressources.avqn.ch/
```

- [ ] **Step 5: Test final** : reconnecter le connecteur Claude.ai (nouveaux types disponibles), créer une ressource utilisant code/prompt/accordion/steps/comparison/quote/cta/gallery, vérifier le rendu (coloration + bouton copier, accordéon, etc.) et l'édition dans `/admin`.

---

## Self-review (couverture spec → plan)

- 8 schémas + union → Task 1. ✓
- Shiki (singleton via codeToHtml + fallback) + bouton Copier → Task 2. ✓
- 8 composants de rendu + registre → Task 3. ✓
- ModuleForm dynamique (tous types + éditeurs de tableaux steps/comparison/gallery) → Task 4. ✓
- Flux JSON unifié + actions via validateModuleInput, suppression de buildModuleContent → Task 4. ✓
- Tests d'union étendus + smoke → Tasks 1, 5. ✓
- Aucune migration, redéploiement → Task 5. ✓

Cohérence : `moduleContentSchemas` (schemas.ts) consommé par `moduleInputSchema` (module-input.ts) et le typage `ParsedModule` du registre ; `validateModuleInput` réutilisé par les actions admin ; `CopyButton` partagé code/prompt ; `highlight` utilisé par CodeModule ; `RowsEditor` générique pour steps/comparison/gallery. Le `switch` du registre reste exhaustif sur l'union étendue (le typecheck le garantit).

**Risque :** taille de shiki au build Docker (acceptable) ; `codeToHtml` async dans un RSC (supporté). Le rendu de `module.content` typé : le registre passe `{...module.content}` — l'union discriminée garantit le bon type par case.
```
