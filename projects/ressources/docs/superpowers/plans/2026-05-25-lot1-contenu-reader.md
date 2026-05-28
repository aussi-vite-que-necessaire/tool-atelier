# Lot 1 — Contenu modulaire + reader public — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Servir une ressource modulaire (arbre de pages, modules typés) sur `/r/<slug>` via un reader SSR brutaliste N&B, contenu inséré par seed.

**Architecture:** App Next.js 16 (App Router) unique, déployable sur Coolify. Postgres via Drizzle. Le contenu d'une page est une liste de `modules` typés ; chaque type a un schéma Zod (source de vérité de la forme) et un composant de rendu, reliés par un registre. La logique structurante (arbre de pages, résolution de chemin, sommaire) est isolée en fonctions pures testées. Le reader assemble arbre (gauche) + modules (centre) + sommaire (droite).

**Tech Stack:** Next.js 16, React 19, TypeScript, Drizzle ORM + postgres (porsager), Zod, Tailwind v4 + shadcn tokens + Geist, react-markdown + remark-gfm + rehype-sanitize + rehype-slug + github-slugger, Vitest.

**Conventions maison reprises** (du starter `avqn-starter-kit`) : alias `@/*` → racine, schéma Drizzle en `db/schema/index.ts`, client en `db/index.ts`, `cn()` en `lib/utils.ts`, tokens shadcn neutres oklch dans `app/globals.css`, police Geist. **Non reprises** : workflow `avqn-mvp`, `.avqn/`, slash commands, `CLAUDE.md` du starter.

---

## Structure des fichiers

```
package.json, tsconfig.json, next.config.ts, postcss.config.mjs,
eslint.config.mjs, components.json, vitest.config.ts          config
docker-compose.yml                                            Postgres local (dev)
Dockerfile, .dockerignore                                     image app (Coolify)
.env.example                                                  DATABASE_URL (+ R2/Resend réservés lots suivants)
app/layout.tsx                                                root layout (Geist, globals)
app/globals.css                                               tailwind + tokens + base brutaliste
app/page.tsx                                                  index minimal (liste ressources publiées)
app/(public)/r/[slug]/page.tsx                                reader — page racine
app/(public)/r/[slug]/[...path]/page.tsx                      reader — sous-page
db/schema/index.ts                                            tables resources/pages/modules
db/index.ts                                                   client drizzle
db/seed.ts                                                    seed ressource de démo
drizzle.config.ts                                             config migrations
lib/utils.ts                                                  cn()
lib/modules/schemas.ts                                        union Zod des 6 types + parseModule (pur, sans React)
lib/content/tree.ts                                           buildPageTree (pur)
lib/content/resolve.ts                                        resolvePageByPath (pur)
lib/content/toc.ts                                            extractToc (pur)
lib/content/queries.ts                                        getResourceBySlug, listPublishedResources (Drizzle)
components/modules/registry.tsx                               map type → composant
components/modules/*.tsx                                      un composant par type
components/reader/reader-shell.tsx                            layout 3 colonnes
components/reader/page-tree.tsx                               arbre de navigation (gauche)
components/reader/toc.tsx                                     sommaire (droite)
components/reader/markdown.tsx                                rendu markdown partagé (GFM, sanitize, slug)
lib/content/tree.test.ts, resolve.test.ts, toc.test.ts        tests purs
lib/modules/schemas.test.ts                                   tests validation modules
```

---

## Task 0: Scaffold du projet et config

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `components.json`, `vitest.config.ts`, `app/globals.css`, `app/layout.tsx`, `lib/utils.ts`, `.env.example`, `docker-compose.yml`

- [ ] **Step 1: Écrire `package.json`**

```json
{
  "name": "lab-ressources",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs generate",
    "db:push": "node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push",
    "db:studio": "node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs studio",
    "db:seed": "node --env-file=.env.local --experimental-strip-types db/seed.ts"
  },
  "dependencies": {
    "next": "16.2.6",
    "react": "19.2.4",
    "react-dom": "19.2.4",
    "drizzle-orm": "^0.45.2",
    "postgres": "^3.4.9",
    "zod": "^4.4.3",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.6.0",
    "class-variance-authority": "^0.7.1",
    "geist": "^1.7.0",
    "lucide-react": "^1.16.0",
    "react-markdown": "^9.0.1",
    "remark-gfm": "^4.0.0",
    "rehype-sanitize": "^6.0.0",
    "rehype-slug": "^6.0.0",
    "github-slugger": "^2.0.0"
  },
  "devDependencies": {
    "typescript": "^5",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "tailwindcss": "^4",
    "@tailwindcss/postcss": "^4",
    "tw-animate-css": "^1.4.0",
    "shadcn": "^4.7.0",
    "drizzle-kit": "^0.31.10",
    "eslint": "^9",
    "eslint-config-next": "16.2.6",
    "vitest": "^4.1.7"
  }
}
```

- [ ] **Step 2: Écrire les configs**

`tsconfig.json` (repris du starter) :

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.ts` (sortie standalone pour Docker) :

```ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
}

