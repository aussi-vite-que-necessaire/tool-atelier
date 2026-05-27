# Lot 8 — Bulk MCP granulaire — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à l'agent de bâtir une grosse ressource en ~1 appel par sous-page : `add_page` accepte ses modules, et un nouvel outil `add_modules` ajoute un lot de modules à une page existante.

**Architecture:** Ajout additif sur la couche service (`addPage` gagne `modules?`, nouvelle `addModules`) et la façade MCP (champ `modules` sur `add_page`, outil `add_modules`, description de `create_resource` ajustée). Réutilise `moduleInputSchema` et le pattern d'insertion de `createResource`. Aucune migration.

**Tech Stack:** mcp-handler, better-auth (OAuth, inchangé), Drizzle, Zod.

---

## Structure des fichiers

```
lib/resources/service.ts   addPage + modules?, nouvelle addModules
lib/resources/mcp.ts        add_page + champ modules, outil add_modules, desc create_resource
```

---

## Task 1: Couche service

**Files:** Modify `lib/resources/service.ts`

- [ ] **Step 1: Remplacer `addPage`** (champ `modules?` + retour `moduleIds`)

```ts
export async function addPage(input: {
  resourceSlug: string
  parentPath?: string[]
  slug: string
  title: string
  position?: number
  modules?: ModuleInput[]
}) {
  const { resource, root } = await resolve(input.resourceSlug, [])
  const parent = resolvePageByPath(root, input.parentPath ?? [])
  if (!parent) throw new Error(`Page parente introuvable: /${(input.parentPath ?? []).join("/")}`)
  const slug = slugify(input.slug) || input.slug
  const position = input.position ?? parent.children.length
  const [page] = await db
    .insert(pages)
    .values({ resourceId: resource.id, parentId: parent.id, slug, title: input.title, position })
    .returning()

  let moduleIds: string[] = []
  if (input.modules?.length) {
    const rows = await db
      .insert(modules)
      .values(input.modules.map((m, i) => ({ pageId: page.id, type: m.type, position: i, content: m.content })))
      .returning({ id: modules.id })
    moduleIds = rows.map((r) => r.id)
  }
  return { path: [...(input.parentPath ?? []), page.slug], moduleIds }
}
```

- [ ] **Step 2: Ajouter `addModules`** (à la fin du fichier, après `addModule`)

```ts
export async function addModules(input: { resourceSlug: string; path: string[]; modules: ModuleInput[] }) {
  const { page } = await resolve(input.resourceSlug, input.path)
  const count = (await db.select({ id: modules.id }).from(modules).where(eq(modules.pageId, page.id))).length
  const rows = await db
    .insert(modules)
    .values(input.modules.map((m, i) => ({ pageId: page.id, type: m.type, position: count + i, content: m.content })))
    .returning({ id: modules.id })
  return { moduleIds: rows.map((r) => r.id) }
}
```

- [ ] **Step 3: Typecheck + commit**

Run : `npm run typecheck`
Expected : aucune erreur.

```bash
git add lib/resources/service.ts
git commit -m "feat: addPage accepte modules[] + addModules (batch)"
```

---

## Task 2: Façade MCP

**Files:** Modify `lib/resources/mcp.ts`

- [ ] **Step 1: Remplacer l'outil `add_page`** (champ `modules` + description)

```ts
  add(
    "add_page",
    "Ajoute une sous-page sous parentPath (vide = racine), AVEC ses modules en un seul appel. Pour une grosse ressource, appelle add_page une fois par page (un appel = une page).",
    z.object({
      resourceSlug: z.string(),
      parentPath: z.array(z.string()).optional(),
      slug: z.string(),
      title: z.string(),
      position: z.number().int().optional(),
      modules: z
        .array(moduleInputSchema)
        .optional()
        .describe("Modules de la page, dans l'ordre — créés avec la page."),
    }),
    (args) => service.addPage(args),
  )
```

- [ ] **Step 2: Ajouter l'outil `add_modules`** (juste après `add_page`)

```ts
  add(
    "add_modules",
    "Ajoute un lot de modules à la FIN d'une page existante, en un appel. Pour compléter la page racine après create_resource, ou découper une page très chargée en plusieurs appels.",
    z.object({
      resourceSlug: z.string(),
      path: z.array(z.string()),
      modules: z.array(moduleInputSchema),
    }),
    (args) => service.addModules(args),
  )
```

- [ ] **Step 3: Ajuster la description de `create_resource`** (orienter petite vs grosse)

Remplacer la description par :

