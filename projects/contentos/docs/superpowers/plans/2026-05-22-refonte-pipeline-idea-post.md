# Refonte pipeline idée → post — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Simplifier le pipeline `generatePost` à `write + polish`, refondre le schema `ideas` (champs `idea` + `brief`, 1→N posts, plus de status), sortir le visuel du pipe auto, nettoyer le code mort associé.

**Architecture:** Refactor cross-fichier qui touche `src/db.ts` (schema + helpers), `src/generate.ts` (pipeline), `src/server.ts` (routes), `src/views/ideas.ts` (UI liste + détail), `src/views/components.ts` (helpers status devenus inutiles), et un ajustement mineur sur `src/views/posts/cards.ts` (pastille "visuel manquant"). Base SQLite jetable, migration par wipe manuel. Tests : un smoke-script sur les nouvelles fonctions db + vérification visuelle dans le navigateur.

**Tech Stack:** TypeScript ESM (tsx watch), Hono, better-sqlite3, HTMX. Pas de framework de test : on suit le pattern existant `scripts/smoke-*.ts` lancés via `npm run test`.

**Référence spec :** `docs/superpowers/specs/2026-05-22-refonte-pipeline-idea-post-design.md`

---

## File structure

**Modifiés :**

- `src/db.ts` : recréation table `ideas`, type `Idea`, suppression `IdeaStatus`, refonte helpers ideas, ajout `listPostsByIdea`, `getCounts` retire le filtre `status != 'used'`.
- `src/generate.ts` : suppression `research`, `plan`, `MODEL_HAIKU` ; refonte `generatePost` ; adaptation `write` et `polish` à la nouvelle shape `Idea`.
- `src/server.ts` : refonte handlers `POST /ideas`, `POST /ideas/:id/generate` ; ajout `PATCH /ideas/:id` ; suppression `GET /visual-options` ; ajustement `GET /ideas/:id` et `GET /ideas/:id/panel`.
- `src/views/ideas.ts` : refonte complète de `ideaForm`, `ideaCard`, `ideaDetailPage`, `ideaPanelFragment` ; suppression `visualSelect`, `styleSelect`, `generationPanel`.
- `src/views/components.ts` : `statusBadge` ne prend plus `IdeaStatus` ; suppression `ideaActionLabel`, `isIdeaInProgress` ; renommage `idea.content → idea.idea` dans `ideaPreview` ; nettoyage des labels `STATUS_LABELS` propres aux idées.
- `src/views/posts/cards.ts` : ajout d'une pastille discrète "visuel manquant" quand `post.visual_id === null` ; vérification que l'état vide du slot visuel reste neutre (pas marqué comme un échec).

**Créés :**

- `scripts/smoke-ideas-pipeline.ts` : script de smoke-test sur les helpers DB ideas (création avec/sans brief, update, listing, comptage de posts liés). Ne fait pas d'appel Claude/Gemini.

**Non touchés :** `src/visuals/`, `src/styleguides/`, `src/previews/`, `src/social/`, `src/platforms.ts`, `src/render.ts`, `src/worker.ts`, `src/crypto.ts`, `src/prompts/voice.md`, `.claude/skills/`.

---

## Task 1 : Schema DB et types

**Files:**
- Modify: `src/db.ts:15-129` (CREATE TABLE ideas), `src/db.ts:183-314` (types et helpers Idea), `src/db.ts:276-286` (listIdeas + getCounts).

- [ ] **Step 1: Recréer la table `ideas` dans le `db.exec()`**

Remplacer le bloc `CREATE TABLE IF NOT EXISTS ideas (...)` à `src/db.ts:16-23` par :

```ts
  CREATE TABLE IF NOT EXISTS ideas (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idea TEXT NOT NULL,
    brief TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
```

Aucun index à ajouter (l'index `posts_idea_id_idx` existe déjà ligne 58).

- [ ] **Step 2: Supprimer le type `IdeaStatus` et recâbler le type `Idea`**

Dans `src/db.ts:183`, supprimer cette ligne :

```ts
export type IdeaStatus = 'fresh' | 'researching' | 'planning' | 'writing' | 'polishing' | 'used' | 'failed';
```

Remplacer le type `Idea` (lignes 194-201) par :

```ts
export type Idea = {
  id: number;
  idea: string;
  brief: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3: Refondre `listIdeas` et `getCounts`**

Remplacer `listIdeas()` (ligne 276-278) :

```ts
export function listIdeas(): Idea[] {
  return db.prepare(`SELECT * FROM ideas ORDER BY updated_at DESC`).all() as Idea[];
}
```

Remplacer `getCounts()` (lignes 280-286) :

```ts
export function getCounts(): { ideas: number; posts: number; templates: number; visuals: number } {
  const ideas = (db.prepare('SELECT COUNT(*) as c FROM ideas').get() as { c: number }).c;
  const posts = (db.prepare('SELECT COUNT(*) as c FROM posts').get() as { c: number }).c;
  const templates = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c;
  const visuals = (db.prepare('SELECT COUNT(*) as c FROM visuals').get() as { c: number }).c;
  return { ideas, posts, templates, visuals };
}
```

- [ ] **Step 4: Refondre `addIdea`, `updateIdea` et ajouter `listPostsByIdea`**

Remplacer `addIdea` (lignes 301-304) :

```ts
export function addIdea(opts: { idea: string; brief?: string | null }): Idea {
  const result = db
    .prepare('INSERT INTO ideas (idea, brief) VALUES (?, ?)')
    .run(opts.idea, opts.brief ?? null);
  return getIdea(result.lastInsertRowid as number)!;
}
```

Remplacer le type `IdeaPatch` et `updateIdea` (lignes 306-314) :

```ts
type IdeaPatch = Partial<Pick<Idea, 'idea' | 'brief'>>;

export function updateIdea(id: number, patch: IdeaPatch): Idea | undefined {
  const keys = Object.keys(patch) as (keyof IdeaPatch)[];
  if (!keys.length) return getIdea(id);
  const sets = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => patch[k] ?? null);
  db.prepare(`UPDATE ideas SET ${sets}, updated_at = datetime('now') WHERE id = ?`).run(...values, id);
  return getIdea(id);
}
```

Ajouter après `getPostByIdea` (ligne 294-296), la fonction `listPostsByIdea` :

```ts
export function listPostsByIdea(ideaId: number): Post[] {
  return db
    .prepare(`SELECT ${POST_COLUMNS} FROM posts WHERE idea_id = ? ORDER BY id DESC`)
    .all(ideaId) as Post[];
}
```

`POST_COLUMNS` est déjà défini ligne 316.

- [ ] **Step 5: Vérifier que le typecheck ne pète pas hors des fichiers à toucher dans les tasks suivantes**

Run: `npx tsc --noEmit`

Attendu : erreurs SEULEMENT dans `src/generate.ts`, `src/server.ts`, `src/views/ideas.ts`, `src/views/components.ts` (les fichiers qu'on va modifier dans les tasks 2 à 5). Si erreurs ailleurs, identifier et corriger avant de continuer.

- [ ] **Step 6: Wipe la base locale et redémarrer pour valider le nouveau schema**

Run: `rm -f data/avqn.db && npx tsx -e "import('./src/db.js').then(() => console.log('boot OK'))"`

Attendu : `boot OK` affiché, fichier `data/avqn.db` recréé. Confirme que le `CREATE TABLE` + seeds passent sans erreur.

- [ ] **Step 7: Commit**

```bash
git add src/db.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(db): refonte schema ideas (idea + brief, plus de status)

