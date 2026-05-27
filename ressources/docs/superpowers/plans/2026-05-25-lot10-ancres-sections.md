# Lot 10 — Ancres de sections exposées — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer à l'agent, via le MCP, les sections (ancres) de chaque page avec un href prêt à coller, pour qu'il crée des liens vers des sous-sections sans deviner la syntaxe github-slugger.

**Architecture:** Fonction pure `extractSections` (réutilise `extractToc`, ancres par-module = sommaire actuel). `getResource` ajoute `sections` à chaque page ; nouvel outil MCP `get_outline` renvoie la carte compacte des liens (pages + sections + hrefs, sans contenu). Aucune migration.

**Tech Stack:** Drizzle, MCP, Zod, github-slugger (déjà en place).

---

## Structure des fichiers

```
lib/content/toc.ts          + extractSections (pur)
lib/content/toc.test.ts      + test
lib/resources/service.ts     getResource: sections par page ; nouvelle getOutline ; helper pagePath
lib/resources/mcp.ts         + outil get_outline ; desc get_resource
```

---

## Task 1: extractSections (TDD)

**Files:** Modify `lib/content/toc.ts`, `lib/content/toc.test.ts`

- [ ] **Step 1: Test** dans `lib/content/toc.test.ts` (ajouter)

```ts
import { extractToc, extractSections } from "./toc"

describe("extractSections", () => {
  it("aplatit plusieurs markdown en sections (ancres = extractToc)", () => {
    expect(extractSections(["## Contexte\n\n### Détail", "## Objectifs"])).toEqual([
      { title: "Contexte", depth: 2, anchor: "contexte" },
      { title: "Détail", depth: 3, anchor: "détail" },
      { title: "Objectifs", depth: 2, anchor: "objectifs" },
    ])
  })
  it("ignore les textes sans titre h2/h3", () => {
    expect(extractSections(["# H1\n\ntexte", "## Ok"])).toEqual([{ title: "Ok", depth: 2, anchor: "ok" }])
  })
})
```
(Adapter l'import existant `import { extractToc } from "./toc"` → ajouter `extractSections`.)

- [ ] **Step 2: Lancer (échec attendu)** — `npx vitest run lib/content/toc.test.ts` → FAIL.

- [ ] **Step 3: Implémenter** dans `lib/content/toc.ts` (à la fin)

```ts
export type Section = { title: string; depth: 2 | 3; anchor: string }

export function extractSections(mdTexts: string[]): Section[] {
  return mdTexts.flatMap((md) => extractToc(md)).map((t) => ({ title: t.text, depth: t.depth, anchor: t.id }))
}
```

- [ ] **Step 4: Lancer (succès) + commit**

Run : `npm test`
Expected : PASS.

```bash
git add lib/content/toc.ts lib/content/toc.test.ts
git commit -m "feat: extractSections (sections + ancres, par module)"
```

---

## Task 2: getResource sections + getOutline (service)

**Files:** Modify `lib/resources/service.ts`

- [ ] **Step 1: Importer `extractSections`** en tête de `lib/resources/service.ts`

```ts
import { extractSections } from "@/lib/content/toc"
```

- [ ] **Step 2: Ajouter le helper `pagePath`** (après `resourceUrl`)

```ts
function pagePath(slug: string, path: string[]): string {
  return `/r/${slug}${path.length ? "/" + path.join("/") : ""}`
}
```

- [ ] **Step 3: Enrichir `getResource`** — dans `toNode`, calculer les sections et les ajouter au nœud. Remplacer le corps de `toNode` par :

```ts
  const toNode = async (node: TreePage, path: string[]): Promise<unknown> => {
    const mods = await getPageModules(node.id)
    const mdTexts = mods
      .filter((m) => m.type === "markdown" || m.type === "callout")
      .map((m) => (m.content as { md: string }).md)
    const sections = extractSections(mdTexts).map((s) => ({ ...s, href: `${pagePath(r.slug, path)}#${s.anchor}` }))
    const children: unknown[] = []
    for (const c of node.children) children.push(await toNode(c, [...path, c.slug]))
    return {
      id: node.id,
      slug: node.slug,
      title: node.title,
      path,
      modules: mods.map((m) => ({ id: m.id, type: m.type, position: m.position, content: m.content })),
      sections,
      children,
    }
  }