export default nextConfig
```

`postcss.config.mjs` :

```js
const config = { plugins: { "@tailwindcss/postcss": {} } }
export default config
```

`eslint.config.mjs` :

```js
import { dirname } from "path"
import { fileURLToPath } from "url"
import { FlatCompat } from "@eslint/eslintrc"

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
const compat = new FlatCompat({ baseDirectory: __dirname })

export default [...compat.extends("next/core-web-vitals", "next/typescript")]
```

`components.json` :

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "radix-nova",
  "rsc": true,
  "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true, "prefix": "" },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "utils": "@/lib/utils", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks" }
}
```

`vitest.config.ts` :

```ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { environment: "node", include: ["**/*.test.ts"] },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
})
```

- [ ] **Step 3: Écrire `lib/utils.ts`**

```ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- [ ] **Step 4: Écrire `app/globals.css`** — tokens shadcn neutres + base brutaliste (rayon 0, bordures nettes).

```css
@import "tailwindcss";
@import "tw-animate-css";
@import "shadcn/tailwind.css";

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-border: var(--border);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --font-sans: var(--font-geist-sans);
}

:root {
  --background: oklch(1 0 0);
  --foreground: oklch(0.145 0 0);
  --muted: oklch(0.97 0 0);
  --muted-foreground: oklch(0.45 0 0);
  --border: oklch(0.145 0 0);
  --accent: oklch(0.145 0 0);
  --accent-foreground: oklch(0.985 0 0);
  --radius: 0;
}

* { border-color: var(--border); }
body { background: var(--background); color: var(--foreground); }
```

- [ ] **Step 5: Écrire `app/layout.tsx`**

```tsx
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import "./globals.css"

export const metadata: Metadata = {
  title: "Ressources",
  description: "Ressources pour approfondir l'IA, l'automatisation et le cloud.",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={GeistSans.variable}>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  )
}
```

- [ ] **Step 6: Écrire `.env.example` et `docker-compose.yml`**

`.env.example` :

```
# Postgres
DATABASE_URL=postgres://ressources:ressources@localhost:5432/ressources
# Réservés aux lots suivants
# RESEND_API_KEY=
# R2_PUBLIC_BASE_URL=
```

`docker-compose.yml` (Postgres local de dev uniquement) :

```yaml
services:
  db:
    image: postgres:17
    environment:
      POSTGRES_USER: ressources
      POSTGRES_PASSWORD: ressources
      POSTGRES_DB: ressources
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
volumes:
  pgdata:
```

- [ ] **Step 7: Installer et vérifier**

Run :
```bash
npm install
cp .env.example .env.local
docker compose up -d
npm run typecheck
```
Expected : `npm install` OK, `typecheck` sans erreur (aucun fichier applicatif fautif encore).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next 16 + Tailwind + Drizzle config (lot 1)"
```

---

## Task 1: Schéma de base de données

**Files:**
- Create: `db/schema/index.ts`, `db/index.ts`, `drizzle.config.ts`

- [ ] **Step 1: Écrire `db/schema/index.ts`**

```ts
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, unique } from "drizzle-orm/pg-core"

export const resources = pgTable("resources", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  description: text("description"),
  coverImageUrl: text("cover_image_url"),
  visibility: text("visibility").notNull().default("public"),
  published: boolean("published").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export const pages = pgTable(
  "pages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    resourceId: uuid("resource_id").notNull().references(() => resources.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): any => pages.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    position: integer("position").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pages_resource_parent_slug").on(t.resourceId, t.parentId, t.slug)],
)

export const modules = pgTable("modules", {
  id: uuid("id").defaultRandom().primaryKey(),
  pageId: uuid("page_id").notNull().references(() => pages.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  position: integer("position").notNull().default(0),
  content: jsonb("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})

export type ResourceRow = typeof resources.$inferSelect
export type PageRow = typeof pages.$inferSelect
export type ModuleRow = typeof modules.$inferSelect
```

- [ ] **Step 2: Écrire `db/index.ts`**

```ts
import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"
import * as schema from "./schema"

const client = postgres(process.env.DATABASE_URL!, { prepare: false })

export const db = drizzle(client, { schema })
```

- [ ] **Step 3: Écrire `drizzle.config.ts`**

```ts
import { defineConfig } from "drizzle-kit"

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 4: Pousser le schéma et vérifier**

Run :
```bash
npm run db:push
```
Expected : tables `resources`, `pages`, `modules` créées (drizzle-kit confirme « Changes applied »).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: schéma resources/pages/modules (Drizzle)"
```

---

## Task 2: Schémas Zod des modules + parseModule (TDD)

**Files:**
- Create: `lib/modules/schemas.ts`, `lib/modules/schemas.test.ts`

