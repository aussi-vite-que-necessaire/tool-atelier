# Refonte du pipeline idée → post

Date : 2026-05-22
Statut : design validé, à implémenter

## Contexte

Le pipeline actuel `research → plan → write → polish → visual` enchaîne cinq étapes IA dans la même requête HTTP synchrone (30 à 90 secondes). Il assume que ContentOS est l'unique cerveau qui transforme une idée brute en post fini.

La cible change : ContentOS devient une plateforme d'orchestration éditoriale pilotable par des agents IA externes (Claude Desktop et autres), via MCP. La recherche et la mise en plan sont déportées sur l'agent externe. ContentOS conserve la voix éditoriale, les templates d'écriture, le rendu visuel, la publication et le stockage. Le rôle de ContentOS sur la partie "idée → post" se réduit à de la réécriture stylée.

Ce spec couvre le sous-projet **A** d'un découpage en trois : A. refonte pipeline et schema (ce document), B. couche d'accès programmatique API + MCP, C. cleanup résiduel.

## Décisions

- Une idée a deux champs métier : `idea` (titre, résumé high-level, requis) et `brief` (description approfondie, matière pour la réécriture, optionnel à la création mais requis à la génération).
- Une idée peut produire N posts. Pas de concept de consommation. La relation est 1-to-N via `posts.idea_id`.
- Le pipeline de génération se réduit à `write → polish → lintEditorial`. Plus de recherche, plus de plan, plus de visuel automatique.
- Le visuel reste un acte humain explicite depuis le drawer du post.
- Suppression nette du code research/plan/visual auto. Pas de mode fallback, pas de dossier `legacy/`.
- Base SQLite jetable : la migration se fait par suppression manuelle de `data/avqn.db` au déploiement de A.

## Schema

```sql
CREATE TABLE ideas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  idea TEXT NOT NULL,
  brief TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Disparaissent par rapport au schema actuel : `content`, `research`, `plan`, `status`. Le concept de status d'idée disparaît : l'état "déjà utilisée" se dérive d'une jointure sur `posts.idea_id`.

`posts` ne change pas. La FK `posts.idea_id` reste avec `ON DELETE CASCADE`. Les autres tables (`visuals`, `voice`, `visual_briefing`, `templates`, `settings`, `visual_styles`, `social_accounts`, `oauth_states`) ne sont pas touchées.

Types TypeScript miroirs dans `src/db.ts` :

```ts
type Idea = {
  id: number;
  idea: string;
  brief: string | null;
  created_at: string;
  updated_at: string;
};

