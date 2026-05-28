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

const field = "w-full border-2 border-ink bg-paper px-2.5 py-1.5 text-sm"

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
        <select
          value={type}
          onChange={(e) => changeType(e.target.value)}
          className="border-2 border-foreground px-2 py-1 text-sm"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
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
          rows={(content.images as { url: string; caption?: string }[]) ?? []}
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

      <button
        type="submit"
        className="press border-2 border-ink bg-accent px-4 py-2 text-sm font-bold uppercase tracking-wide text-accent-ink shadow-brutal-sm"
      >
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
  const add = () => {
    if (rows.length < max) onChange([...rows, { ...empty }])
  }
  const remove = (i: number) => {
    if (rows.length > min) onChange(rows.filter((_, j) => j !== i))
  }
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
      <button type="button" onClick={add} className="border-2 border-foreground px-2 py-1 text-sm font-bold">
        + Ajouter
      </button>
    </div>
  )
}
