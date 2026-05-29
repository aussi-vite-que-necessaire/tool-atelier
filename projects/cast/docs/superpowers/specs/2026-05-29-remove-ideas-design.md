# Spec — Suppression complète de la notion d'« idée »

**Date** : 2026-05-29
**Projet** : cast
**Type** : nettoyage / suppression de feature

## But

La gestion des idées n'apporte pas de valeur. Faire disparaître entièrement la
notion d'« idée » de cast : table en base, code (back, worker, UI, navigation),
outillage MCP. Aucune trace résiduelle dans le code vivant.

## Contexte

Posts et ideas sont **déjà découplés** : la FK `idea_id` de `posts` a été
supprimée en migration `0017_furry_odin.sql`. « Idée » est aujourd'hui un module
autonome (table, repository, schéma, routes UI, tools MCP) sans dépendance
entrante depuis les autres domaines, hormis :

- `posts/actions.ts` + `posts/actions-core.ts` importent le **type** `ActionState`
  depuis `ideas/actions-core.ts` (couplage purement typographique).
- `delete-post-dialog.tsx` mentionne « L'idée source reste intacte. » (texte).
- `app-header.tsx` et le dashboard `(app)/page.tsx` exposent un lien/raccourci
  vers `/ideas`.
- seeds + tests d'intégration manipulent la table `ideas`.

## Périmètre

### Fichiers supprimés intégralement
- `src/app/(app)/ideas/` (dossier complet : `page.tsx`, `actions.ts`,
  `actions-core.ts`, `_components/idea-create-form.tsx`, `_components/empty-state.tsx`,
  `_components/idea-card.tsx`, `_components/delete-idea-dialog.tsx`)
- `src/lib/db/schemas/ideas.ts`
- `src/lib/db/repositories/ideas.ts`
- `src/lib/mcp/tools/ideas.ts`
- `test/integration/ideas-actions.test.ts`
- `test/integration/ideas-repository.test.ts`

### Fichiers édités
- `src/lib/db/schema.ts` — retirer `export * from './schemas/ideas';`
- `src/lib/mcp/server.ts` — retirer l'import et l'appel `registerIdeaTools(server)`.
  Les tools MCP `list_ideas`, `create_idea`, `update_idea`, `delete_idea`
  disparaissent.
- `src/components/layout/app-header.tsx` — retirer l'entrée nav `/ideas` (« Idées »)
  et l'icône `Lightbulb`.
- `src/app/(app)/page.tsx` — retirer l'action rapide `/ideas` et l'import `Lightbulb`.
- `src/app/(app)/posts/actions-core.ts` — **y déplacer** la définition du type
  `ActionState` (identique à l'actuel).
- `src/app/(app)/posts/actions.ts` — importer `ActionState` depuis `./actions-core`.
- `src/app/(app)/posts/[id]/_components/delete-post-dialog.tsx` — retirer la phrase
  « L'idée source reste intacte. ».
- `src/lib/db/seeds/dev-sample.ts` — retirer `SAMPLE_IDEAS` et les appels
  `createIdea`/`listIdeas`.
- `test/setup-integration.ts` — retirer le truncate de la table `ideas`.
- `test/integration/seed-dev.test.ts`, `seed-redaction.test.ts`,
  `mcp-tools-content.test.ts`, `tenant-isolation.test.ts` — retirer assertions et
  manipulations de la table `ideas`.
- `docs/ROADMAP.md` — retirer « idées » du state plateforme et du pipeline
  (seul doc vivant nettoyé).

### Base de données
- Nouvelle migration `drizzle/00XX_*.sql` : `DROP TABLE "ideas";`
- Régénération du snapshot via `npm run db:generate`.
- **Destructif assumé** : en prod, les idées stockées sont perdues à la mise en
  ligne de la PR. Preview = base fraîche, sans impact.

## Hors périmètre
- Les archives `docs/superpowers/specs/` et `docs/superpowers/plans/` restent
  intactes (records de décisions passées).
- Le skill `content-os-redaction` (projet **`skills/`**) consomme les tools MCP
  `*_idea(s)` ; sa mise à jour est un autre projet, non traité ici.

## Critères de succès
- Plus aucune référence à `idea`/`idée` dans le code vivant (`src/`, `test/`),
  hors archives docs.
- `npm run lint`, `npm test`, et le typecheck (`tsc --noEmit`) verts.
- L'UI ne montre plus aucun lien « Idées » ; `/ideas` renvoie un 404 natif.
- Le connecteur MCP n'expose plus de tools liés aux idées.