```

- [ ] **Step 4: Ajouter `getOutline`** (à la fin du fichier)

```ts
export async function getOutline(slug: string) {
  const r = await getResourceRowBySlug(slug)
  const root = buildPageTree(await flatPagesOf(r.id))
  if (!root) throw new Error(`Ressource sans page racine: ${slug}`)

  const pages: { title: string; path: string[]; url: string; sections: { title: string; anchor: string; href: string }[] }[] = []
  const walk = async (node: TreePage, path: string[]) => {
    const mods = await getPageModules(node.id)
    const mdTexts = mods
      .filter((m) => m.type === "markdown" || m.type === "callout")
      .map((m) => (m.content as { md: string }).md)
    const sections = extractSections(mdTexts).map((s) => ({
      title: s.title,
      anchor: s.anchor,
      href: `${pagePath(r.slug, path)}#${s.anchor}`,
    }))
    pages.push({ title: node.title, path, url: pagePath(r.slug, path), sections })
    for (const c of node.children) await walk(c, [...path, c.slug])
  }
  await walk(root, [])
  return { slug: r.slug, title: r.title, url: pagePath(r.slug, []), pages }
}
```

- [ ] **Step 5: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/resources/service.ts
git commit -m "feat: sections par page dans getResource + getOutline"
```

---

## Task 3: Outil MCP get_outline

**Files:** Modify `lib/resources/mcp.ts`

- [ ] **Step 1: Mettre à jour la description de `get_resource`** (mention des sections) — remplacer sa description par :

```ts
    "Renvoie l'arborescence complète d'une ressource (pages par chemin, modules par id, et sections avec leur ancre + href prêt à coller pour des liens vers les sous-sections).",
```

- [ ] **Step 2: Ajouter l'outil `get_outline`** (après `get_resource`)

```ts
  add(
    "get_outline",
    "Carte des liens d'une ressource : toutes les pages et leurs sections (titre, ancre, href prêt à coller du type /r/slug/chemin#ancre), SANS le contenu. Utile pour créer des liens vers des sous-sections (ex. sommaire global).",
    z.object({ slug: z.string() }),
    ({ slug }) => service.getOutline(slug),
  )
```

- [ ] **Step 3: Typecheck + build + commit**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur.

```bash
git add lib/resources/mcp.ts
git commit -m "feat: outil MCP get_outline (carte des liens/ancres)"
```

---

## Task 4: Vérification + déploiement

- [ ] **Step 1: Gates**

Run : `npm test && npm run typecheck && npm run lint && npm run build`
Expected : tout vert.

- [ ] **Step 2: Smoke service jetable** (base locale seedée)

```bash
docker compose up -d ; npm run db:push >/dev/null ; npm run db:seed >/dev/null
```
Créer `lib/resources/lot10.smoke.test.ts` (jetable) :
```ts
import { describe, it, expect } from "vitest"
import { getOutline } from "./service"
describe("lot10 smoke", () => {
  it("getOutline expose les sections avec hrefs", async () => {
    const o = (await getOutline("guide-ia")) as { pages: { path: string[]; sections: { anchor: string; href: string }[] }[] }
    const root = o.pages.find((p) => p.path.length === 0)!
    expect(root.sections.map((s) => s.anchor)).toContain("contexte")
    expect(root.sections.find((s) => s.anchor === "contexte")!.href).toBe("/r/guide-ia#contexte")
    const prompting = o.pages.find((p) => p.path.join("/") === "prompting")
    expect(prompting).toBeTruthy()
  })
})
```
Run : `DATABASE_URL="$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)" npx vitest run lib/resources/lot10.smoke.test.ts`
Expected : PASS (`contexte` présent, href `/r/guide-ia#contexte`). Puis `rm lib/resources/lot10.smoke.test.ts`.

- [ ] **Step 3: Push + redéploiement (aucune migration)**

```bash
git push origin main
cd ~/Code/cockpit && set -a && . ./.env && set +a
URL="$(bin/secret-get COOLIFY_URL)"; TOK="$(bin/secret-get COOLIFY_TOKEN)"
DEP=$(curl -fsS -H "Authorization: Bearer $TOK" "$URL/api/v1/deploy?uuid=m88ck0gg4sgcs0kkggwgoggs" | jq -r '.deployments[0].deployment_uuid')
# poll jusqu'à finished, puis : curl -s -o /dev/null -w "%{http_code}" https://ressources.avqn.ch/
```

- [ ] **Step 4: Test Claude.ai** : reconnecter le connecteur, demander « donne-moi l'outline de la ressource X » → `get_outline` → l'agent obtient les hrefs et peut créer les liens.

---

## Self-review (couverture spec → plan)

- `extractSections` pur (par module) → Task 1. ✓
- `getResource` + `sections` par page → Task 2. ✓
- `getOutline` (carte compacte) + outil MCP → Tasks 2, 3. ✓
- Href relatif `/r/<slug>[/<chemin>]#<ancre>` → Task 2 (`pagePath`). ✓
- Description `get_resource` mise à jour → Task 3. ✓
- Tests + smoke + déploiement sans migration → Tasks 1, 4. ✓

Cohérence : `extractSections` (toc.ts) réutilise `extractToc` (mêmes ancres que le rendu) ; `pagePath` partagé par `getResource` et `getOutline` ; `getOutline` (service) appelé par l'outil `get_outline` (mcp). Les `sections` ajoutées au nœud n'impactent pas les consommateurs existants de `getResource` (champ additif ; l'admin lit `modules`/`children`).
```
