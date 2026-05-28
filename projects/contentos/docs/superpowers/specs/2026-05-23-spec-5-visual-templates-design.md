# Spec 5 (Visual templates) Design

> **Position dans la roadmap v2** : 5e spec sur 8. Suit Spec 4 (pipeline ideas → posts) qui a laissé un slot visuel vide sur `/posts/[id]` avec une pastille "Pas de visuel". Cette spec remplit ce vide : permettre à un user d'attacher un visuel généré à partir d'un template HTML+CSS+variables stocké en DB, rendu en PNG via Puppeteer dans le worker BullMQ.

## Objectif

Permettre à un user signé de :

1. **Gérer ses visual templates** (CRUD complet) depuis `/settings/visual-templates`. Un template = HTML + CSS + schéma de variables + dimensions.
2. **Générer un visuel depuis un template** sur la page `/posts/[id]` : choisir un template, remplir le formulaire de variables, prévisualiser, valider. Le visuel généré est attaché au post.

Trois autres sources d'images sont **hors scope cette spec** (cf. § Hors scope) : upload depuis l'ordinateur, génération IA d'image, réutilisation d'une image existante. Le scope minimal permet de valider toute la chaîne (DSL → compile → render → upload → attach) avant d'ajouter des sources alternatives.

Avant Spec 5, l'infrastructure media existe déjà (tables `media` et `image_assets` posées en Spec 2, repositories CRUD, storage R2/InMemory) mais aucune UI n'attache de média à un post. Après Spec 5, le user peut générer un visuel et le voir affiché sur son post.

## Scope

**Inclus :**

- Nouvelle table `visual_templates` (Drizzle, migration additive, scopée `user_id`).
- Nouveau repository `src/lib/db/repositories/visual-templates.ts` (CRUD + scoping tenant).
- Nouveau module `src/lib/visual-templates/` regroupant le DSL des variables, le compilateur Handlebars et le renderer Puppeteer.
- DSL maison des variables (type `string` seul pour MVP, extensible) avec conversion en Zod au runtime pour validation côté serveur.
- Helpers Handlebars custom minimaux (`{{escape}}`, `{{ifNotEmpty}}`, `{{trim}}`).
- Base CSS partagée (fonts AVQN + reset) en code : `src/lib/visual-templates/base.css`.
- Nouvelle queue BullMQ `render-visual` + worker `processRenderVisual` qui compile → render Puppeteer → upload R2 → (optionnel) crée `media` + `image_assets` + update `posts.media_id`.
- Endpoint `/api/jobs/[id]?queue=render-visual` (déjà généralisé en Spec 4, juste enregistrer la queue dans le registry).
- Nouvelles Server Actions :
  - `createVisualTemplateAction`, `updateVisualTemplateAction`, `deleteVisualTemplateAction` (back-office)
  - `enqueueRenderPreviewAction` (rend un PNG sans persister)
  - `enqueueRenderFinalAction` (rend, crée media + image_asset, attache au post)