Schema ideas passe à 2 champs métier (idea, brief), suppression de
content/research/plan/status. listIdeas trie par updated_at, getCounts
n'a plus le filtre status != 'used'. addIdea/updateIdea recâblés sur la
nouvelle shape. listPostsByIdea ajouté pour le rendu 1 idée → N posts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Pipeline `generatePost` simplifié

**Files:**
- Modify: `src/generate.ts:31-219` (suppression research/plan/MODEL_HAIKU/lintEditorial inchangé) ; `src/generate.ts:648-704` (refonte generatePost).

- [ ] **Step 1: Supprimer `MODEL_HAIKU` et l'usage de `web_search`**

Dans `src/generate.ts:44-46`, supprimer la ligne :

```ts
const MODEL_HAIKU = 'claude-haiku-4-5-20251001';
```

- [ ] **Step 2: Supprimer les fonctions `research()` et `plan()`**

Dans `src/generate.ts:105-152`, supprimer intégralement les deux fonctions `async function research(idea: Idea): Promise<string>` et `async function plan(idea: Idea, researchText: string, systemPrompt: string): Promise<string>`.

- [ ] **Step 3: Refondre la fonction `write()`**

Remplacer `src/generate.ts:159-179` par :

```ts
async function write(idea: Idea, systemPrompt: string): Promise<string> {
  const briefBody = idea.brief?.trim() ?? '';
  const response = await claude.messages.create({
    model: MODEL_SONNET,
    max_tokens: 1500,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `Idée : ${idea.idea}

Brief :
${briefBody}

Rédige le post final en respectant strictement la voix éditoriale, la structure cible et les contraintes plateforme.

${OUTPUT_FORMAT_INSTRUCTION}`,
      },
    ],
  });
  return extractText(response);
}
```

- [ ] **Step 4: Adapter `polish()` à la nouvelle shape `Idea`**

Dans `src/generate.ts:181-209`, remplacer la seule ligne qui référence `idea.content` :

```ts
        content: `Idée d'origine : ${idea.content}
```

par :

```ts
        content: `Idée d'origine : ${idea.idea}
```

Le reste de la fonction `polish()` est inchangé.

- [ ] **Step 5: Refondre `generatePost()`**

Remplacer `src/generate.ts:648-704` par :

```ts
export async function generatePost(
  ideaId: number,
  templateId: number | null = null,
): Promise<Post> {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error(`Idée ${ideaId} introuvable`);
  if (!idea.brief?.trim()) throw new Error(`Idée ${ideaId} sans brief : impossible de générer`);

  const template = resolveTemplate(templateId);
  const systemPrompt = buildSystemPrompt(template);

  const draft = await write(idea, systemPrompt);
  const polished = await polish(idea, draft, systemPrompt);
  const content = lintEditorial(polished);

  const post = addPostWithTemplate({
    ideaId,
    content,
    templateId: template.id,
    visualId: null,
  });

  const activeAccount = getActiveSocialAccountForPlatform(template.platform);
  if (activeAccount) linkPostToSocialAccount(post.id, activeAccount.id);

  return post;
}
```

- [ ] **Step 6: Supprimer `resolveVisualTemplate()` et `resolveStyle()` du flux `generatePost`**

Vérifier dans le fichier si `resolveVisualTemplate` (lignes 91-103) et `resolveStyle` (lignes 707-716) sont encore appelés ailleurs.

Run: `grep -n "resolveVisualTemplate\|resolveStyle" src/generate.ts`

Si après modification du Step 5 ils n'ont plus aucune référence, supprimer les deux fonctions. Sinon les laisser en place (elles sont peut-être réutilisées par d'autres exports).

- [ ] **Step 7: Nettoyer l'`updateIdea` mort sur statut**

Vérifier qu'il ne reste plus d'appel `updateIdea(ideaId, { status: ... })` dans `src/generate.ts`.

Run: `grep -n "updateIdea" src/generate.ts`

