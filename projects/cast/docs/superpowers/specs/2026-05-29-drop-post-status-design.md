# Suppression du statut brouillon/validé des posts

## Contexte

Un post `cast` porte aujourd'hui un `status` (`post_status` enum : `draft` |
`validated`) avec une UI dédiée : badge brouillon/validé sur la carte et dans
l'éditeur, boutons **Valider** / **Repasser en brouillon**. Ce statut
n'apporte rien : la vraie notion de « publié » vit dans les **publications**
(table `publications`, enum `publication_status`), et la publication LinkedIn
ne dépend jamais de `post.status` (elle lit `content` / `media` uniquement —
cf. `src/lib/publications/publish-core.ts`). Le statut du post est donc un
état mort qui complexifie les cartes, l'éditeur et l'API MCP.

## Objectif

Retirer entièrement la notion `draft`/`validated` des **posts** : UI, server
actions, repository, schéma DB (colonne + enum), outil MCP, seeds et tests.
**Ne pas toucher** au statut des *publications* (`publication_status`), qui est
la vraie source de vérité « planifié / publié ».

## Périmètre

### Base de données
- `src/lib/db/schemas/posts.ts` : retirer l'enum `postStatus` et la colonne
  `status` (et l'import `pgEnum` devenu inutile).
- Migration générée (`npm run db:generate`) :
  `ALTER TABLE "posts" DROP COLUMN "status"; DROP TYPE "public"."post_status";`
  Pattern identique aux migrations `0025_drop_auth_oidc` / `0026_drop_ideas`.

### Repository (`src/lib/db/repositories/posts.ts`)
- Retirer `status` de `CreatePostInput` et `UpdatePostPatch`.
- Retirer `status: data.status ?? 'draft'` de `createPost`.

### Server actions (`actions-core.ts`, `actions.ts`)
- Retirer le champ `status` de `UpdateSchema`, de la signature de
  `updatePostCore` et de `updatePostAction`. (Le `status` des `ActionState` —
  `idle`/`success`/`error` — est une autre chose : on le garde.)

### MCP (`src/lib/mcp/tools/posts.ts`)
- Supprimer l'outil `set_post_status` et l'impl `setStatus`.
- Retirer le paramètre `status` de `create_post` (impl + `inputSchema`).

### UI
- `posts/_components/post-card.tsx` : supprimer `STATUS_LABEL` et le `Badge` de
  statut.
- `posts/[id]/_components/post-editor.tsx` : supprimer `STATUS_LABEL`, l'état
  `status`, `toggleStatus`, le `Badge`, les boutons **Valider** /
  **Repasser en brouillon**, et les imports devenus inutiles
  (`Check`, `Undo2`, `Badge`).
- `posts/page.tsx` : ajuster le sous-titre `« … · brouillons et publications »`.

### Seeds
- `src/lib/db/seeds/dev-sample.ts` : retirer `status: 'draft'` du `createPost`.
- `scripts/seed-preview.mjs` : retirer la colonne `status` de l'`INSERT`.

### Tests
- `test/integration/posts-actions.test.ts` : supprimer le test « toggle status »
  et les assertions sur `post.status`.
- `test/integration/posts-repository.test.ts` : retirer les assertions `status`
  (le test « updatePost modifie content et status » devient « … content »).
- `test/integration/mcp-tools-content.test.ts` : supprimer le test
  `set_post_status` et les assertions `status` ; `create_post` ne propage plus
  de statut.

## Hors périmètre
- `publication_status` et toute l'UI/MCP des publications : inchangés.
- Le champ `status` des `ActionState` (résultat d'action) : inchangé.

## Validation
- `npm test` vert (suite ajustée).
- `npm run lint` (biome) vert.
- Build / typecheck OK.
- Migration appliquée proprement sur `cast_dev` / `cast_test`.