- [ ] **Step 1: Écrire le test `lib/modules/schemas.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { parseModule, moduleContentSchemas } from "./schemas"

describe("parseModule", () => {
  it("valide un module markdown", () => {
    const m = parseModule({ id: "1", type: "markdown", position: 0, content: { md: "# Hi" } })
    expect(m).toEqual({ id: "1", type: "markdown", position: 0, content: { md: "# Hi" } })
  })

  it("valide un callout avec variant", () => {
    const m = parseModule({ id: "2", type: "callout", position: 1, content: { variant: "info", md: "x" } })
    expect(m?.type).toBe("callout")
  })

  it("valide image / video / file / embed", () => {
    expect(parseModule({ id: "a", type: "image", position: 0, content: { url: "https://r2/x.png" } })).not.toBeNull()
    expect(parseModule({ id: "b", type: "video", position: 0, content: { url: "https://r2/x.mp4" } })).not.toBeNull()
    expect(parseModule({ id: "c", type: "file", position: 0, content: { url: "https://r2/x.zip", label: "DL", filename: "x.zip" } })).not.toBeNull()
    expect(parseModule({ id: "d", type: "embed", position: 0, content: { url: "https://youtu.be/x" } })).not.toBeNull()
  })

  it("renvoie null pour un type inconnu", () => {
    expect(parseModule({ id: "x", type: "wat", position: 0, content: {} })).toBeNull()
  })

  it("renvoie null si content invalide", () => {
    expect(parseModule({ id: "y", type: "markdown", position: 0, content: { nope: 1 } })).toBeNull()
    expect(parseModule({ id: "z", type: "callout", position: 0, content: { variant: "danger", md: "x" } })).toBeNull()
  })

  it("expose un schéma par type", () => {
    expect(Object.keys(moduleContentSchemas).sort()).toEqual(
      ["callout", "embed", "file", "image", "markdown", "video"].sort(),
    )
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npx vitest run lib/modules/schemas.test.ts`
Expected : FAIL (`schemas` introuvable).

- [ ] **Step 3: Écrire `lib/modules/schemas.ts`**

```ts
import { z } from "zod"

export const moduleContentSchemas = {
  markdown: z.object({ md: z.string() }),
  callout: z.object({ variant: z.enum(["info", "warn", "success"]), md: z.string() }),
  image: z.object({ url: z.string().url(), alt: z.string().optional(), caption: z.string().optional() }),
  video: z.object({ url: z.string().url(), caption: z.string().optional() }),
  file: z.object({ url: z.string().url(), label: z.string(), filename: z.string(), size: z.number().optional() }),
  embed: z.object({ url: z.string().url() }),
} as const

export type ModuleType = keyof typeof moduleContentSchemas

export type ModuleContent = {
  [K in ModuleType]: { type: K; content: z.infer<(typeof moduleContentSchemas)[K]> }
}[ModuleType]

export type ParsedModule = ModuleContent & { id: string; position: number }

type RawModule = { id: string; type: string; position: number; content: unknown }

export function parseModule(row: RawModule): ParsedModule | null {
  const schema = moduleContentSchemas[row.type as ModuleType]
  if (!schema) return null
  const parsed = schema.safeParse(row.content)
  if (!parsed.success) return null
  return { id: row.id, type: row.type, position: row.position, content: parsed.data } as ParsedModule
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run : `npx vitest run lib/modules/schemas.test.ts`
Expected : PASS (7 assertions).

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: schémas Zod des modules + parseModule"
```

---

## Task 3: Construction de l'arbre de pages (TDD)

**Files:**
- Create: `lib/content/tree.ts`, `lib/content/tree.test.ts`

- [ ] **Step 1: Écrire le test `lib/content/tree.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buildPageTree, type TreePage } from "./tree"

const rows = [
  { id: "root", parentId: null, slug: "", title: "Racine", position: 0 },
  { id: "b", parentId: "root", slug: "b", title: "B", position: 1 },
  { id: "a", parentId: "root", slug: "a", title: "A", position: 0 },
  { id: "a1", parentId: "a", slug: "a1", title: "A1", position: 0 },
]

describe("buildPageTree", () => {
  it("retourne la page racine (parentId null)", () => {
    const tree = buildPageTree(rows)
    expect(tree?.id).toBe("root")
  })

  it("trie les enfants par position", () => {
    const tree = buildPageTree(rows) as TreePage
    expect(tree.children.map((c) => c.id)).toEqual(["a", "b"])
  })

  it("imbrique les sous-pages", () => {
    const tree = buildPageTree(rows) as TreePage
    expect(tree.children[0].children[0].id).toBe("a1")
  })

  it("retourne null si aucune racine", () => {
    expect(buildPageTree([{ id: "x", parentId: "y", slug: "x", title: "X", position: 0 }])).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npx vitest run lib/content/tree.test.ts`
Expected : FAIL (`tree` introuvable).

- [ ] **Step 3: Écrire `lib/content/tree.ts`**

```ts
export type FlatPage = { id: string; parentId: string | null; slug: string; title: string; position: number }
export type TreePage = FlatPage & { children: TreePage[] }

export function buildPageTree(pages: FlatPage[]): TreePage | null {
  const nodes = new Map<string, TreePage>()
  for (const p of pages) nodes.set(p.id, { ...p, children: [] })

  let root: TreePage | null = null
  for (const node of nodes.values()) {
    if (node.parentId === null) {
      root = node
    } else {
      nodes.get(node.parentId)?.children.push(node)
    }
  }

  const sortRec = (n: TreePage) => {
    n.children.sort((a, b) => a.position - b.position)
    n.children.forEach(sortRec)
  }
  if (root) sortRec(root)
  return root
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run : `npx vitest run lib/content/tree.test.ts`
Expected : PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: buildPageTree (arbre de pages)"
```