Attendu : 0 résultats. Si présence : ces appels sont morts (le nouveau type `IdeaPatch` n'accepte plus `status`), les supprimer.

- [ ] **Step 8: Nettoyer les imports inutilisés**

Dans le bloc d'import du haut de `src/generate.ts:1-29`, supprimer :

- `getActiveSocialAccountForPlatform` — toujours utilisé.
- `linkPostToSocialAccount` — toujours utilisé.
- `updateIdea` — vérifier avec `grep -n "updateIdea" src/generate.ts`. Si 0 résultat ailleurs que l'import, supprimer.
- Vérifier `IdeaStatus` : ne doit plus être importé (le type a disparu de db.ts).

Run final pour valider : `npx tsc --noEmit src/generate.ts 2>&1 | head -30`

Attendu : aucune erreur dans `src/generate.ts` (les erreurs dans `src/server.ts` et views sont attendues, elles seront résolues dans les tasks suivantes).

- [ ] **Step 9: Commit**

```bash
git add src/generate.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(generate): pipeline réduit à write + polish

Suppression de research(), plan(), MODEL_HAIKU, du web_search Anthropic
et du visuel auto dans generatePost. La fonction prend juste un ideaId
et un template_id optionnel, exige un brief non vide, écrit puis polit,
crée le post sans visuel (à attacher manuellement depuis le drawer).
Adaptation de write() et polish() à la nouvelle shape Idea.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Routes HTTP

**Files:**
- Modify: `src/server.ts:75` (imports views), `src/server.ts:111-189` (routes /ideas), suppression de `GET /visual-options`.

- [ ] **Step 1: Refondre `POST /ideas` pour accepter `idea` + `brief?`**

Remplacer `src/server.ts:115-121` par :

```ts
app.post('/ideas', async (c) => {
  const form = await c.req.formData();
  const idea = String(form.get('idea') ?? '').trim();
  if (!idea) return c.text('Titre vide', 400);
  const briefRaw = String(form.get('brief') ?? '').trim();
  const brief = briefRaw.length > 0 ? briefRaw : null;
  addIdea({ idea, brief });
  return c.html(ideasList(listIdeas()));
});
```

- [ ] **Step 2: Ajouter `PATCH /ideas/:id`**

Insérer après la route `POST /ideas` (vers `src/server.ts:122`) :

```ts
app.patch('/ideas/:id', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.text('id invalide', 400);
  const existing = getIdea(id);
  if (!existing) return c.text('Idée introuvable', 404);
  const form = await c.req.formData();
  const patch: Parameters<typeof updateIdea>[1] = {};
  if (form.has('idea')) {
    const v = String(form.get('idea') ?? '').trim();
    if (!v) return c.text('Titre vide', 400);
    patch.idea = v;
  }
  if (form.has('brief')) {
    const v = String(form.get('brief') ?? '').trim();
    patch.brief = v.length > 0 ? v : null;
  }
  if (Object.keys(patch).length === 0) return c.text('Aucun champ à mettre à jour', 400);
  updateIdea(id, patch);
  return c.body(null, 204);
});
```

- [ ] **Step 3: Refondre `POST /ideas/:id/generate`**

Remplacer `src/server.ts:158-176` par :

```ts
app.post('/ideas/:id/generate', async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.text('id invalide', 400);
  const idea = getIdea(id);
  if (!idea) return c.text('Idée introuvable', 404);
  if (!idea.brief?.trim()) return c.text('Brief requis pour générer', 400);
  const form = await c.req.formData().catch(() => null);
  const rawTpl = form?.get('template_id');
  const templateId = rawTpl != null && String(rawTpl).trim() !== '' ? Number(rawTpl) : null;
  if (templateId !== null && !Number.isInteger(templateId)) return c.text('template_id invalide', 400);
  try {
    await generatePost(id, templateId);
    return c.text('ok');
  } catch (err) {
    console.error(`[generate ${id}] échec:`, err);
    return c.text(err instanceof Error ? err.message : 'erreur', 500);
  }
});
```

- [ ] **Step 4: Supprimer `GET /visual-options`**

Supprimer entièrement `src/server.ts:178-189` (le bloc `app.get('/visual-options', ...)`).

- [ ] **Step 5: Adapter `GET /ideas/:id` (page détail)**

Remplacer `src/server.ts:123-140` par :

```ts
app.get('/ideas/:id', (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isInteger(id)) return c.text('id invalide', 400);
  const idea = getIdea(id);
  if (!idea) return c.text('Idée introuvable', 404);
  return c.html(
    ideaDetailPage({
      idea,
      posts: listPostsByIdea(id),
      templates: listTemplates(),
      counts: getCounts(),
    }),
  );
});
```

- [ ] **Step 6: Adapter `GET /ideas/:id/panel`**

Le handler `src/server.ts:142-148` reste structurellement le même (lecture + render fragment). Le fragment lui-même est adapté dans la Task 4. Vérifier l'import :

Run: `grep -n "ideaPanelFragment" src/server.ts`

Attendu : 1 occurrence dans l'import (ligne ~75) + 1 occurrence dans le handler. OK.

- [ ] **Step 7: Nettoyer les imports de `server.ts`**

Dans l'import des views ideas (`src/server.ts:75`), remplacer :

```ts
import { ideaDetailPage, ideaPanelFragment, ideasList, ideasListPage, visualSelect } from './views/ideas.js';
```

par :

```ts
import { ideaDetailPage, ideaPanelFragment, ideasList, ideasListPage } from './views/ideas.js';
```

Dans le bloc d'import db (`src/server.ts:10-61`), s'assurer que `getIdea`, `getCounts`, `listIdeas`, `addIdea`, `updateIdea`, `deleteIdea`, `listTemplates`, `getTemplate` sont présents. Ajouter `listPostsByIdea` :

Trouver la ligne `listIdeas,` (vers ligne 38) et insérer juste après :

```ts
  listPostsByIdea,