- Pages back-office `/settings/visual-templates` : list, new, `[id]` (edit + delete). Bouton "Prévisualiser" sur l'édition.
- Modification de `/posts/[id]` : remplacement de la pastille "Pas de visuel" par un bouton "Ajouter un visuel" qui ouvre un dialog (sélection template → formulaire vars → preview → valider). Affichage du visuel attaché en haut du post.
- Seed initial de 2 templates text-only depuis v1 : `linkedin-big-number`, `linkedin-manifesto`. Seedés via script idempotent `scripts/seed-visual-templates.ts` lancé manuellement (pas au boot, pour rester en contrôle).
- Tests :
  - Unit : DSL → Zod converter, compile Handlebars (sans Puppeteer).
  - Integration : repository visual_templates (CRUD + tenant isolation), Server Actions back-office + render.
  - Worker : `processRenderVisual` happy path + idempotency (mock Puppeteer pour ne pas dépendre d'un binaire en CI).
  - E2E Playwright : créer un template via back-office, générer un visuel depuis un post (worker avec Puppeteer réel ou stub PNG).

**Hors scope (rappelé en bas) :**

- Upload manuel d'image depuis l'ordinateur.
- Génération d'image via IA (Gemini, OpenAI, etc.).
- Réutilisation d'une image existante depuis une médiathèque.
- Variables d'image dans les templates (ex : photo dans un before/after).
- Variables non-string : `color`, `list`, `toggle`, `richtext`.
- Multi-images par post (UI). Le schéma le permet déjà via FK nullable, mais l'UI MVP n'affiche qu'un seul média.
- Carousels et vidéos (déjà couverts par `media_kind` mais non-implémentés UI).
- Versioning historique des templates (save direct, single version).
- Templates partagés multi-user (chaque user a ses propres templates, comme `writing_templates`).
- Sandbox du HTML/CSS : full-trust user de son propre instance (cohérent avec `writing_templates`).
- Editeur visuel WYSIWYG des templates : textareas brutes pour HTML/CSS au MVP.

## Architecture cible

### Schéma DB

**Nouvelle table `visual_templates`** (`src/lib/db/schemas/visual-templates.ts`) :

```ts
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visualTemplates = pgTable(
  'visual_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bodyHtml: text('body_html').notNull(),
    css: text('css').notNull(),
    variablesSchema: jsonb('variables_schema').notNull(),
    sampleVars: jsonb('sample_vars').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('visual_templates_user_id_idx').on(table.userId),
    unique('visual_templates_user_id_slug_unique').on(table.userId, table.slug),
  ],
);

export type VisualTemplate = typeof visualTemplates.$inferSelect;
```

Choix tracés :

- **Scoping `user_id` strict**, cohérent avec `writing_templates`. Pas de templates partagés au MVP (les seeds sont copiés dans le compte de chaque user au signup ou via script manuel).
- **`variables_schema` en jsonb** : pas une colonne typée, parce que le DSL évolue. Validé via Zod côté code.
- **`sample_vars` en jsonb** : un exemple de valeurs valides selon `variables_schema`. Sert au preview du back-office et à la doc vivante. Validé au save.
- **Pas de colonnes `image_prompt` / `image_aspect_ratio`** : génération IA hors scope. Quand on l'ajoutera (Spec 6 ou 7), ce sera une migration additive.
- **Pas de FK depuis `image_assets.template_slug`** : la colonne existe déjà (Spec 2), reste une string libre. Cohérent avec la philosophie "supprimer un template ne casse pas les visuels existants, juste ils n'ont plus de source rééditable".

Pas de modification des tables existantes (`posts.media_id`, `media`, `image_assets` sont déjà conformes). Migration **purement additive**.

### DSL des variables

Format JSON stocké en `variables_schema`, défini par `src/lib/visual-templates/dsl.ts`. **Le DSL n'est pas pluggable** : il évolue par ajout de types dans le code, pas via du JSON Schema arbitraire.

**Forme MVP (type `string` seul) :**

```ts
type VariableSpec = {
  name: string;         // identifiant Handlebars, ex "bigNumber"
  label: string;        // libellé UI, ex "Statistique"
  description?: string; // help text dans le form
  type: 'string';
  min?: number;         // longueur min (chars)
  max: number;          // longueur max (chars), TOUJOURS requis pour string
  optional?: boolean;   // si true, peut être vide
};

type VariablesSchema = VariableSpec[]; // ordre = ordre d'affichage du form
```

Exemple stocké dans `variables_schema` :

```json
[
  { "name": "bigNumber", "label": "Statistique", "type": "string",
    "min": 1, "max": 8,
    "description": "Court et frappant : un chiffre + unité ('+10h/sem', '-80%')" },
  { "name": "context", "label": "Contexte", "type": "string",
    "min": 20, "max": 90,
    "description": "Phrase courte qui explique la stat, sans répéter le chiffre" },
  { "name": "subtitle", "label": "Sous-titre (optionnel)", "type": "string",
    "max": 140, "optional": true },
  { "name": "signature", "label": "Signature (optionnel)", "type": "string",
    "max": 30, "optional": true }
]
```

**Helpers** (`src/lib/visual-templates/dsl.ts`) :

- `parseVariablesSchema(raw: unknown): VariablesSchema` — valide via Zod méta-schéma, throw si mal formé.
- `variablesSchemaToZod(schema: VariablesSchema): ZodObject` — produit un Zod runtime utilisé pour valider les vars en entrée de chaque render. Pour MVP, mapping trivial :
  - `string` non-optional : `z.string().min(spec.min ?? 1).max(spec.max).trim()`
  - `string` optional : `z.string().max(spec.max).trim().optional()` (vide accepté)
- `validateSampleVars(schema, sample)` : ensure que `sample` parse selon le Zod dérivé.

**Extension future** (hors MVP, mais design ouvert) : ajout d'un discriminant `type: 'color' | 'image' | 'toggle' | 'list'` avec props spécifiques. Le switch dans `variablesSchemaToZod` croît, les composants UI du form ajoutent un cas. Le DSL reste typé.

### Compileur Handlebars

`src/lib/visual-templates/compile.ts` :

```ts
type CompileInput = {
  template: VisualTemplate;
  vars: Record<string, unknown>;  // déjà validé par variablesSchemaToZod en amont
  brand: { name: string; color: string; signature: string | null };
};

export function compileTemplate(input: CompileInput): string {
  // 1. Construire le contexte Handlebars
  const ctx = { ...input.vars, brand: input.brand };

  // 2. Compiler body_html ET css (utile pour interpoler brand.color dans le CSS)
  const bodyTpl = Handlebars.compile(input.template.bodyHtml, { strict: true });
  const cssTpl  = Handlebars.compile(input.template.css,      { strict: true });
  const body = bodyTpl(ctx);
  const css  = cssTpl(ctx);

  // 3. Assembler le document final
  const baseCss = readBaseCss();  // cached, fs.readFileSync au boot

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <style>${baseCss}\n${css}</style>
</head>
<body style="width:${input.template.width}px;height:${input.template.height}px">${body}</body>
</html>`;
}
```

**Cache compilation Handlebars** : LRU `Map<string, HandlebarsTemplate>` keyed par `${templateId}:${updatedAt.getTime()}:${'body'|'css'}`. Taille 100 entries. Évite de recompiler chaque body+css à chaque render.

**Helpers globaux** registrés au boot du module (top-level dans `compile.ts`) :

- `{{escape value}}` : HTML escape explicite (Handlebars escape déjà sur double-stash, fourni pour documentation).
- `{{ifNotEmpty value}}...{{/ifNotEmpty}}` : block conditionnel non-vide (trim included).
- `{{trim value}}` : trim whitespace.

On reste minimal : on ajoute un helper quand un template en a besoin, pas avant.

**Sécurité** : variables user dans `body_html` → toujours double-stash `{{var}}` (escape HTML). Triple-stash `{{{var}}}` interdit dans MVP (aucun template seed n'en a besoin). À reconsidérer si un template SVG inline est ajouté.

### Base CSS

Fichier `src/lib/visual-templates/base.css` :

```css
@font-face {
  font-family: "General Sans";
  src: url("https://cdn.avqn.ch/fonts/GeneralSans-Regular.woff2") format("woff2");
  font-weight: 400; font-display: block; font-style: normal;
}
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Medium.woff2") format("woff2"); font-weight: 500; font-display: block; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Semibold.woff2") format("woff2"); font-weight: 600; font-display: block; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Bold.woff2") format("woff2"); font-weight: 700; font-display: block; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Semibold.woff2") format("woff2"); font-weight: 600; font-display: block; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Bold.woff2") format("woff2"); font-weight: 700; font-display: block; font-style: normal; }

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #fff; color: #000; }
```

`font-display: block` (et non `swap`) pour éviter le FOUT côté Puppeteer — on attend explicitement `document.fonts.ready` avant screenshot. Si une font fail à charger, l'image attendra le timeout (3s par défaut, configurable). Acceptable au MVP.

Importé via `fs.readFileSync` au boot du worker, mémorisé.

### Renderer Puppeteer

`src/lib/visual-templates/render.ts` :

```ts
import puppeteer, { type Browser, type Page } from 'puppeteer';