---

## Task 4: Résolution d'un chemin de slugs vers une page (TDD)

**Files:**
- Create: `lib/content/resolve.ts`, `lib/content/resolve.test.ts`

- [ ] **Step 1: Écrire le test `lib/content/resolve.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { buildPageTree } from "./tree"
import { resolvePageByPath } from "./resolve"

const tree = buildPageTree([
  { id: "root", parentId: null, slug: "", title: "Racine", position: 0 },
  { id: "a", parentId: "root", slug: "a", title: "A", position: 0 },
  { id: "a1", parentId: "a", slug: "a1", title: "A1", position: 0 },
])!

describe("resolvePageByPath", () => {
  it("chemin vide → racine", () => {
    expect(resolvePageByPath(tree, [])?.id).toBe("root")
  })
  it("résout un chemin imbriqué", () => {
    expect(resolvePageByPath(tree, ["a", "a1"])?.id).toBe("a1")
  })
  it("retourne null pour un slug inconnu", () => {
    expect(resolvePageByPath(tree, ["a", "nope"])).toBeNull()
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npx vitest run lib/content/resolve.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/content/resolve.ts`**

```ts
import type { TreePage } from "./tree"

export function resolvePageByPath(root: TreePage, path: string[]): TreePage | null {
  let current: TreePage = root
  for (const slug of path) {
    const next = current.children.find((c) => c.slug === slug)
    if (!next) return null
    current = next
  }
  return current
}

export function pagePath(root: TreePage, targetId: string): string[] | null {
  const walk = (node: TreePage, acc: string[]): string[] | null => {
    if (node.id === targetId) return acc
    for (const child of node.children) {
      const found = walk(child, [...acc, child.slug])
      if (found) return found
    }
    return null
  }
  return walk(root, [])
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run : `npx vitest run lib/content/resolve.test.ts`
Expected : PASS.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: resolvePageByPath + pagePath"
```

---

## Task 5: Extraction du sommaire (TDD)

**Files:**
- Create: `lib/content/toc.ts`, `lib/content/toc.test.ts`

Le sommaire reprend les titres `##` et `###` des modules markdown/callout. Les ids d'ancre sont générés avec `github-slugger`, identique à `rehype-slug` côté rendu — les ancres correspondent.

- [ ] **Step 1: Écrire le test `lib/content/toc.test.ts`**

```ts
import { describe, it, expect } from "vitest"
import { extractToc } from "./toc"

describe("extractToc", () => {
  it("extrait h2 et h3 avec ancres", () => {
    const toc = extractToc("# Titre\n\n## Contexte\n\ntexte\n\n### Détail\n\n## Objectifs")
    expect(toc).toEqual([
      { depth: 2, text: "Contexte", id: "contexte" },
      { depth: 3, text: "Détail", id: "détail" },
      { depth: 2, text: "Objectifs", id: "objectifs" },
    ])
  })

  it("ignore le h1 et le contenu non-titre", () => {
    expect(extractToc("# H1\n\ndu texte\n- liste")).toEqual([])
  })

  it("désambiguïse les ancres dupliquées", () => {
    const toc = extractToc("## Intro\n\n## Intro")
    expect(toc.map((t) => t.id)).toEqual(["intro", "intro-1"])
  })

  it("ignore un # dans un bloc de code", () => {
    expect(extractToc("```\n## pas un titre\n```")).toEqual([])
  })
})
```

- [ ] **Step 2: Lancer le test (échec attendu)**

Run : `npx vitest run lib/content/toc.test.ts`
Expected : FAIL.

- [ ] **Step 3: Écrire `lib/content/toc.ts`**

```ts
import GithubSlugger from "github-slugger"

export type TocItem = { depth: 2 | 3; text: string; id: string }

export function extractToc(markdown: string): TocItem[] {
  const slugger = new GithubSlugger()
  const items: TocItem[] = []
  let inFence = false

  for (const line of markdown.split("\n")) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const m = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!m) continue
    const depth = m[1].length as 2 | 3
    const text = m[2].trim()
    items.push({ depth, text, id: slugger.slug(text) })
  }
  return items
}
```

- [ ] **Step 4: Lancer le test (succès attendu)**

Run : `npx vitest run lib/content/toc.test.ts`
Expected : PASS.

- [ ] **Step 5: Lancer toute la suite + commit**

Run : `npm test`
Expected : 4 fichiers de tests, tout PASS.

```bash
git add -A && git commit -m "feat: extractToc (sommaire de page)"
```

---

## Task 6: Rendu markdown partagé

**Files:**
- Create: `components/reader/markdown.tsx`

- [ ] **Step 1: Écrire `components/reader/markdown.tsx`**

```tsx
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeSlug from "rehype-slug"
import rehypeSanitize from "rehype-sanitize"

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose-reader">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSlug, rehypeSanitize]}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: Ajouter les styles `.prose-reader` à `app/globals.css`** (titres gras, tableaux à bordures nettes, code monospace, espacement généreux — brutaliste N&B).