```

Supprimer les imports `getPostByIdea` (ligne 26) et `listVisualsForPlatform`, `listVisualStyles` SI uniquement utilisés pour les routes `/ideas/:id` et `/visual-options` qu'on vient de modifier. Vérifier avant de supprimer :

Run: `grep -n "getPostByIdea\|listVisualsForPlatform\|listVisualStyles" src/server.ts`

Garder ceux qui ont d'autres usages (probablement `listVisualsForPlatform` et `listVisualStyles` sont utilisés ailleurs).

- [ ] **Step 8: Valider le typecheck**

Run: `npx tsc --noEmit src/server.ts 2>&1 | head -30`

Attendu : 0 erreur dans `src/server.ts`. Les erreurs restantes doivent être dans `src/views/ideas.ts` et `src/views/components.ts` (résolues dans Task 4-5).

- [ ] **Step 9: Commit**

```bash
git add src/server.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(server): routes ideas refondues (idea + brief, PATCH inline)

POST /ideas accepte idea (requis) + brief (optionnel). PATCH /ideas/:id
permet l'édition inline. POST /ideas/:id/generate refuse les idées sans
brief et n'accepte plus de visual/style slug. GET /visual-options et le
dropdown visual_template disparaissent (visuel devient 100% manuel).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : UI page `/ideas`

**Files:**
- Modify: `src/views/ideas.ts` (refonte complète), `src/views/components.ts:1,22-25,42-45,61-69` (cleanup helpers idea-status).

- [ ] **Step 1: Refondre `src/views/components.ts`**

Remplacer l'import `src/views/components.ts:1` :

```ts
import type { Idea, IdeaStatus, Post, PostStatus } from '../db.js';
```

par :

```ts
import type { Idea, Post, PostStatus } from '../db.js';
```

Remplacer `STATUS_LABELS` (lignes 5-20) par :

```ts
const STATUS_LABELS: Record<string, string> = {
  draft: 'brouillon',
  validated: 'validé',
  scheduled: 'planifié',
  queued: 'en attente',
  publishing: 'en cours',
  published: 'publié',
  failed: 'échec',
};
```

Remplacer la signature de `statusBadge` (ligne 22) :

```ts
export function statusBadge(status: IdeaStatus | PostStatus): string {
```

par :

```ts
export function statusBadge(status: PostStatus): string {
```

Remplacer `ideaPreview` (lignes 42-45) :

```ts
export function ideaPreview(idea: Idea): string {
  const truncated = idea.idea.length > 220 ? idea.idea.slice(0, 220) + '…' : idea.idea;
  return escapeHtml(truncated);
}
```

Supprimer entièrement `ideaActionLabel` et `isIdeaInProgress` (lignes 61-69).

- [ ] **Step 2: Refondre `ideaForm()` dans `src/views/ideas.ts`**

Remplacer `src/views/ideas.ts:256-268` par :

```ts
export function ideaForm(): string {
  return `<form class="card" hx-post="/ideas" hx-target="#ideas-list" hx-swap="outerHTML"
    hx-on::after-request="this.reset()">
    <h2 class="section-title">Nouvelle idée</h2>
    <div class="stack-sm">
      <input class="input" name="idea" placeholder="Titre de l'idée" required />
      <textarea class="textarea" name="brief" placeholder="Brief (optionnel) : décris l'angle, le contexte, les exemples..."></textarea>
      <div class="row">
        <button class="btn btn-primary" type="submit">Ajouter</button>
        <span class="muted xs">Tu pourras éditer le brief et générer un post depuis la liste.</span>
      </div>
    </div>
  </form>`;
}
```

- [ ] **Step 3: Refondre `ideaCard()` dans `src/views/ideas.ts`**

Remplacer `src/views/ideas.ts:280-318` par :

```ts
export function ideaCard(idea: Idea, posts: Post[], templates: Template[]): string {
  const canGenerate = !!idea.brief?.trim() && templates.length > 0;
  const tplOptions = templates
    .map((t, i) => `<option value="${t.id}"${i === 0 ? ' selected' : ''}>${escapeHtml(t.name)} (${escapeHtml(t.platform)})</option>`)
    .join('');
  const postsBadge = posts.length
    ? `<div class="card-meta">${posts.length} post${posts.length > 1 ? 's' : ''} générés : ${posts
        .map((p) => `<a href="/posts/${p.id}">#${p.id}</a>`)
        .join(' · ')}</div>`
    : '';

  return `<div class="card" id="idea-card-${idea.id}">
    <div class="card-header">
      <span class="card-meta">#${idea.id} · ${escapeHtml(formatDate(idea.created_at))}</span>
      <span class="spacer"></span>
      ${modalTrigger({
        modalId: deleteIdeaModalId(idea.id),
        label: '',
        icon: iconTrash(),
        className: 'icon-btn',
        ariaLabel: `Supprimer l'idée #${idea.id}`,
      })}
    </div>
    <input class="input"
      name="idea"
      value="${escapeHtml(idea.idea)}"
      hx-patch="/ideas/${idea.id}"
      hx-trigger="blur changed"
      hx-include="this"
      hx-swap="none"
      placeholder="Titre de l'idée" />
    <textarea class="textarea"
      name="brief"
      hx-patch="/ideas/${idea.id}"
      hx-trigger="blur changed"
      hx-include="this"
      hx-swap="none"
      placeholder="Brief : décris l'angle, le contexte, les exemples...">${escapeHtml(idea.brief ?? '')}</textarea>
    ${postsBadge}
    <form class="row" hx-post="/ideas/${idea.id}/generate"
      hx-disabled-elt="find button"
      hx-on::after-request="window.location.reload()">
      <select class="input" name="template_id" style="max-width: 240px;">${tplOptions}</select>
      <button class="btn btn-primary btn-sm" type="submit" ${canGenerate ? '' : 'disabled'}>
        Générer un post<span class="htmx-indicator spin"></span>
      </button>
    </form>
    ${deleteIdeaModal(idea, {})}
  </div>`;
}
```