```ts
    "Crée une ressource. Petite/moyenne ressource : passe toute l'arborescence ici (rootModules, pages[] imbriquées). GROSSE ressource : crée seulement la coquille (titre + page racine légère) puis remplis page par page avec add_page(modules) / add_modules — un appel par page, pour éviter un payload géant. Renvoie { id, slug, url }.",
```

- [ ] **Step 4: Typecheck + build + commit**

Run : `npm run typecheck && npm run build`
Expected : aucune erreur.

```bash
git add lib/resources/mcp.ts
git commit -m "feat: MCP add_page(modules) + add_modules + guidage create_resource"
```

---

## Task 3: Vérification locale (MCP) + gates

- [ ] **Step 1: Base + serveur (mode console OTP)**

```bash
docker compose up -d
npm run db:push
RESEND_API_KEY= RESEND_FROM_EMAIL= npx next dev -p 3001 > /tmp/lab-ress-dev.log 2>&1 &
# attendre "Ready" ; le MCP local exige OAuth → on teste la couche service directement (voir step 2)
```

- [ ] **Step 2: Vérifier le flux via la couche service** (le MCP prod est OAuth ; en local on exerce directement service.addPage/addModules)

```bash
node --env-file=.env.local --import tsx -e "
import * as s from './lib/resources/service.ts'
const r = await s.createResource({ title: 'Bulk test', published: true })
await s.addPage({ resourceSlug: r.slug, slug: 'p1', title: 'P1', modules: [{type:'markdown',content:{md:'## A'}},{type:'callout',content:{variant:'info',md:'note'}}] })
await s.addModules({ resourceSlug: r.slug, path: ['p1'], modules: [{type:'markdown',content:{md:'## B'}}] })
const g = await s.getResource(r.slug)
const p1 = g.root.children.find(c => c.slug==='p1')
console.log('page p1 modules:', p1.modules.length, '(attendu 3, ordre A/callout/B)')
console.log(p1.modules.map(m=>m.type).join(','))
await s.deleteResource(r.slug)
process.exit(0)
" 2>&1 | tail -5
```
Expected : `page p1 modules: 3` ; types `markdown,callout,markdown` (les 2 d'add_page puis le 1 d'add_modules à la fin).

> Note : ce `-e` suppose que tsx résout l'alias `@/`. S'il échoue sur les imports `@/`, écrire
> un petit script `scripts/bulk-smoke.ts` à la racine du projet (mêmes appels) et le lancer via
> `npm`-style ; sinon vérifier en prod via Claude.ai après déploiement.

- [ ] **Step 3: Gates**

```bash
pkill -f "next dev"
npm test && npm run typecheck && npm run lint && npm run build
```
Expected : tout vert (57 tests existants).

---

## Task 4: Déploiement

- [ ] **Step 1: Pousser + redéployer (pas de migration)**

```bash
git push origin main
cd ~/Code/infra && set -a && . ./.env && set +a
URL="$(bin/secret-get COOLIFY_URL)"; TOK="$(bin/secret-get COOLIFY_TOKEN)"
DEP=$(curl -fsS -H "Authorization: Bearer $TOK" "$URL/api/v1/deploy?uuid=m88ck0gg4sgcs0kkggwgoggs" | jq -r '.deployments[0].deployment_uuid')
# poll jusqu'à finished
```

- [ ] **Step 2: Vérif + test Claude.ai**

```bash
curl -s -o /dev/null -w "/ : %{http_code}\n" https://ressources.avqn.ch/
```
Reconnecter/rafraîchir le connecteur Claude.ai (nouveaux outils : `add_modules`, `add_page` enrichi). Demander à l'agent de bâtir une grosse ressource page par page et vérifier ~1 appel par page.

---

## Self-review (couverture spec → plan)

- `add_page` + `modules[]` → Task 1 (service), Task 2 (MCP). ✓
- `add_modules` (batch) → Task 1 (service), Task 2 (MCP). ✓
- Pas de `children` sur `add_page` (payload borné) → conservé (le champ n'est pas ajouté). ✓
- Descriptions orientant petite/grosse → Task 2 (add_page, add_modules, create_resource). ✓
- Réutilise `moduleInputSchema` → Tasks 1-2. ✓
- Vérif + déploiement sans migration → Tasks 3-4. ✓

Cohérence : `addPage`/`addModules` (service) consommés par `add_page`/`add_modules` (mcp) ; `ModuleInput` (module-input) réutilisé ; pattern d'insertion identique à `createResource`. Aucune table ni migration.
```