type IdeaPatch = Partial<Pick<Idea, 'idea' | 'brief'>>;
```

Le type `IdeaStatus` est supprimé.

## Pipeline `generatePost`

```ts
export async function generatePost(
  ideaId: number,
  templateId: number | null = null,
): Promise<Post> {
  const idea = getIdea(ideaId);
  if (!idea) throw new Error(`Idée ${ideaId} introuvable`);
  if (!idea.brief?.trim()) throw new Error(`Idée ${ideaId} sans brief`);

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

Adaptations des fonctions internes :

- `write(idea, systemPrompt)` reçoit l'objet `Idea` complet et compose son user message avec `idea.idea` (titre) + `idea.brief` (matière). Plus de paramètre `planText`.
- `polish(idea, draft, systemPrompt)` inchangé dans son rôle, signature alignée sur le nouveau type `Idea`.
- `lintEditorial(text)` inchangé.

Concurrence : la génération est synchrone (~10 secondes). Le bouton "Générer" est désactivé côté HTMX pendant la requête (`hx-indicator`). Deux générations concurrentes sur la même idée produiraient deux posts ; edge case acceptable pour le MVP mono-user. Aucun lock applicatif.

## Routes HTTP

Adaptations :

```
POST   /ideas                  body: { idea, brief? }
PATCH  /ideas/:id              body: { idea?, brief? }      (nouveau)
POST   /ideas/:id/generate     body: { template_id? }
DELETE /ideas/:id              inchangé (cascade sur posts)
GET    /ideas                  inchangé (page liste)
```

Comportement :

- `POST /ideas` : `idea` est requis (string non-vide après trim). `brief` est accepté optionnel et peut être vide ou absent. Si absent, crée la row avec `brief = NULL`.
- `PATCH /ideas/:id` : update partielle. Met à jour `updated_at`. Au moins un des champs doit être présent dans le body.
- `POST /ideas/:id/generate` : répond `400` si `brief` est `NULL` ou que `brief.trim().length === 0`. Plus de paramètres `visual_slug` ni `style_slug`.

Routes supprimées :

- `GET /visual-options` : ce fragment HTMX retournait le dropdown des visual templates compatibles avec un writing template ; plus de visuel auto donc plus de dropdown.

Routes non touchées par A :

- Toutes les routes `/posts/:id/...` (édition, validate, attach/upload/link visual, detach, publication, scheduling).
- Toutes les routes `/visuals/*`, `/visual-templates/*`, `/visual-styles/*`, `/visual-briefing`, `/voice`, `/templates`, `/settings`, OAuth LinkedIn.

Pas d'API JSON dédiée dans A. Le contrat MCP est l'objet du sous-projet B ; A se contente de stabiliser les structures de données pour que B ne casse rien.

## UI page `/ideas`

Card par idée, alignée sur le pattern blur-to-save HTMX du reste du projet :

```
[ input texte court — "Titre de l'idée" ]

[ textarea auto-grow — "Brief : décris l'angle, le contexte, les exemples..." ]

3 posts générés : #12 · #18 · #24

Template ▾   [Générer un post]                       [Supprimer]
```

- `idea` édité via input texte. `brief` édité via textarea auto-grow. Les deux : `hx-trigger="blur changed"`, PATCH `/ideas/:id`, MAJ `updated_at`.
- Bouton "Générer un post" : `disabled` tant que `brief.trim().length === 0`. Soumet `POST /ideas/:id/generate` avec `template_id` du dropdown. `hx-indicator` pendant la requête.
- Liste des posts liés : pastilles compactes avec lien vers `/posts/:id`. Pas d'expand inline. Visible uniquement si au moins un post existe.
- Bouton "Supprimer" : modal de confirmation via le helper `confirmModal` existant. `DELETE /ideas/:id` cascade sur les posts liés.
- Formulaire d'ajout en haut de la page : un input pour `idea`, un textarea pour `brief`, bouton "Ajouter".

Ordre : `ORDER BY updated_at DESC`. Une idée fraîchement éditée remonte ; une idée fraîchement créée a `updated_at = created_at` donc remonte aussi.

Titre de page : `Idées (N)` où N est le total d'idées.

## UI page `/posts`

Tout post nouvellement généré arrive avec `visual_id = null`. L'état "slot visuel vide" devient le défaut sur les nouveaux posts (ce qui existe déjà pour les posts dont la génération visuelle auto échouait).

- Card post `draft` : le slot visuel à droite affiche un état vide avec deux CTA, "Générer depuis un template" (ouvre le picker visual_template existant) et "Uploader une image".
- Card post `validated` : le preview LinkedIn pleine largeur gère déjà l'absence d'image (post texte-only natif côté plateforme). Pas de blocage à la validation ou à la publication.
- Pastille discrète "visuel manquant" sur la card list quand `visual_id === null`, pour repérer les posts à compléter d'un coup d'œil.

Aucune autre modification dans `/posts`. Toutes les routes visuelles restent fonctionnelles.

## Cleanup checklist

Suppression nette :

**`src/generate.ts`** :
- `research()`
- `plan()`
- `MODEL_HAIKU`
- L'usage de `web_search_20250305` dans `research()`
- Tous les `updateIdea(ideaId, { status: ... })`
- L'appel `produceVisual()` dans `generatePost()` et son try/catch
- Paramètres `visualSlug` et `styleSlug` de `generatePost()`
- Fonction interne `resolveVisualTemplate()` si plus utilisée ailleurs après le retrait
- Fonction interne `resolveStyle()` si plus utilisée ailleurs après le retrait

`produceVisual()`, `produceVisualImage()`, `composeVisualPng()`, `buildVisualBrief()`, `generateStandaloneAiImage()`, `regenerateVisualImage()`, `editImageWithGemini()`, `extractVisualVars()`, `withColorFallbacks()` restent : ils servent encore aux routes manuelles `/posts/:id/attach-visual`, `/visual-templates/:slug/generate`, etc.

**`src/db.ts`** :
- Type `IdeaStatus`
- Colonnes `ideas.content`, `ideas.research`, `ideas.plan`, `ideas.status` (par recréation du `CREATE TABLE`)
- Type `Idea` recâblé sur `{ id, idea, brief, created_at, updated_at }`
- `listIdeas()` perd le filtre `WHERE status != 'used'`, gagne `ORDER BY updated_at DESC`
- `addIdea(content)` devient `addIdea({ idea, brief? })`
- `updateIdea()` accepte un patch `{ idea?, brief? }` et met `updated_at = datetime('now')`
- `getCounts()` retire le filtre `status != 'used'` sur le compte d'ideas

**`src/server.ts`** :
- Route `GET /visual-options` supprimée
- Handler `POST /ideas` adapté aux nouveaux body params (`idea`, `brief?`)
- Handler `PATCH /ideas/:id` ajouté
- Handler `POST /ideas/:id/generate` ne lit plus `visual_slug` ni `style_slug`, vérifie la présence du brief

**`src/views/ideas.ts`** :
- Refonte complète de la card idée selon Section UI ci-dessus
- Suppression du formulaire de choix visual_template sur la page idée
- Suppression de tout rendu de progression `researching/planning/writing/polishing`

**`src/views/posts.ts`** :
- Pastille "visuel manquant" sur la card list
- Vérifier que l'état vide du slot visuel sur la card `draft` est bien le défaut et les libellés cohérents avec le nouveau modèle (pas d'erreur "visuel échoué" affichée sur un post qui n'a juste pas demandé de visuel)

Non touché par A et conservé tel quel :

- `.claude/skills/create-visual-template/` et `.claude/skills/preview-visual/`
- `src/styleguides/`
- `src/visuals/`
- `scripts/smoke-render-templates.ts`, `scripts/test-migration.ts`, `scripts/test-crypto.ts`

## Migration

Pas de script de migration. Au déploiement de A :

1. `rm data/avqn.db`
2. `npm run dev` (en local) ou redémarrage du conteneur (en prod) : le `CREATE TABLE IF NOT EXISTS` régénère la base vide avec le nouveau schema, et les seeds réinjectent voice + visual_briefing + template par défaut + settings.

Les visuels PNG existants dans `data/visuals/` ne sont pas référencés depuis une row valide après le wipe, mais ne sont pas un risque (juste des fichiers orphelins, à nettoyer manuellement si on veut récupérer l'espace).

## Critères de réussite

- `npm run dev` démarre sur une base fraîche, `/ideas` s'affiche vide avec le formulaire d'ajout.
- Créer une idée avec un titre seul : OK, apparaît dans la liste, bouton "Générer" désactivé.
- Éditer le brief, blur : sauvegarde silencieuse, bouton "Générer" passe activé.
- Cliquer "Générer" : ~10 secondes plus tard, un post `draft` apparaît dans `/posts` avec le contenu réécrit, sans visuel.
- Re-cliquer "Générer" sur la même idée : un deuxième post `draft` est créé, le compteur "2 posts générés" apparaît sur la card idée.
- La card du post nouvellement créé affiche le slot visuel vide avec les CTA "Générer depuis un template" et "Uploader une image", chacun fonctionnel.
- Supprimer l'idée : confirmation modal, les posts liés sont supprimés en cascade.
- Validation puis publication d'un post sans visuel : OK (preview LinkedIn texte-only, publication LinkedIn texte-only).

## Hors-scope

- Couche API JSON dédiée → sous-projet B.
- MCP server → sous-projet B.
- Suppression d'éventuels artefacts résiduels non identifiés ici (anciens prompts, anciennes routes oubliées) → sous-projet C.
- Système de templates de brief réutilisables (ex : "brief court", "brief structuré en angles"). Pas requis pour A.
- Versionning du brief ou historique des éditions.
- Statut "à traiter" / "vu" / archivage des idées.
- Génération asynchrone, queue, multi-utilisateur.