- [ ] **Step 4: Adapter `ideasListPage` pour passer les data nécessaires**

Remplacer `src/views/ideas.ts:35-50` par :

```ts
export function ideasListPage(opts: {
  ideas: Idea[];
  postsByIdeaId: Map<number, Post[]>;
  templates: Template[];
  counts: LayoutCounts;
}): string {
  return layout({
    title: 'Idées',
    active: 'ideas',
    counts: opts.counts,
    body: `
      <div class="stack">
        ${ideaForm()}
        <section class="stack-sm">
          <h2 class="section-title">${opts.ideas.length} idée${opts.ideas.length > 1 ? 's' : ''}</h2>
          ${ideasList(opts.ideas, opts.postsByIdeaId, opts.templates)}
        </section>
      </div>
    `,
  });
}
```

Et `ideasList` (lignes 270-278) :

```ts
export function ideasList(
  ideas: Idea[],
  postsByIdeaId: Map<number, Post[]>,
  templates: Template[],
): string {
  if (!ideas.length) {
    return `<div id="ideas-list">${emptyState({
      title: 'Aucune idée pour le moment',
      description: 'Capture ta première idée avec le formulaire au-dessus.',
    })}</div>`;
  }
  return `<div id="ideas-list" class="list">${ideas
    .map((idea) => ideaCard(idea, postsByIdeaId.get(idea.id) ?? [], templates))
    .join('\n')}</div>`;
}
```

- [ ] **Step 5: Refondre `ideaDetailPage` et `ideaPanelFragment`**

Remplacer `src/views/ideas.ts:52-131` par :

```ts
export function ideaDetailPage(opts: {
  idea: Idea;
  posts: Post[];
  templates: Template[];
  counts: LayoutCounts;
}): string {
  const { idea, posts, templates } = opts;
  return layout({
    title: `Idée #${idea.id}`,
    active: 'ideas',
    counts: opts.counts,
    topbarRight: `
      ${modalTrigger({
        modalId: deleteIdeaModalId(idea.id),
        label: 'Supprimer',
        icon: iconTrash(),
        className: 'btn btn-ghost btn-sm',
      })}
      <a href="/ideas" class="btn btn-ghost btn-sm">← Retour</a>
    `,
    body: `
      <div class="stack">
        <div class="row">
          <span class="card-meta">#${idea.id} · créé le ${escapeHtml(formatDate(idea.created_at))}</span>
        </div>
        ${deleteIdeaModal(idea, { onSuccessJs: "window.location='/ideas'" })}
        ${ideaCard(idea, posts, templates)}
      </div>
    `,
  });
}
```

Remplacer `ideaPanelFragment` (lignes 222-254) par :

```ts
export function ideaPanelFragment(idea: Idea): string {
  return `<div class="stack">
    <div class="row">
      <span class="card-meta">#${idea.id} · ${escapeHtml(formatDate(idea.created_at))}</span>
      <span class="spacer"></span>
      <a class="btn btn-ghost btn-sm" href="/ideas/${idea.id}">Ouvrir →</a>
    </div>

    <article class="card">
      <h3 class="section-title">${escapeHtml(idea.idea)}</h3>
      ${idea.brief ? `<pre class="post-read">${escapeHtml(idea.brief)}</pre>` : '<p class="muted">Pas de brief.</p>'}
    </article>
  </div>`;
}
```

- [ ] **Step 6: Supprimer le code mort du fichier**

Dans `src/views/ideas.ts`, supprimer entièrement :

- `generationPanel()` (lignes 133-180)
- `styleSelect()` (lignes 185-201)
- `visualSelect()` (lignes 205-218)
- Les imports devenus inutiles. Remplacer le bloc d'import en haut du fichier par :

```ts
import type { Idea, Post, Template } from '../db.js';
import { escapeHtml, layout, type LayoutCounts } from './layout.js';
import {
  confirmModal,
  emptyState,
  formatDate,
  iconTrash,
  modalTrigger,
} from './components.js';
```

- [ ] **Step 7: Adapter le modal de suppression**

Remplacer `deleteIdeaModal()` (lignes 20-33) pour qu'il ne référence plus `idea.status` :

```ts
function deleteIdeaModal(idea: Idea, opts: { onSuccessJs?: string }): string {
  return confirmModal({
    id: deleteIdeaModalId(idea.id),
    title: 'Supprimer cette idée ?',
    message:
      'Cette idée sera définitivement supprimée. Les posts générés depuis cette idée sont aussi supprimés.',
    confirmLabel: 'Supprimer',
    variant: 'danger',
    confirmAttrs: `hx-delete="/ideas/${idea.id}" hx-target="#ideas-list" hx-swap="outerHTML"`,
    onSuccessJs: opts.onSuccessJs,
  });
}
```

- [ ] **Step 8: Adapter le handler `GET /ideas` dans `src/server.ts`**

Remplacer `src/server.ts:111-113` par :

```ts
app.get('/ideas', (c) => {
  const ideas = listIdeas();
  const postsByIdeaId = new Map<number, Post[]>();
  for (const idea of ideas) {
    postsByIdeaId.set(idea.id, listPostsByIdea(idea.id));
  }
  return c.html(ideasListPage({
    ideas,
    postsByIdeaId,
    templates: listTemplates(),
    counts: getCounts(),
  }));
});
```

Ajouter l'import du type `Post` en haut de `src/server.ts` si pas déjà présent (vérifier le bloc d'import db).

Run: `grep -n "type Post" src/server.ts`

Si absent, ajouter `Post,` dans le `import type { ... }` à la fin du bloc d'import db (autour de la ligne 58).

- [ ] **Step 9: Valider que le serveur compile et démarre**

Run: `npx tsc --noEmit`

Attendu : 0 erreur.

Run: `rm -f data/avqn.db && npm run dev` puis dans un autre terminal `curl -s http://localhost:3000/ideas | head -20 && curl -s http://localhost:3000/healthz`