let browser: Browser | undefined;
let page: Page | undefined;

async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  if (!page) page = await browser.newPage();
  return page;
}

export async function renderHtmlToPng(opts: {
  html: string;
  width: number;
  height: number;
}): Promise<Buffer> {
  const p = await getPage();
  await p.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 });
  await p.setContent(opts.html, { waitUntil: 'networkidle0' });
  await p.evaluate(() => (document as any).fonts.ready);
  return (await p.screenshot({
    type: 'png',
    omitBackground: false,
    clip: { x: 0, y: 0, width: opts.width, height: opts.height },
  })) as Buffer;
}

export async function closeRenderer(): Promise<void> {
  if (browser) await browser.close();
  browser = undefined; page = undefined;
}
```

Singleton browser + page partagés, réutilisés sur toute la durée de vie du worker (cohérent v1). Cleanup au signal SIGTERM/SIGINT dans `src/worker/index.ts`.

**Pourquoi Puppeteer et pas satori** : choix utilisateur lors du brainstorm. Full CSS fidélité v1, pas de réécriture des templates. Coût : binaire Chromium ~170Mo dans le worker, cold start ~1-2s, render warm ~500-800ms.

### Queue & worker

**Ajout dans `src/lib/queue/client.ts`** :

```ts
export type RenderVisualJob = {
  userId: string;
  templateId: string;
  vars: Record<string, unknown>;     // validés en amont par Server Action
  mode: 'preview' | 'final';
  postId?: string;                    // requis si mode === 'final'
  jobKey: string;
};

