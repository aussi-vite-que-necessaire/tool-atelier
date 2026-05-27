# Spec 24 — Découpler posts et idées

## Contexte

Aujourd'hui un post est techniquement rattaché à une idée : `posts.idea_id` est `NOT NULL`, clé étrangère vers `ideas` avec `ON DELETE cascade`. Le seul point d'entrée pour créer un post dans l'UI est le bouton « Créer un post » sur une carte d'idée ; la page `/posts` n'offre pas de création autonome. Un post n'a pas d'identité propre : il emprunte le titre de l'idée comme en-tête (page détail, post-card « Source : … »), et la page détail renvoie un 404 si l'idée est absente.

Cette obligation ne sert pas le produit. Une idée est de la prise de notes : Manu y consigne ses pistes, les agents les affinent, puis en tirent éventuellement un post. Ce passage idée → post est un usage d'agent, pas une contrainte de base de données.

## Objectif

Découpler complètement posts et idées au niveau de la base : un post existe seul, avec son propre titre. L'idée redevient une note autonome (titre + brief). La création d'un post se fait depuis la page `/posts` ou via le MCP. Le passage idée → post devient un comportement décrit dans le skill (l'agent lit une idée, puis crée un post autonome).

## Décisions

- **Lien DB** : la colonne `posts.idea_id`, la clé étrangère et l'index associés sont supprimés. Aucune référence d'un post vers une idée ne subsiste dans le schéma.
- **Identité du post** : un post porte un champ `title` `NOT NULL`. L'agent fournit toujours un titre via le MCP ; l'utilisateur en saisit un à la création UI.
- **Idée → post dans l'UI** : aucun raccourci. L'idée est une pure note ; la création de post part de `/posts` ou de l'agent.
- **Métadonnées d'écriture** : le post ne stocke ni writing-template ni voix. Voix et type de post sont des inputs choisis par l'agent pendant la rédaction (dans le skill) ; le post ne conserve que le texte produit. La colonne `posts.writing_template_id` est supprimée.

## Schéma & migration

Table `posts` cible : `title text NOT NULL` ; plus aucune colonne `idea_id` (ni FK `posts_idea_id_ideas_id_fk`, ni index `posts_idea_id_idx`) ni `writing_template_id`. Colonnes conservées : `id`, `user_id`, `media_id`, `content`, `status`, `generation_job_id`, timestamps. Tables `ideas` et `publications` inchangées (`publications.post_id` reste la seule cascade, vers `posts`).

Migration Drizzle, ordonnée pour ne perdre aucune identité sur les données de prod :

1. Ajouter `title text` **nullable** sur `posts`.
2. Backfill : `UPDATE posts SET title = ideas.idea FROM ideas WHERE ideas.id = posts.idea_id`. Chaque post récupère comme titre celui de l'idée qu'il affichait déjà en en-tête.
3. Passer `title` en `NOT NULL`.
4. Supprimer la contrainte FK, l'index `posts_idea_id_idx`, puis la colonne `idea_id`.
5. Supprimer la colonne `writing_template_id` (champ dormant : ni FK ni index, jamais lu).

Le schéma TypeScript (`src/lib/db/schemas/posts.ts`) reflète l'état cible : `title: text('title').notNull()`, sans `ideaId`, `references` ni `writingTemplateId`.

## MCP

- `create_post` (`src/lib/mcp/tools/posts.ts`) : `inputSchema` = `{ title: z.string(), content: z.string(), status: z.enum(['draft','validated']).optional() }`. L'agent pousse le texte fini ; voix et type de post ont servi à l'écriture en amont, ils ne transitent pas par le call. Description : « Crée un post rédigé. » (sans mention d'idée).
- `list_posts` et `get_post` exposent `title`.
- Les outils `ideas` (`list_ideas`, `create_idea`, `update_idea`, `delete_idea`) restent inchangés : c'est la prise de notes que les agents exploitent.

## Backend (repositories & actions)

- `repositories/posts.ts` : `CreatePostInput` porte `title`, sans `ideaId` ni `writingTemplateId`. `createPost` insère `title`. `UpdatePostPatch` perd `writingTemplateId`. La fonction `listPostsWithIdea` et le type `PostWithIdea` sont supprimés au profit d'un `listPosts` simple (plus de join sur `ideas`).
- `repositories/ideas.ts` : suppression de `listPostsByIdea` et `countPostsByIdea`.
- `app/(app)/ideas/actions-core.ts` et `actions.ts` : suppression de `createPostFromIdeaCore` et `createPostFromIdeaAction`.
- Nouvelle action `app/(app)/posts/actions.ts` : `createPostAction({ title })` → crée un post (titre, contenu vide, statut `draft`) et renvoie son id pour redirection vers l'éditeur.

## UI — posts

- **Formulaire inline « Créer un post »** en haut de `/posts` (`posts/_components/post-create-form.tsx`, calqué sur `idea-create-form.tsx`) : un champ titre requis + bouton « Créer » → appelle `createPostAction` → redirige vers `/posts/{id}`.
- `posts/_components/post-card.tsx` : l'en-tête affiche `post.title` (plus de « Source : … » ni de prop `idea`).
- `posts/page.tsx` : charge les posts via `listPosts` (plus de `listPostsWithIdea`).
- `posts/[id]/page.tsx` : plus de `getIdea` ni de 404 sur idée absente ; l'éditeur reçoit le post seul.
- `posts/[id]/_components/post-editor.tsx` : l'en-tête est `post.title`, **éditable** (champ propre au post, sauvegardé comme le contenu).
- `posts/_components/empty-state.tsx` : invite à créer un post directement (plus de renvoi vers `/ideas`).

## UI — idées

- `ideas/_components/idea-card.tsx` : retrait du bouton « Créer un post » et de l'affichage « X posts liés ». L'idée se limite à titre + brief, éditer/supprimer.
- `ideas/page.tsx` : plus de pré-chargement des posts par idée (`postsByIdea`).
- `ideas/_components/delete-idea-dialog.tsx` : retrait de l'avertissement « les posts seront supprimés » (plus de cascade).

## Skill & seed

- `skills/content-os-redaction/SKILL.md` : la rédaction appelle `create_post` avec `title`, `content` et `status`, sans `ideaId` ni `writingTemplateId` (la voix et le type de post ont guidé l'écriture en amont). Le passage idée → post est décrit comme un usage : l'agent lit une idée (`list_ideas` / `get_idea`) pour s'en inspirer, puis crée un post autonome. État cible uniquement, aucun cadrage par contraste.
- `seeds/dev-sample.ts` : les posts d'exemple sont créés avec un `title`, sans `ideaId`.

## Tests

- Mettre à jour les tests touchant la signature de `create_post` (MCP), `createPost` (repo) et les actions. Le test « create_post : writingTemplateId et status sont propagés » (`test/integration/mcp-tools-content.test.ts`) devient un test du seul `status` ; `posts-repository.test.ts` ne vérifie plus `writingTemplateId`.
- Supprimer/adapter les tests de `createPostFromIdea*`, `listPostsByIdea`, `countPostsByIdea`.
- Ajouter un test pour `createPostAction` (création autonome avec titre).
- Si la suite teste les migrations, couvrir le backfill du `title` depuis l'idée.

## Hors périmètre

`generationJobId` et le flux image (jeton de capacité orthogonal), le système de publications, les voices et writing/visual-templates.

## Vérification

- `npm run lint` / `biome` propre, build TypeScript vert (le retrait de `ideaId` du type `Post` doit ne laisser aucune référence pendante).
- Suite de tests verte (unit / integration / worker / e2e).
- Migration jouée sur une base de dev seedée : les posts existants ont un `title` non vide, la colonne `idea_id` a disparu, supprimer une idée ne touche aucun post.
- Parcours manuel : créer un post depuis `/posts`, le rédiger, l'éditer (titre + contenu), le voir dans la liste sans mention d'idée ; créer/éditer/supprimer une idée sans effet de bord sur les posts.
- `grep` final : aucune occurrence résiduelle de `idea_id`, `ideaId`, `writing_template_id`, `writingTemplateId`, `listPostsWithIdea`, `PostWithIdea`, `listPostsByIdea`, `countPostsByIdea`, `createPostFromIdea` dans le code applicatif (hors entité `writing_templates` elle-même, qui reste).

## Mémoire à mettre à jour (post-merge)

- `project_direction_os_for_agents.md` : posts et idées sont découplés ; l'idée est une note, le passage idée → post est un comportement de skill, pas une contrainte DB.