Attendu : `/ideas` retourne du HTML qui inclut le formulaire `Nouvelle idée`, `/healthz` retourne `ok`.

Tuer le serveur : `Ctrl+C`.

- [ ] **Step 10: Commit**

```bash
git add src/views/ideas.ts src/views/components.ts src/server.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(views/ideas): UI refondue (idée + brief, édition inline)

Card idée avec input titre + textarea brief, blur-to-save vers PATCH
/ideas/:id, bouton Générer désactivé tant que brief vide, liste des
posts liés en pastilles. Suppression de la progression researching/
planning/writing/polishing, plus de dropdown visual/style. Nettoyage
des helpers idea-status devenus morts dans components.ts.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Pastille "visuel manquant" sur la card post

**Files:**
- Modify: `src/views/posts/cards.ts` (ajout pastille + vérif libellés du slot vide).

- [ ] **Step 1: Identifier l'endroit où apparaît le slot visuel vide dans `postCard()`**

Run: `grep -n "visual_id\|Aucun visuel\|slot.*visuel\|Générer.*visuel" src/views/posts/cards.ts`

Lire le bloc qui rend l'absence de visuel dans la card draft (autour de la première occurrence de `visual_id == null` ou similaire). Identifier la position où ajouter la pastille discrète sur la card list (pas dans le drawer ni le slot principal).

- [ ] **Step 2: Ajouter une pastille "visuel manquant" dans le header de la card draft**

Dans le rendu de la card post status `draft`, dans la zone du `card-header` ou `card-meta` (en haut, à côté du status badge), insérer une pastille conditionnelle. Pattern à appliquer (adapter au DOM exact du fichier) :

```ts
${post.visual_id == null && post.status === 'draft'
  ? `<span class="badge badge-soft" title="Aucun visuel attaché">visuel manquant</span>`
  : ''}
```

La pastille doit apparaître UNIQUEMENT pour les posts `draft` sans `visual_id`. Sur un post `validated/published/etc.`, l'absence de visuel est un choix éditorial assumé, pas un manque.

- [ ] **Step 3: Vérifier que l'état vide du slot visuel est neutre**

Relire le bloc qui rend le slot visuel quand `visual_id` est null. Si le texte affiché ressemble à "Génération de visuel échouée" ou "Erreur de visuel", le remplacer par un libellé neutre type :

```
Pas de visuel attaché.
[Générer depuis un template] [Uploader une image]
```

Les boutons CTA existent déjà (vers `/posts/:id/attach-visual` et `/posts/:id/upload-visual`). Ne pas modifier la logique, juste le libellé d'introduction si elle suggère un échec.

Si aucun libellé d'échec n'est trouvé, ne rien changer ici.

- [ ] **Step 4: Tester visuellement**

Run: `rm -f data/avqn.db && npm run dev`

Dans un autre terminal :

```bash
curl -s -X POST http://localhost:3000/ideas -d "idea=Test pastille" -d "brief=Brief de test sur le sujet X avec des détails Y et Z" >/dev/null
curl -s -X POST http://localhost:3000/ideas/1/generate >/dev/null
```

Ouvrir `http://localhost:3000/posts` dans un navigateur. Attendu : la card du post #1 affiche la pastille "visuel manquant". Le drawer du post propose les CTA "Générer depuis un template" et "Uploader une image" sans message d'erreur.

Tuer le serveur : `Ctrl+C`.

- [ ] **Step 5: Commit**