export type RenderVisualResult =
  | { mode: 'preview'; previewKey: string; signedUrl: string; width: number; height: number }
  | { mode: 'final'; mediaId: string; signedUrl: string; width: number; height: number };

export const renderVisualQueue = new Queue<RenderVisualJob, RenderVisualResult>(
  'render-visual',
  {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 2,
      backoff: { type: 'fixed', delay: 5_000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  },
);
```

**Ajout dans `src/lib/queue/enqueue.ts`** :

```ts
export async function enqueueRenderVisual(payload: RenderVisualJob): Promise<string> {
  const job = await renderVisualQueue.add('render', payload, { jobId: payload.jobKey });
  return job.id!;
}
```

**Ajout dans `src/lib/queue/registry.ts`** : `'render-visual': renderVisualQueue`.

**Nouveau worker `src/worker/queues/render-visual.ts`** :

```ts
type Deps = {
  storage: Storage;
  renderHtmlToPng: (opts: { html: string; width: number; height: number }) => Promise<Buffer>;
};

export function makeProcessRenderVisual(deps: Deps) {
  return async function processRenderVisual(
    job: Job<RenderVisualJob>,
  ): Promise<RenderVisualResult> {
    const { userId, templateId, vars, mode, postId, jobKey } = job.data;

    // 1. Idempotency check (mode 'final' uniquement, via media reused jobKey si on a un index)
    //    Pour MVP : pas d'idempotency stricte sur le render (côté préview pas grave, côté final
    //    risque négligeable car le user clique une fois).

    // 2. Charger le template + brand
    const template = await getVisualTemplate(userId, templateId);
    if (!template) throw new Error(`VisualTemplate ${templateId} not found for user ${userId}`);
    const brand = await getBrandSettings(userId);  // { name, color, signature }

    // 3. Valider les vars
    const schema = variablesSchemaToZod(parseVariablesSchema(template.variablesSchema));
    const validatedVars = schema.parse(vars);

    // 4. Compile + render
    const html = compileTemplate({ template, vars: validatedVars, brand });
    const png  = await deps.renderHtmlToPng({
      html, width: template.width, height: template.height,
    });

    // 5. Upload + persistance selon mode
    if (mode === 'preview') {
      const key = `visual-previews/${userId}/${jobKey}.png`;
      await deps.storage.upload({ key, body: png, contentType: 'image/png' });
      const signedUrl = await deps.storage.signedUrl({ key, expiresInSeconds: 3600 });
      return { mode: 'preview', previewKey: key, signedUrl,
               width: template.width, height: template.height };
    }

    // mode === 'final'
    if (!postId) throw new Error('postId required for mode=final');
    const post = await getPost(userId, postId);
    if (!post) throw new Error(`Post ${postId} not found for user ${userId}`);

    const mediaId = createId();
    const assetKey = `media/${userId}/${mediaId}.png`;
    const previewKey = assetKey;  // pas de variant preview pour MVP
    await deps.storage.upload({ key: assetKey, body: png, contentType: 'image/png' });

    await createMedia(userId, {
      kind: 'image',
      assetKey, previewKey,
      width: template.width, height: template.height,
    }, mediaId);  // overload createMedia pour accepter un id pré-généré
    await createImageAsset(userId, {
      mediaId, source: 'template', templateSlug: template.slug, vars: validatedVars,
    });
    await updatePost(userId, postId, { mediaId });

    const signedUrl = await deps.storage.signedUrl({ key: assetKey, expiresInSeconds: 3600 });
    return { mode: 'final', mediaId, signedUrl,
             width: template.width, height: template.height };
  };
}
```

**Enregistrement dans `src/worker/index.ts`** : ajout d'un Worker `render-visual` avec `concurrency: 2` (Puppeteer pèse 200-400MB par instance Chrome ; 2 jobs en parallèle suffisent au MVP). Inject `getStorage()` et `renderHtmlToPng`.

**`createMedia` accepte un id explicite** : modification mineure du repository — la signature devient `createMedia(userId, data, id?)`. Si `id` fourni, on l'utilise au lieu de `createId()`. Permet de générer l'id côté worker pour l'inclure dans la clé R2 avant l'INSERT.

### Server Actions

**Back-office** (`src/app/(app)/settings/visual-templates/`) :

- `new/actions.ts` + `new/actions-core.ts` : `createVisualTemplateAction(prev, FormData)` → valide tous les champs (slug regex, dimensions [1, 10000], JSON valide pour variables_schema et sample_vars, vars Zod-valide vs schema, Handlebars compile sans erreur dry-run) → `createVisualTemplate(userId, ...)` → redirect list.
- `[id]/actions.ts` + `[id]/actions-core.ts` : `updateVisualTemplateAction`, `deleteVisualTemplateAction`.
- `[id]/preview-actions.ts` : `enqueueRenderPreviewAction({ templateId, vars })` → enqueue job avec `mode: 'preview'` → return `{ jobKey }`. Le client poll via `useJobPolling`.

**Post media picker** (`src/app/(app)/posts/[id]/`) :

- `media-actions.ts` :
  - `enqueueRenderPreviewAction({ templateId, vars })` (idem back-office, partagé via helper).
  - `enqueueRenderFinalAction({ templateId, vars, postId })` → enqueue job avec `mode: 'final'` → return `{ jobKey }`.
  - `detachMediaAction({ postId })` → set `posts.media_id = null` (ne supprime pas le media row, qui peut être reused).

**Validation au save d'un template** (côté `actions-core.ts`) — ordre et règles :

1. `label` non-vide, max 100.
2. `slug` regex `^[a-z0-9-]+$`, max 60.
3. `platform` enum `['linkedin']` (extensible plus tard).
4. `width`, `height` entiers `[1, 10000]`.
5. `variables_schema` : JSON.parse OK → `parseVariablesSchema` Zod OK (chaque variable a `name`, `label`, `type: 'string'`, `max`).
6. `sample_vars` : JSON.parse OK → validé par `variablesSchemaToZod(schema).parse(sampleVars)`.
7. `body_html` : `Handlebars.compile(...)` ne throw pas (dry-run avec strict mode).
8. `css` : `Handlebars.compile(...)` ne throw pas. Pas de `<` ou `</style>` (sanity check, refuse si présent).
9. **Pas de preview obligatoire au save** (≠ v1 spec) : le user peut cliquer un bouton "Prévisualiser" séparé qui enqueue un render et affiche le résultat. Justification : Puppeteer est isolé dans le worker (pas accessible sync depuis la Server Action), et bloquer le save sur un round-trip queue ralentit l'itération admin.

**Suppression bloquée si références** : avant `DELETE`, count `SELECT COUNT(*) FROM image_assets WHERE template_slug = ?`. Si > 0, refuse avec message "X visuels référencent ce template. Supprime-les d'abord ou détache-les."

### Pages back-office

`/settings/visual-templates` (liste) :

- Server Component qui fait `listVisualTemplates(userId)`.
- Header : titre + bouton "+ Nouveau".
- Liste de cards : label, platform, dimensions, slug. Click → `/settings/visual-templates/[id]`.

`/settings/visual-templates/new` (création) :

- Form `<VisualTemplateForm mode="create" action={createVisualTemplateAction} />`.

`/settings/visual-templates/[id]` (édition + delete) :

- Form `<VisualTemplateForm mode="edit" initial={...} action={updateVisualTemplateAction} />`.
- `<DangerZone>` avec bouton "Supprimer" + dialog confirm.
- `<PreviewPanel templateId={template.id} sampleVars={template.sampleVars} />` : panneau latéral avec bouton "Prévisualiser avec sample_vars" qui appelle `enqueueRenderPreviewAction` → poll → affiche `<img src={signedUrl}>`.

**Composant partagé `<VisualTemplateForm>`** :

- Champs : `label`, `slug`, `platform` (select readonly `linkedin`), `width`, `height`.
- Textarea monospace pour `body_html`.
- Textarea monospace pour `css`.
- Editeur `<VariablesSchemaEditor>` :
  - Repeater visuel : chaque variable est une row (icon drag + champs `name` / `label` / `description` / `type` (select, MVP = `string` seul) / `min` / `max` / `optional` (checkbox) + bouton supprimer).
  - Bouton "+ Ajouter une variable".
  - Sérialisé en JSON dans un hidden `<input name="variablesSchema">` au submit.
- Textarea monospace pour `sample_vars` (JSON brut). Aide : "Valeurs d'exemple selon le schéma au-dessus. Sert au preview."
- Erreurs par champ (pattern shadcn standard de v2).

### Page post : UI media picker

Modification de `src/app/(app)/posts/[id]/_components/post-editor.tsx` :

- Si `post.mediaId === null` : remplacer la pastille "Pas de visuel" par un bouton "+ Ajouter un visuel" qui ouvre `<AddVisualDialog post={post} />`.
- Si `post.mediaId !== null` : afficher le visuel en haut (max 400px de large, image responsive), avec un bouton "Détacher" (`detachMediaAction`) et un bouton "Remplacer" (rouvre le dialog).

**Composant `<AddVisualDialog>`** :

- Étape 1 (sélection template) : liste des templates du user, card cliquable. Si vide, message "Crée d'abord un template depuis /settings/visual-templates".
- Étape 2 (formulaire vars) : `<VariablesForm schema={template.variablesSchema} initial={template.sampleVars} />` qui auto-génère les inputs selon le DSL (pour MVP : tous des `<Input>` ou `<Textarea>` si `max > 80`). Validation HTML maxLength + JS au blur.
- Boutons :
  - **"Aperçu"** : appelle `enqueueRenderPreviewAction` → poll → affiche `<img>` dans une zone preview du dialog. Bouton désactivé pendant le polling.
  - **"Valider et attacher"** : appelle `enqueueRenderFinalAction` → poll → on completion, `router.refresh()` + toast "Visuel ajouté" + close dialog. Désactivé pendant polling.

Le hook `useJobPolling` existant (Spec 4) est réutilisé avec `opts.queue = 'render-visual'` et `opts.defaultToast = false` (on gère nos propres toasts).

### Brand context

Helper `getBrandSettings(userId)` dans `src/lib/db/repositories/settings.ts` (à étendre si pas déjà présent) retourne `{ name: string; color: string; signature: string | null }` depuis la table `settings`. Exposé automatiquement dans le contexte Handlebars sous `brand.*`. Permet aux templates d'utiliser `{{brand.color}}`, `{{brand.signature}}`, `{{brand.name}}` sans configuration par template.

## Tests

### Unit (`vitest --project=unit`)

- `test/unit/visual-templates-dsl.test.ts` :
  - `parseVariablesSchema` accepte un schéma valide, throw sur schéma invalide (variable sans `max`, type inconnu, name dupliqué).
  - `variablesSchemaToZod` : string min/max marche, optional accepte vide, required refuse vide.
  - Round-trip : `parseVariablesSchema(JSON.stringify(s))` === s.

- `test/unit/visual-templates-compile.test.ts` :
  - Compile basique avec une variable string : `{{title}}` → escape HTML, interpolation OK.
  - Helpers : `{{ifNotEmpty}}` skip si vide, render si non-vide. `{{trim}}` strip whitespace.
  - Contexte brand exposé : `{{brand.color}}` → hex de la settings.
  - Erreur Handlebars (variable required manquante en strict mode) throw avec message clair.
  - Pas de test Puppeteer ici (unit pur, sans worker).

### Integration (`vitest --project=integration`)

- `test/integration/visual-templates-repository.test.ts` : CRUD + tenant isolation (user A ne voit pas les templates de user B, ne peut pas les éditer/supprimer).
- `test/integration/visual-template-create-action.test.ts` : valide tous les chemins d'erreur (slug invalide, JSON cassé, vars sample non-conformes, Handlebars cassé).
- `test/integration/visual-template-edit-action.test.ts` : update partiel, slug duplicate sur le même user, delete bloqué si `image_assets` référence le slug.
- `test/integration/tenant-isolation.test.ts` : étendre la sentinelle existante pour couvrir `visual_templates`.

### Worker (`vitest --project=worker`)

- `test/worker/render-visual.test.ts` :
  - **Happy path mode=preview** : enqueue → assert PNG uploadé en storage InMemory à `visual-previews/{userId}/{jobKey}.png`, signedUrl retournée, pas de media row créée.
  - **Happy path mode=final** : enqueue avec postId → assert PNG uploadé, media row créée (kind=image, dimensions), image_asset row créée (source=template, templateSlug, vars), `posts.media_id` mis à jour.
  - **Template introuvable** : throw avec message clair, pas de PNG uploadé.
  - **Vars invalides** : throw au parse Zod avant tout upload.
  - **Mock renderHtmlToPng** : injecté via deps, retourne un Buffer fake (`Buffer.from('FAKE_PNG')`). Pas de Puppeteer en CI.

### E2E Playwright (`test:e2e`)

- `test/e2e/visual-templates.spec.ts` :
  - Login → `/settings/visual-templates` vide → "+ Nouveau" → remplit le form (label, slug, dimensions, HTML simple `<h1>{{title}}</h1>`, CSS basique, 1 variable `title` max 50, sample `{"title": "Hello"}`) → "Créer" → assert redirect liste → assert apparition du template.
  - Sur la page d'édition → bouton "Prévisualiser" → polling spinner → image apparaît dans le panneau preview.
- `test/e2e/post-visual.spec.ts` :
  - Login → un post existe (fixture inséré DB-side) → `/posts/[id]` → "Ajouter un visuel" → sélection template (fixture seedée) → remplit le form vars → "Valider et attacher" → polling → toast → assert visuel affiché en haut du post.
  - Bouton "Détacher" → assert visuel disparaît, pastille "Pas de visuel" réapparaît.

**Stub Puppeteer en E2E** : variable d'env `CONTENT_OS_PUPPETEER_STUB=1`. Si set, `renderHtmlToPng` retourne un PNG 1x1 fake (pas de Chromium lancé). Cohérent avec `CONTENT_OS_AI_STUB` de Spec 4. Permet à CI de tourner sans installer Chromium.

## Décisions techniques tranchées

- **Renderer** : Puppeteer dans worker BullMQ. Choix utilisateur (brainstorm) pour fidélité v1 totale. Trade-off accepté : ~170Mo de binaire dans le worker, cold start 1-2s. Worker concurrency = 2 (mémoire par instance Chrome).
- **Format DSL des variables** : JSON maison versionné via Zod méta-schéma, **pas JSON Schema**. Choix utilisateur (brainstorm) pour lisibilité, mapping UI/Zod déterministe, évolution maîtrisée.
- **Templating** : Handlebars 4.x, strict mode au compile. Helpers minimaux. Triple-stash interdit MVP.
- **Base CSS en code, pas en DB** : fonts AVQN-owned, change avec le déploiement, pas besoin d'édition runtime. Promu en DB si on multi-tenant les brand assets plus tard.
- **Préview au save : non bloquant** (≠ v1 spec). Bouton séparé qui passe par la queue. Validation au save = JSON parse + Handlebars dry-run (cheap, synchrone).
- **Scoping `user_id` strict sur `visual_templates`** : cohérent avec `writing_templates`. Pas de templates système partagés au MVP. Les seeds v1 sont copiés au compte du user via script manuel `scripts/seed-visual-templates.ts --user-id=...`.
- **Modes preview vs final dans le même job** : un seul type de worker, payload discriminant `mode`. Preview n'écrit pas en DB (juste upload + signedUrl). Final écrit `media` + `image_assets` + update `posts.media_id`.
- **Préviews orphelins en R2** : laissés s'accumuler au MVP. À cleaner via cron Spec 8 (delete `visual-previews/*` > 24h).
- **`createMedia` accepte un id explicite** : refactor mineur pour permettre au worker de générer l'id avant l'INSERT (et donc construire la clé R2). Pas de breaking change car le param `id` est optionnel.

## Migration & déploiement

1. `npm run db:generate` → produit la migration Drizzle additive pour `visual_templates`.
2. `npm run db:migrate` en local.
3. `npm install puppeteer handlebars` (nouvelles deps runtime). Puppeteer télécharge Chromium au postinstall (~200MB). Documenté dans le README et `.env.example`.
4. Pas de variable d'env requise pour Puppeteer en local. Variable optionnelle `CONTENT_OS_PUPPETEER_STUB=1` pour CI/E2E.
5. Démarrer `npm run worker` (qui maintenant porte 3 queues : dummy, generate-post, render-visual).
6. Script seed : `tsx scripts/seed-visual-templates.ts --user-id=<id>` à lancer manuellement après signup d'un nouveau user (pas au boot, pour rester explicite).
7. Pas d'impact sur les users existants — purement additif. Les posts existants sans média gardent leur pastille "Pas de visuel" remplacée par "+ Ajouter un visuel".

## Critères de réussite

- Un user signé peut accéder à `/settings/visual-templates` (vide ou peuplé).
- Il crée un template via le form : label, slug, dimensions, HTML basique, CSS basique, 1 variable string. Validation côté client + serveur. Apparition dans la liste.
- Il édite le template, change le HTML, clique "Prévisualiser" → polling → image apparaît dans le panneau.
- Il supprime le template : confirmé, disparaît de la liste.
- Il tente de supprimer un template référencé par un `image_assets` : refusé avec message explicite.
- Sur `/posts/[id]` sans visuel : bouton "+ Ajouter un visuel" visible.
- Il clique : dialog s'ouvre → sélectionne le template seedé → form pré-rempli avec sample_vars → "Aperçu" → polling → image apparaît → "Valider" → polling → toast → image affichée en haut du post.
- Bouton "Détacher" : visuel disparaît, état initial restauré.
- Deux users distincts ne voient jamais leurs templates l'un de l'autre (sentinelle tenant isolation verte).
- `npm test` vert (unit + integration + worker, sans Puppeteer en CI grâce au stub).
- `npm run test:e2e` vert en local (avec Puppeteer réel ou stub via env var).
- `npm run lint` + `npm run format` clean.
- Aucun appel sync à Puppeteer depuis le code `web` : tout passe par la queue.

## Hors-scope rappelé

- Upload manuel d'image depuis l'ordinateur (Spec 6).
- Génération d'image via IA (Gemini / autre) (Spec 6).
- Réutilisation d'image existante (médiathèque) (Spec 6).
- Variables d'image dans les templates (before/after, etc.) (Spec 6, après le module upload+IA).
- Variables `color`, `list`, `toggle`, `richtext` (Spec 6 ou Spec 7).
- Multi-images par post côté UI (Spec 6 ou ultérieure).
- Carousels et vidéos (Spec 7+, déjà couvert par `media_kind`).
- Versioning historique des templates (Spec 8+).
- Templates système partagés multi-user (Spec 8+, lié au multi-tenant).
- Editeur visuel WYSIWYG des templates (Spec 8+).
- Cleanup automatique des previews orphelins en R2 (Spec 8, cron).
- Snapshot golden tests pixel-match pour fidélité v1 (utile mais lourd, peut être ajouté plus tard si on découvre des régressions).