```css
.prose-reader { line-height: 1.7; }
.prose-reader h2 { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.02em; margin: 2rem 0 0.75rem; }
.prose-reader h3 { font-size: 1.2rem; font-weight: 700; margin: 1.5rem 0 0.5rem; }
.prose-reader p { margin: 0.75rem 0; }
.prose-reader ul, .prose-reader ol { margin: 0.75rem 0; padding-left: 1.5rem; }
.prose-reader li { margin: 0.25rem 0; }
.prose-reader a { text-decoration: underline; text-underline-offset: 2px; }
.prose-reader code { font-family: var(--font-mono, monospace); background: var(--muted); padding: 0.1rem 0.3rem; }
.prose-reader pre { border: 2px solid var(--border); padding: 1rem; overflow-x: auto; }
.prose-reader pre code { background: transparent; padding: 0; }
.prose-reader table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
.prose-reader th, .prose-reader td { border: 2px solid var(--border); padding: 0.5rem 0.75rem; text-align: left; }
.prose-reader th { font-weight: 800; text-transform: uppercase; font-size: 0.85rem; }
.prose-reader blockquote { border-left: 4px solid var(--border); padding-left: 1rem; margin: 1rem 0; }
.prose-reader img { max-width: 100%; border: 2px solid var(--border); }
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: rendu markdown partagé (GFM, sanitize, slug)"
```

---

## Task 7: Composants de modules + registre

**Files:**
- Create: `components/modules/markdown-module.tsx`, `callout-module.tsx`, `image-module.tsx`, `video-module.tsx`, `file-module.tsx`, `embed-module.tsx`, `registry.tsx`

- [ ] **Step 1: Écrire les six composants**

`components/modules/markdown-module.tsx` :
```tsx
import { Markdown } from "@/components/reader/markdown"

export function MarkdownModule({ md }: { md: string }) {
  return <Markdown>{md}</Markdown>
}
```

`components/modules/callout-module.tsx` :
```tsx
import { Markdown } from "@/components/reader/markdown"

const styles: Record<string, string> = {
  info: "border-foreground",
  warn: "border-foreground bg-muted",
  success: "border-foreground",
}

export function CalloutModule({ variant, md }: { variant: "info" | "warn" | "success"; md: string }) {
  return (
    <div className={`my-4 border-4 p-4 ${styles[variant]}`}>
      <div className="mb-1 text-xs font-extrabold uppercase tracking-wide">{variant}</div>
      <Markdown>{md}</Markdown>
    </div>
  )
}
```

`components/modules/image-module.tsx` :
```tsx
export function ImageModule({ url, alt, caption }: { url: string; alt?: string; caption?: string }) {
  return (
    <figure className="my-6">
      {/* URL R2 externe : <img> volontaire (pas next/image, pas d'optimisation serveur en lot 1) */}
      <img src={url} alt={alt ?? ""} className="w-full border-2 border-foreground" />
      {caption && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}
```

`components/modules/video-module.tsx` :
```tsx
export function VideoModule({ url, caption }: { url: string; caption?: string }) {
  return (
    <figure className="my-6">
      <video src={url} controls className="w-full border-2 border-foreground" />
      {caption && <figcaption className="mt-2 text-sm text-muted-foreground">{caption}</figcaption>}
    </figure>
  )
}
```

`components/modules/file-module.tsx` :
```tsx
import { Download } from "lucide-react"

export function FileModule({ url, label, filename, size }: { url: string; label: string; filename: string; size?: number }) {
  const kb = size ? `${Math.round(size / 1024)} Ko` : null
  return (
    <a href={url} download className="my-4 flex items-center gap-3 border-4 border-foreground p-4 no-underline hover:bg-muted">
      <Download className="size-5 shrink-0" />
      <span className="flex-1">
        <span className="block font-bold">{label}</span>
        <span className="block text-sm text-muted-foreground">{filename}{kb ? ` · ${kb}` : ""}</span>
      </span>
    </a>
  )
}
```

`components/modules/embed-module.tsx` :
```tsx
export function EmbedModule({ url }: { url: string }) {
  return (
    <div className="my-6 aspect-video w-full border-2 border-foreground">
      <iframe src={url} className="h-full w-full" allowFullScreen sandbox="allow-scripts allow-same-origin allow-presentation" />
    </div>
  )
}
```

- [ ] **Step 2: Écrire `components/modules/registry.tsx`** (relie un `ParsedModule` à son composant)

```tsx
import type { ParsedModule } from "@/lib/modules/schemas"
import { MarkdownModule } from "./markdown-module"
import { CalloutModule } from "./callout-module"
import { ImageModule } from "./image-module"
import { VideoModule } from "./video-module"
import { FileModule } from "./file-module"
import { EmbedModule } from "./embed-module"

export function ModuleView({ module }: { module: ParsedModule }) {
  switch (module.type) {
    case "markdown": return <MarkdownModule {...module.content} />
    case "callout": return <CalloutModule {...module.content} />
    case "image": return <ImageModule {...module.content} />
    case "video": return <VideoModule {...module.content} />
    case "file": return <FileModule {...module.content} />
    case "embed": return <EmbedModule {...module.content} />
  }
}
```