```bash
git add src/views/posts/cards.ts
git commit -m "$(cat <<'EOF'
🤖 ui(posts): pastille 'visuel manquant' sur les drafts sans visuel

Visible sur la card list pour repérer rapidement les posts à compléter
maintenant que le visuel n'est plus généré automatiquement. Apparait
uniquement pour les drafts ; un post validé sans visuel est un choix
éditorial assumé, pas un manque.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Smoke-test des helpers DB et vérification du pipeline

**Files:**
- Create: `scripts/smoke-ideas-pipeline.ts`
- Modify: `package.json:10` (script `test`).

- [ ] **Step 1: Créer le script de smoke-test**

Créer `scripts/smoke-ideas-pipeline.ts` avec le contenu suivant :

```ts
import { mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

// Force une DB temporaire pour ne pas polluer data/avqn.db
const TMP_DB = resolve('data', `smoke-ideas-${Date.now()}.db`);
mkdirSync('data', { recursive: true });
process.env.DB_PATH = TMP_DB;

const {
  addIdea,
  updateIdea,
  listIdeas,
  getIdea,
  deleteIdea,
  listPostsByIdea,
  addPostWithTemplate,
  getDefaultTemplate,
  getCounts,
} = await import('../src/db.js');

function assert(cond: unknown, msg: string): void {
  if (!cond) {
    console.error('FAIL:', msg);
    cleanup();
    process.exit(1);
  }
  console.log('OK:', msg);
}

function cleanup(): void {
  try { unlinkSync(TMP_DB); } catch {}
}

// 1. Création avec brief
const a = addIdea({ idea: 'Mon idée test', brief: 'Brief détaillé sur le sujet' });
assert(a.id > 0 && a.idea === 'Mon idée test' && a.brief === 'Brief détaillé sur le sujet', 'addIdea avec brief');

// 2. Création sans brief
const b = addIdea({ idea: 'Idée sans brief' });
assert(b.brief === null, 'addIdea sans brief → brief null');

// 3. Update partiel : brief seul
const updated = updateIdea(a.id, { brief: 'Nouveau brief' });
assert(updated?.brief === 'Nouveau brief' && updated.idea === 'Mon idée test', 'updateIdea brief seul');

// 4. Update partiel : idée seule
const updated2 = updateIdea(a.id, { idea: 'Titre modifié' });
assert(updated2?.idea === 'Titre modifié' && updated2.brief === 'Nouveau brief', 'updateIdea idea seule');

// 5. updated_at progresse
const before = updated2!.updated_at;
await new Promise((r) => setTimeout(r, 1100));
const updated3 = updateIdea(a.id, { idea: 'Encore modifié' });
assert(updated3!.updated_at > before, 'updated_at progresse');

// 6. listIdeas trie par updated_at DESC
const list = listIdeas();
assert(list[0]?.id === a.id, 'listIdeas trie par updated_at DESC (a remonte)');

// 7. Posts liés
const tpl = getDefaultTemplate()!;
const p1 = addPostWithTemplate({ ideaId: a.id, content: 'post 1', templateId: tpl.id, visualId: null });
const p2 = addPostWithTemplate({ ideaId: a.id, content: 'post 2', templateId: tpl.id, visualId: null });
const posts = listPostsByIdea(a.id);
assert(posts.length === 2 && posts[0]?.id === p2.id && posts[1]?.id === p1.id, 'listPostsByIdea retourne 2 posts triés id DESC');

// 8. visualId null par défaut sur les posts liés
assert(posts.every((p) => p.visual_id === null), 'posts créés sans visuel');

// 9. getCounts ne filtre plus
const counts = getCounts();
assert(counts.ideas === 2, 'getCounts.ideas compte toutes les idées (pas de filtre status)');

// 10. Suppression cascade
deleteIdea(a.id);
const afterDelete = listPostsByIdea(a.id);
assert(afterDelete.length === 0, 'deleteIdea cascade supprime les posts liés');
const stillThere = getIdea(b.id);
assert(stillThere?.id === b.id, 'b est toujours là après suppression de a');

console.log('\n--- smoke-ideas-pipeline OK ---');
cleanup();
```

- [ ] **Step 2: Exécuter le script**

Run: `npx tsx --env-file=.env scripts/smoke-ideas-pipeline.ts`

Attendu : 10 lignes `OK: ...` suivies de `--- smoke-ideas-pipeline OK ---`. Pas d'erreur.

Si une assertion échoue, lire le message, identifier la cause (souvent un détail dans `src/db.ts`), corriger, relancer.

- [ ] **Step 3: Ajouter le smoke-test au script `npm test`**

Dans `package.json:10`, remplacer :

```json
"test": "tsx scripts/smoke-render-templates.ts && tsx scripts/test-migration.ts && tsx scripts/test-crypto.ts"
```

par :

```json
"test": "tsx scripts/smoke-render-templates.ts && tsx scripts/test-migration.ts && tsx scripts/test-crypto.ts && tsx scripts/smoke-ideas-pipeline.ts"
```

- [ ] **Step 4: Exécuter la suite complète**

Run: `npm test`

Attendu : tous les scripts smoke passent, aucune erreur.

⚠️ **Note** : `scripts/test-migration.ts` peut référencer l'ancien schema `ideas.content/research/plan`. Si ce script échoue après le changement de schema, il faut le mettre à jour ou le supprimer (selon ce qu'il teste). Lire son contenu et adapter au cas par cas :

Run: `head -50 scripts/test-migration.ts`

Si le script teste l'ancien schema ideas : adapter aux nouvelles colonnes (`idea`, `brief`) ou supprimer les assertions devenues caduques.

- [ ] **Step 5: Commit**

```bash
git add scripts/smoke-ideas-pipeline.ts package.json
# Si test-migration.ts a été modifié :
# git add scripts/test-migration.ts
git commit -m "$(cat <<'EOF'
🤖 test(ideas): smoke-test du nouveau schema et helpers DB

Couvre addIdea (avec/sans brief), updateIdea partiel, progression de
updated_at, tri DESC dans listIdeas, listPostsByIdea, cascade DELETE,
absence de filtre status sur getCounts. Lance via npm test.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : Vérification finale end-to-end et cleanup imports orphelins

**Files:**
- Verify: tous les fichiers touchés.

- [ ] **Step 1: Identifier les imports orphelins dans `src/server.ts`**

Run: `grep -nE "^import|^  [a-zA-Z]+,?$" src/server.ts | head -80`

Pour chaque symbole importé, vérifier qu'il a au moins un usage :

```bash
for sym in buildVisualBrief composeVisualPng editImageWithGemini extractVisualVars generatePost generateStandaloneAiImage produceVisual produceVisualImage regenerateVisualImage withColorFallbacks; do
  count=$(grep -c "\\b$sym\\b" src/server.ts)
  echo "$sym: $count occurrences"
done
```

Tout ce qui est à `1` (juste l'import) est orphelin et peut être retiré du bloc d'import. Les autres sont utilisés (occurrences > 1).

Idem pour les imports `./views/ideas.js` et `./db.js`. Nettoyer.

- [ ] **Step 2: Vérifier que `produceVisual` et consorts sont toujours référencés ailleurs que `generatePost`**

Run: `grep -rn "produceVisual\b\|composeVisualPng\b\|buildVisualBrief\b" src/ --include="*.ts"`

Attendu : références dans `src/server.ts` (routes attach-visual, save-visual, etc.) et `src/generate.ts` (exports). Si une fonction n'est plus référencée nulle part, la supprimer de `src/generate.ts`.

- [ ] **Step 3: Démarrer le serveur et faire un walkthrough manuel**

Run: `rm -f data/avqn.db && npm run dev`

Dans un navigateur, vérifier les critères de réussite du spec :

1. `/ideas` : page vide avec formulaire `Nouvelle idée`.
2. Saisir "Mon test", laisser brief vide, cliquer Ajouter. Card apparaît, bouton "Générer un post" disabled.
3. Cliquer dans le textarea brief, écrire 2-3 phrases, blur. Pas de feedback visuel attendu (PATCH 204), mais le bouton "Générer un post" doit passer enabled au prochain reload (ou via JS dynamique selon l'implémentation choisie — vérifier que le toggle marche au moins après reload de la page).
4. Cliquer "Générer un post". Spinner ~10s. Reload.
5. Ouvrir `/posts`. Le post #1 apparaît en draft, avec pastille "visuel manquant".
6. Ouvrir le drawer du post, cliquer "Générer depuis un template", choisir un template visuel, valider. Image générée, visuel attaché.
7. Retour sur `/ideas`. Cliquer Générer une deuxième fois sur la même idée. Compteur passe à `2 posts générés : #2 · #1`.
8. Modifier le titre de l'idée, blur. Reload. Ordre préservé en tête de liste.
9. Supprimer l'idée. Modal de confirmation. Confirmer. Les 2 posts disparaissent aussi (cascade).
10. Valider puis publier (dry-run si pas de compte LinkedIn) un post sans visuel : OK.

Tuer le serveur : `Ctrl+C`.

- [ ] **Step 4: Bonus : toggle dynamique du bouton "Générer un post"**

Si le walkthrough du Step 3 a montré que le bouton ne se réactive pas après saisie du brief sans reload, ajouter un petit handler sur le textarea pour réactiver le bouton :

Dans `src/views/ideas.ts`, sur le `<textarea name="brief" ...>` de `ideaCard`, ajouter :

```ts
oninput="this.closest('.card').querySelector('button[type=submit]').disabled = this.value.trim().length === 0;"
```

(Adapter à la structure DOM exacte de la card.)

Si l'expérience était acceptable telle quelle (reload suffit), skip ce step.

- [ ] **Step 5: Vérifier qu'aucun import `IdeaStatus` ne traîne**

Run: `grep -rn "IdeaStatus" src/ --include="*.ts"`

Attendu : 0 résultat.

- [ ] **Step 6: Lancer `npm test` final**

Run: `npm test`

Attendu : tous les smoke-tests passent.

- [ ] **Step 7: Commit final (si modifications faites en Task 7)**

Si des imports ont été nettoyés ou le toggle dynamique ajouté :

```bash
git add -u src/
git commit -m "$(cat <<'EOF'
🤖 chore: nettoyage imports orphelins post-refonte pipeline

Suppression des imports et symboles non référencés laissés après la
refonte du pipeline idea → post. Vérif e2e du walkthrough utilisateur
selon les critères du spec.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

Si rien à committer (clean), passer.

---

## Self-Review

**Spec coverage :**

- Schema `ideas` 2 champs (idea + brief) → Task 1 ✓
- Suppression `research`, `plan`, `status` → Task 1 ✓
- `updated_at` ajouté → Task 1 ✓
- 1 idée → N posts (plus de status `used`) → Task 1 (listPostsByIdea, getCounts sans filtre) ✓
- Pipeline `write + polish` seul → Task 2 ✓
- Suppression `MODEL_HAIKU`, `web_search` → Task 2 ✓
- `produceVisual` sorti du pipe → Task 2 ✓
- `POST /ideas` `{ idea, brief? }` → Task 3 ✓
- `PATCH /ideas/:id` ajouté → Task 3 ✓
- `POST /ideas/:id/generate` rejette brief vide → Task 3 ✓
- `GET /visual-options` supprimé → Task 3 ✓
- UI card idée avec édition inline blur-to-save → Task 4 ✓
- Bouton Générer disabled si brief vide → Task 4 ✓
- Liste posts liés en pastilles → Task 4 ✓
- Ordre par `updated_at DESC` → Task 1 (DB) + Task 4 (UI rend cet ordre) ✓
- Pastille "visuel manquant" sur post draft → Task 5 ✓
- Slot visuel vide en état neutre → Task 5 ✓
- Migration manuelle (`rm data/avqn.db`) → Task 1 step 6 mentionne le wipe ; explicité dans le spec ✓
- Smoke-test ajouté → Task 6 ✓
- Vérification e2e → Task 7 ✓

**Placeholder scan :** Aucun TBD, TODO, "ajouter validation appropriée" ou "similaire à Task N". Tous les snippets de code sont complets. Quelques `# Si test-migration.ts a été modifié :` sont des branches conditionnelles documentées et acceptables.

**Type consistency :** `Idea` (idea, brief) cohérent partout. `IdeaPatch` aligné. `listPostsByIdea(ideaId): Post[]` même signature en Task 1 et en Task 3 (handler `GET /ideas/:id`). `ideaCard(idea, posts, templates)` même signature partout. `ideasListPage` shape `{ ideas, postsByIdeaId, templates, counts }` même côté server.ts et views/ideas.ts.

**Couverture des fichiers du spec :**
- `src/db.ts` ✓ Task 1
- `src/generate.ts` ✓ Task 2
- `src/server.ts` ✓ Task 3
- `src/views/ideas.ts` ✓ Task 4
- `src/views/components.ts` ✓ Task 4
- `src/views/posts/cards.ts` ✓ Task 5

Plan complet et auto-suffisant. Un sous-agent exécutant une task isolée a tout le code et les commandes nécessaires.