- [ ] **Step 3: Vérifier le typecheck**

Run : `npm run typecheck`
Expected : aucune erreur (le `switch` est exhaustif sur l'union discriminée).

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: composants de modules + registre de rendu"
```

---

## Task 8: Requêtes de contenu (Drizzle)

**Files:**
- Create: `lib/content/queries.ts`

- [ ] **Step 1: Écrire `lib/content/queries.ts`**

```ts
import { eq, asc } from "drizzle-orm"
import { db } from "@/db"
import { resources, pages, modules } from "@/db/schema"
import { parseModule, type ParsedModule } from "@/lib/modules/schemas"
import type { FlatPage } from "@/lib/content/tree"

export async function listPublishedResources() {
  return db.select().from(resources).where(eq(resources.published, true)).orderBy(asc(resources.title))
}

export async function getResourceBySlug(slug: string) {
  const [resource] = await db.select().from(resources).where(eq(resources.slug, slug)).limit(1)
  if (!resource || !resource.published) return null

  const pageRows = await db.select().from(pages).where(eq(pages.resourceId, resource.id))
  const flatPages: FlatPage[] = pageRows.map((p) => ({
    id: p.id, parentId: p.parentId, slug: p.slug, title: p.title, position: p.position,
  }))
  return { resource, flatPages }
}

export async function getPageModules(pageId: string): Promise<ParsedModule[]> {
  const rows = await db.select().from(modules).where(eq(modules.pageId, pageId)).orderBy(asc(modules.position))
  return rows
    .map((r) => parseModule({ id: r.id, type: r.type, position: r.position, content: r.content }))
    .filter((m): m is ParsedModule => m !== null)
}
```

- [ ] **Step 2: Vérifier le typecheck**

Run : `npm run typecheck`
Expected : aucune erreur.

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "feat: requêtes de contenu (resources/pages/modules)"
```

---

## Task 9: Composants du reader (shell, arbre, sommaire)

**Files:**
- Create: `components/reader/page-tree.tsx`, `components/reader/toc.tsx`, `components/reader/reader-shell.tsx`

- [ ] **Step 1: Écrire `components/reader/page-tree.tsx`**

```tsx
import Link from "next/link"
import type { TreePage } from "@/lib/content/tree"

function Node({ node, basePath, prefix, currentId }: { node: TreePage; basePath: string; prefix: string[]; currentId: string }) {
  const href = prefix.length === 0 ? basePath : `${basePath}/${prefix.join("/")}`
  const active = node.id === currentId
  return (
    <li>
      <Link href={href} className={`block py-1 text-sm ${active ? "bg-foreground px-1 text-background" : "hover:underline"}`}>
        {node.title}
      </Link>
      {node.children.length > 0 && (
        <ul className="ml-3 border-l-2 border-border pl-2">
          {node.children.map((c) => (
            <Node key={c.id} node={c} basePath={basePath} prefix={[...prefix, c.slug]} currentId={currentId} />
          ))}
        </ul>
      )}
    </li>
  )
}

export function PageTree({ root, basePath, currentId }: { root: TreePage; basePath: string; currentId: string }) {
  return (
    <nav>
      <ul>
        <Node node={root} basePath={basePath} prefix={[]} currentId={currentId} />
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Écrire `components/reader/toc.tsx`**

```tsx
import type { TocItem } from "@/lib/content/toc"

export function Toc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null
  return (
    <nav className="text-sm">
      <div className="mb-2 text-xs font-extrabold uppercase tracking-wide">Sur cette page</div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className={it.depth === 3 ? "pl-3" : ""}>
            <a href={`#${it.id}`} className="text-muted-foreground hover:text-foreground hover:underline">{it.text}</a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 3: Écrire `components/reader/reader-shell.tsx`** (layout B, 3 colonnes brutalistes)

```tsx
import Link from "next/link"
import type { TreePage } from "@/lib/content/tree"
import type { TocItem } from "@/lib/content/toc"
import { PageTree } from "./page-tree"
import { Toc } from "./toc"

export function ReaderShell({
  resourceTitle, root, basePath, currentId, toc, children,
}: {
  resourceTitle: string
  root: TreePage
  basePath: string
  currentId: string
  toc: TocItem[]
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto min-h-screen max-w-7xl">
      <header className="flex items-center justify-between border-b-4 border-foreground px-6 py-3">
        <Link href="/" className="text-xs font-extrabold uppercase tracking-widest no-underline">Ressources</Link>
        <span className="text-xs font-bold uppercase tracking-wide">{resourceTitle}</span>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[240px_1fr_200px]">
        <aside className="border-r-4 border-foreground p-4 md:block">
          <PageTree root={root} basePath={basePath} currentId={currentId} />
        </aside>
        <main className="min-w-0 px-6 py-8">{children}</main>
        <aside className="hidden border-l-4 border-foreground p-4 lg:block">
          <Toc items={toc} />
        </aside>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Vérifier le typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add -A && git commit -m "feat: composants reader (shell, arbre, sommaire)"
```

---

## Task 10: Routes du reader

**Files:**
- Create: `app/(public)/r/[slug]/page.tsx`, `app/(public)/r/[slug]/[...path]/page.tsx`, `app/page.tsx`
- Note: la logique commune vit dans une fonction partagée `renderResourcePage` pour éviter la duplication entre les deux routes.

- [ ] **Step 1: Écrire `app/(public)/r/[slug]/render.tsx`** (logique partagée)

```tsx
import { notFound } from "next/navigation"
import { buildPageTree } from "@/lib/content/tree"
import { resolvePageByPath } from "@/lib/content/resolve"
import { extractToc, type TocItem } from "@/lib/content/toc"
import { getResourceBySlug, getPageModules } from "@/lib/content/queries"
import { ReaderShell } from "@/components/reader/reader-shell"
import { ModuleView } from "@/components/modules/registry"

export async function renderResourcePage(slug: string, path: string[]) {
  const data = await getResourceBySlug(slug)
  if (!data) notFound()

  const root = buildPageTree(data.flatPages)
  if (!root) notFound()

  const page = resolvePageByPath(root, path)
  if (!page) notFound()

  const mods = await getPageModules(page.id)

  const toc: TocItem[] = mods
    .filter((m) => m.type === "markdown" || m.type === "callout")
    .flatMap((m) => extractToc((m.content as { md: string }).md))

  return (
    <ReaderShell
      resourceTitle={data.resource.title}
      root={root}
      basePath={`/r/${slug}`}
      currentId={page.id}
      toc={toc}
    >
      <h1 className="mb-6 text-4xl font-black tracking-tight">{page.title}</h1>
      {mods.map((m) => (
        <ModuleView key={m.id} module={m} />
      ))}
    </ReaderShell>
  )
}
```

- [ ] **Step 2: Écrire `app/(public)/r/[slug]/page.tsx`**

```tsx
import { renderResourcePage } from "./render"

export default async function ResourceRootPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return renderResourcePage(slug, [])
}
```

- [ ] **Step 3: Écrire `app/(public)/r/[slug]/[...path]/page.tsx`**

```tsx
import { renderResourcePage } from "../render"

export default async function ResourceSubPage({ params }: { params: Promise<{ slug: string; path: string[] }> }) {
  const { slug, path } = await params
  return renderResourcePage(slug, path)
}
```

- [ ] **Step 4: Écrire `app/page.tsx`** (index : liste des ressources publiées)

```tsx
import Link from "next/link"
import { listPublishedResources } from "@/lib/content/queries"

export default async function HomePage() {
  const items = await listPublishedResources()
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-5xl font-black tracking-tight">Ressources</h1>
      <p className="mt-3 text-muted-foreground">Pour approfondir l'IA, l'automatisation et le cloud.</p>
      <ul className="mt-10 space-y-0 border-t-4 border-foreground">
        {items.map((r) => (
          <li key={r.id} className="border-b-4 border-foreground">
            <Link href={`/r/${r.slug}`} className="block py-5 no-underline hover:bg-muted">
              <span className="text-2xl font-bold">{r.title}</span>
              {r.description && <span className="mt-1 block text-muted-foreground">{r.description}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "feat: routes reader (racine, sous-page) + index"
```

---

## Task 11: Seed de démonstration

**Files:**
- Create: `db/seed.ts`

- [ ] **Step 1: Écrire `db/seed.ts`** (idempotent : supprime puis réinsère la ressource de démo par slug ; un module de chaque type)

```ts
import { eq } from "drizzle-orm"
import { db } from "./index"
import { resources, pages, modules } from "./schema"

const SLUG = "guide-ia"

async function seed() {
  await db.delete(resources).where(eq(resources.slug, SLUG)) // cascade pages + modules

  const [resource] = await db
    .insert(resources)
    .values({ slug: SLUG, title: "Guide IA", description: "Comprendre et appliquer l'IA en pratique.", visibility: "public", published: true })
    .returning()

  const [root] = await db
    .insert(pages)
    .values({ resourceId: resource.id, parentId: null, slug: "", title: "Introduction", position: 0 })
    .returning()

  const [prompting] = await db
    .insert(pages)
    .values({ resourceId: resource.id, parentId: root.id, slug: "prompting", title: "Prompting", position: 0 })
    .returning()

  await db.insert(pages).values({ resourceId: resource.id, parentId: root.id, slug: "automatisation", title: "Automatisation", position: 1 })

  await db.insert(modules).values([
    { pageId: root.id, type: "markdown", position: 0, content: { md: "## Contexte\n\nCe guide approfondit les bases de l'IA appliquée.\n\n## Objectifs\n\n- Comprendre les modèles\n- Écrire de bons prompts\n\n| Concept | Définition |\n| --- | --- |\n| LLM | Modèle de langage |" } },
    { pageId: root.id, type: "callout", position: 1, content: { variant: "info", md: "Astuce : commence par définir clairement ton objectif." } },
    { pageId: root.id, type: "image", position: 2, content: { url: "https://placehold.co/1200x600/000000/FFFFFF/png?text=Schema", alt: "Schéma", caption: "Vue d'ensemble" } },
    { pageId: root.id, type: "video", position: 3, content: { url: "https://www.w3schools.com/html/mov_bbb.mp4", caption: "Démo" } },
    { pageId: root.id, type: "file", position: 4, content: { url: "https://example.com/workflow.json", label: "Workflow N8N", filename: "workflow.json", size: 20480 } },
    { pageId: root.id, type: "embed", position: 5, content: { url: "https://www.youtube.com/embed/dQw4w9WgXcQ" } },
  ])

  await db.insert(modules).values({ pageId: prompting.id, type: "markdown", position: 0, content: { md: "## Prompting\n\nUn bon prompt est **spécifique** et **contextualisé**." } })

  console.log(`Seed OK → /r/${SLUG}`)
  process.exit(0)
}

seed().catch((e) => { console.error(e); process.exit(1) })
```

- [ ] **Step 2: Lancer le seed et vérifier le rendu**

Run :
```bash
npm run db:seed
npm run dev
```
Puis ouvrir `http://localhost:3000` puis `http://localhost:3000/r/guide-ia`.
Expected : index liste « Guide IA » ; le reader affiche l'arbre (Introduction / Prompting / Automatisation), les 6 modules, le sommaire (Contexte, Objectifs). La sous-page `/r/guide-ia/prompting` s'affiche.

- [ ] **Step 3: Vérifier les garde-fous**

- `http://localhost:3000/r/inconnu` → 404.
- Mettre temporairement `published: false` dans le seed, reseed → `/r/guide-ia` renvoie 404. Remettre `true` et reseed.

- [ ] **Step 4: Commit**

```bash
git add -A && git commit -m "feat: seed ressource de démo (Guide IA)"
```

---

## Task 12: Dockerfile + déploiement Coolify

**Files:**
- Create: `Dockerfile`, `.dockerignore`, `README.md`

- [ ] **Step 1: Écrire `.dockerignore`**

```
node_modules
.next
.git
.env*
.superpowers
docs
```

- [ ] **Step 2: Écrire `Dockerfile`** (multi-stage, sortie standalone)

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

- [ ] **Step 3: Écrire `README.md`** (mise en route locale + déploiement Coolify)

```markdown
# Ressources

Plateforme de ressources (lead magnets) pilotée à terme par API + MCP.

## Dev local

\`\`\`bash
npm install
cp .env.example .env.local
docker compose up -d        # Postgres local
npm run db:push             # crée les tables
npm run db:seed             # ressource de démo
npm run dev                 # http://localhost:3000/r/guide-ia
\`\`\`

## Tests

\`\`\`bash
npm test        # logique pure (arbre, sommaire, résolution, validation modules)
npm run typecheck
\`\`\`

## Déploiement Coolify

- Service Postgres ; renseigner \`DATABASE_URL\` dans l'app.
- Build via le \`Dockerfile\` (sortie Next standalone).
- Appliquer le schéma : \`npm run db:push\` (ou pipeline de migration) au déploiement.
```

- [ ] **Step 4: Vérifier le build de production**

Run :
```bash
npm run build
```
Expected : build réussi, présence de `.next/standalone/server.js`.

- [ ] **Step 5: Commit**

```bash
git add -A && git commit -m "chore: Dockerfile standalone + README (déploiement Coolify)"
```

---

## Self-review (couverture spec → plan)

- Modèle de données (`resources`/`pages`/`modules`) → Task 1. ✓
- 6 types de modules + schémas Zod + registre → Task 2 (schémas) + Task 7 (composants/registre). ✓
- Reader layout B (arbre / contenu / sommaire) → Tasks 6, 9, 10. ✓
- Routes `/r/[slug]` + `/r/[slug]/[...path]`, 404 si non publié → Task 10 + Task 11 step 3. ✓
- Construction d'arbre, résolution de chemin, sommaire (purs, testés) → Tasks 3, 4, 5. ✓
- Validation des modules (content invalide ignoré) → Task 2 (`parseModule` renvoie null) + Task 8 (filtre). ✓
- Seed de démo idempotent, un module par type → Task 11. ✓
- Déploiement Coolify (standalone, Postgres, `DATABASE_URL`) → Task 0 (docker-compose dev) + Task 12 (Dockerfile). ✓
- Tests Vitest logique pure → Tasks 2-5. ✓
- Critères d'acceptation (test, rendu seedé, 404, module invalide ignoré, build standalone) → couverts par Tasks 5/10/11/12. ✓

Cohérence des types vérifiée : `FlatPage`/`TreePage` (tree.ts) réutilisés par resolve.ts, queries.ts, composants ; `ParsedModule` (schemas.ts) réutilisé par registry.tsx et queries.ts ; `TocItem` (toc.ts) réutilisé par toc.tsx et render.tsx.
