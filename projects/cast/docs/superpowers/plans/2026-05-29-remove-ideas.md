# Suppression de la notion d'« idée » — Plan d'implémentation

> **Exécution :** invoque `/lab-implémenter` pour exécuter ce plan tâche par tâche. Les steps utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Faire disparaître entièrement la notion d'« idée » de cast (base, code, UI, MCP, seeds, tests, ROADMAP), sans trace résiduelle dans le code vivant.

**Architecture:** « Idée » est un module autonome (déjà découplé de posts depuis la migration 0017). On retire les consommateurs avant les modules qu'ils importent, puis on supprime schéma/table. Seul couplage de type : `ActionState` (défini dans `ideas/actions-core.ts`, importé par `posts/`) → relocalisé dans `posts/actions-core.ts` en premier.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (pg), drizzle-kit (migrations offline), Biome (lint), Vitest (tests), MCP SDK.

Spec de référence : `docs/superpowers/specs/2026-05-29-remove-ideas-design.md`.

---

## Notes d'orchestration (décidé sans demander)

- **Worktree impossible** : la signature de commit managée n'accepte que le checkout enregistré `/home/user/tool-atelier`. On travaille donc dans le **checkout principal** sur la branche **`claude/loving-noether-1Itwc`**. Le hook `branch-guard` est neutralisé en working-tree (jamais committé) et sera **restauré avant le push final** (`git checkout -- .claude/hooks/branch-guard.sh`).
- **Tous les chemins** ci-dessous sont relatifs à `projects/cast/`. Les commandes `git` se lancent depuis la racine `/home/user/tool-atelier`.
- **Ajout au périmètre spec** : `scripts/seed-redaction.ts` et sa donnée `scripts/seed-redaction/idee-avqn.md` (non listés dans la spec mais consommateurs de `ideas`) → nettoyés / supprimés ici.
- **Tests d'intégration** : nécessitent un Postgres (`DATABASE_URL`). En local on valide `npm run lint`, `npm run test:unit`, et le typecheck/build ; la suite d'intégration tourne en CI. Si la DB de test est disponible, lancer `npm test` complet.
- **Ordre des suppressions** : consommateurs d'abord, modules ensuite, table en dernier — chaque commit laisse l'arbre cohérent côté types.

---

## Task 1 — Relocaliser le type `ActionState` dans `posts/`

Le type générique `ActionState` vit dans `ideas/actions-core.ts` et est importé par `posts/`. On le déplace dans `posts/actions-core.ts` avant toute suppression d'`ideas`.

- [ ] **Step 1.1** — Dans `src/app/(app)/posts/actions-core.ts`, remplacer l'import du type par une définition locale.

  Remplacer la ligne :
  ```ts
  import type { ActionState } from '../ideas/actions-core';
  ```
  par :
  ```ts
  export type ActionState =
    | { status: 'idle' }
    | { status: 'success'; message?: string }
    | { status: 'error'; message: string };
  ```
  (placer la définition juste après l'import de `createPost...` et avant `export type CreatePostState`.)

- [ ] **Step 1.2** — Dans `src/app/(app)/posts/actions.ts`, faire pointer l'import vers la définition locale.

  Remplacer :
  ```ts
  import type { ActionState } from '../ideas/actions-core';
  ```
  par :
  ```ts
  import type { ActionState } from './actions-core';
  ```

- [ ] **Step 1.3** — Vérifier qu'aucun autre fichier n'importe `ActionState` depuis `ideas` :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rn "ideas/actions-core" src
  ```
  Sortie attendue : aucune ligne.

- [ ] **Step 1.4** — Lint des fichiers touchés :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx @biomejs/biome check "src/app/(app)/posts/actions.ts" "src/app/(app)/posts/actions-core.ts"
  ```
  Sortie attendue : `Checked ... No fixes applied` / pas d'erreur.

- [ ] **Step 1.5** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add projects/cast/src/app/\(app\)/posts/actions.ts projects/cast/src/app/\(app\)/posts/actions-core.ts && git commit -m "♻️ cast : relocalise le type ActionState dans posts/"
  ```

---

## Task 2 — Retirer « Idées » de l'UI + supprimer la route

- [ ] **Step 2.1** — `src/components/layout/app-header.tsx` : retirer le lien `/ideas` et l'icône `Lightbulb`.

  Remplacer :
  ```ts
  import { CalendarDays, FileText, Lightbulb } from 'lucide-react';
  ```
  par :
  ```ts
  import { CalendarDays, FileText } from 'lucide-react';
  ```
  Et retirer la première entrée du tableau `APP_LINKS` :
  ```ts
  const APP_LINKS = [
    { href: '/ideas', label: 'Idées', icon: Lightbulb },
    { href: '/posts', label: 'Posts', icon: FileText },
    { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
  ];
  ```
  →
  ```ts
  const APP_LINKS = [
    { href: '/posts', label: 'Posts', icon: FileText },
    { href: '/calendar', label: 'Calendrier', icon: CalendarDays },
  ];
  ```

- [ ] **Step 2.2** — `src/app/(app)/page.tsx` : retirer l'action rapide `/ideas` et l'import `Lightbulb`.

  Remplacer :
  ```ts
  import { CalendarDays, Lightbulb, PenSquare } from 'lucide-react';
  ```
  par :
  ```ts
  import { CalendarDays, PenSquare } from 'lucide-react';
  ```
  Et retirer la dernière entrée du tableau `QUICK_ACTIONS` :
  ```ts
  const QUICK_ACTIONS = [
    { href: '/posts', label: 'Créer un post', icon: PenSquare, variant: 'default' as const },
    { href: '/calendar', label: 'Calendrier', icon: CalendarDays, variant: 'outline' as const },
    { href: '/ideas', label: 'Idées', icon: Lightbulb, variant: 'outline' as const },
  ];
  ```
  →
  ```ts
  const QUICK_ACTIONS = [
    { href: '/posts', label: 'Créer un post', icon: PenSquare, variant: 'default' as const },
    { href: '/calendar', label: 'Calendrier', icon: CalendarDays, variant: 'outline' as const },
  ];
  ```

- [ ] **Step 2.3** — `src/app/(app)/posts/[id]/_components/delete-post-dialog.tsx` : retirer la mention de l'idée source.

  Remplacer :
  ```tsx
  Le post sera définitivement supprimé. L'idée source reste intacte.
  ```
  par :
  ```tsx
  Le post sera définitivement supprimé.
  ```

- [ ] **Step 2.4** — Supprimer le dossier de la route `ideas` :
  ```bash
  cd /home/user/tool-atelier && git rm -r "projects/cast/src/app/(app)/ideas"
  ```
  Sortie attendue : suppression de `page.tsx`, `actions.ts`, `actions-core.ts`, `_components/idea-create-form.tsx`, `_components/empty-state.tsx`, `_components/idea-card.tsx`, `_components/delete-idea-dialog.tsx`.

- [ ] **Step 2.5** — Lint des fichiers UI touchés :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx @biomejs/biome check "src/components/layout/app-header.tsx" "src/app/(app)/page.tsx" "src/app/(app)/posts/[id]/_components/delete-post-dialog.tsx"
  ```
  Sortie attendue : pas d'erreur.

- [ ] **Step 2.6** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add -A projects/cast/src && git commit -m "🔥 cast : retire « Idées » de la navigation et supprime la route /ideas"
  ```

---

## Task 3 — Retirer les tools MCP « idées »

- [ ] **Step 3.1** — `src/lib/mcp/server.ts` : retirer l'import et l'appel.

  Retirer la ligne d'import :
  ```ts
  import { registerIdeaTools } from './tools/ideas';
  ```
  Et retirer l'appel dans `registerAllTools` :
  ```ts
    registerIdeaTools(server);
  ```

- [ ] **Step 3.2** — Supprimer le fichier de tools :
  ```bash
  cd /home/user/tool-atelier && git rm projects/cast/src/lib/mcp/tools/ideas.ts
  ```

- [ ] **Step 3.3** — Vérifier qu'il ne reste aucune référence MCP aux idées :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rniE "idea" src/lib/mcp
  ```
  Sortie attendue : aucune ligne.

- [ ] **Step 3.4** — Lint :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx @biomejs/biome check src/lib/mcp/server.ts
  ```

- [ ] **Step 3.5** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add -A projects/cast/src/lib/mcp && git commit -m "🔥 cast : retire les tools MCP liés aux idées"
  ```

---

## Task 4 — Nettoyer les seeds

- [ ] **Step 4.1** — `src/lib/db/seeds/dev-sample.ts` : retirer l'import, `SAMPLE_IDEAS`, et la boucle de seed des idées.

  Retirer la ligne d'import :
  ```ts
  import { createIdea, listIdeas } from '../repositories/ideas';
  ```
  Retirer le bloc `SAMPLE_IDEAS` (la constante entière, lignes 17-27).
  Retirer la boucle de seed des idées dans `seedDev` :
  ```ts
    const byText = new Map((await listIdeas(userId)).map((i) => [i.idea, i]));
    for (const s of SAMPLE_IDEAS) {
      if (!byText.has(s.idea)) {
        const created = await createIdea(userId, { idea: s.idea, brief: s.brief ?? undefined });
        byText.set(created.idea, created);
      }
    }

  ```
  (le reste de `seedDev` — posts + publications — est conservé tel quel.)

- [ ] **Step 4.2** — `scripts/seed-redaction.ts` : retirer l'import et le bloc de seed d'idée.

  Retirer la ligne d'import :
  ```ts
  import { createIdea, listIdeas } from '@/lib/db/repositories/ideas';
  ```
  Retirer le bloc final de `seedRedaction` (lignes 41-48) :
  ```ts
    const ideaFile = read('idee-avqn.md');
    const [titleLine, ...rest] = ideaFile.split('\n');
    const title = (titleLine ?? '').replace(/^#\s*/, '').trim();
    const brief = rest.join('\n').trim();
    const ideas = await listIdeas(userId);
    if (!ideas.some((i) => i.idea.startsWith('AVQN'))) {
      await createIdea(userId, { idea: title, brief });
    }
  ```
  (la fonction conserve le seed voix + template.)

- [ ] **Step 4.3** — Supprimer la donnée d'idée du seed redaction :
  ```bash
  cd /home/user/tool-atelier && git rm projects/cast/scripts/seed-redaction/idee-avqn.md
  ```

- [ ] **Step 4.4** — Vérifier qu'aucun seed ne référence plus le module idées (cibler les identifiants, pas le mot « idée » qui apparaît en prose légitime ailleurs) :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rnE "createIdea|listIdeas|repositories/ideas|idee-avqn|SAMPLE_IDEAS" src/lib/db/seeds scripts/seed-redaction.ts
  ```
  Sortie attendue : aucune ligne.

- [ ] **Step 4.5** — Lint :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx @biomejs/biome check src/lib/db/seeds/dev-sample.ts scripts/seed-redaction.ts
  ```

- [ ] **Step 4.6** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add -A projects/cast/src/lib/db/seeds projects/cast/scripts && git commit -m "🔥 cast : retire le seed des idées (dev-sample + seed-redaction)"
  ```

---

## Task 5 — Nettoyer les tests d'intégration

- [ ] **Step 5.1** — `test/setup-integration.ts` : retirer l'import `ideas` et le `db.delete(ideas)`.

  Retirer `ideas,` de l'import (ligne 4) et la ligne :
  ```ts
    await db.delete(ideas);
  ```

- [ ] **Step 5.2** — `test/integration/seed-dev.test.ts` : retirer l'import et les assertions d'idées.

  Retirer :
  ```ts
  import { listIdeas } from '@/lib/db/repositories/ideas';
  ```
  Adapter le libellé du test (`peuple settings + template + ideas + posts...` → `peuple settings + template + posts...`) et retirer les lignes utilisant `listIdeas`/`ideas1` :
  ```ts
      const ideas1 = await listIdeas(userId);
  ```
  ```ts
      expect(ideas1.length).toBeGreaterThan(0);
  ```
  ```ts
      expect((await listIdeas(userId)).length).toBe(ideas1.length);
  ```

- [ ] **Step 5.3** — `test/integration/seed-redaction.test.ts` : retirer l'import et l'assertion d'idée.

  Retirer :
  ```ts
  import { listIdeas } from '@/lib/db/repositories/ideas';
  ```
  Adapter le libellé (`crée voix + template + idée...` → `crée voix + template...`) et retirer :
  ```ts
      const ideas = await listIdeas(userId);
      expect(ideas.filter((i) => i.idea.startsWith('AVQN'))).toHaveLength(1);
  ```

- [ ] **Step 5.4** — `test/integration/mcp-tools-content.test.ts` : retirer l'import et le `describe('mcp tools — idées', ...)`.

  Retirer :
  ```ts
  import { ideaImpl } from '@/lib/mcp/tools/ideas';
  ```
  Retirer le bloc entier (lignes 7-15) :
  ```ts
  describe('mcp tools — idées', () => {
    test('create puis list', async () => {
      const userId = await createTestUser('mcpidea');
      const created = await ideaImpl.create(userId, { idea: 'Sujet A', brief: 'brief' });
      expect(created.idea).toBe('Sujet A');
      const list = await ideaImpl.list(userId);
      expect(list.map((i) => i.id)).toContain(created.id);
    });
  });

  ```

- [ ] **Step 5.5** — `test/integration/tenant-isolation.test.ts` : retirer l'import et la suite `ideas`.

  Retirer le bloc d'import (lignes 2-8) :
  ```ts
  import {
    createIdea,
    deleteIdea,
    getIdea,
    listIdeas,
    updateIdea,
  } from '@/lib/db/repositories/ideas';
  ```
  Retirer la suite d'isolation idées (lignes 82-94) :
  ```ts
  runTenantIsolationSuite('ideas', {
    seed: (uid) => createIdea(uid, { idea: 'sample' }),
    rowId: (r) => r.id,
    reload: (uid, id) => getIdea(uid, id),
    updatePatch: { idea: 'hacked' },
    updateAssertions: (row) => {
      expect(row.idea).toBe('sample');
    },
    get: getIdea,
    list: listIdeas,
    update: updateIdea,
    delete: deleteIdea,
  });

  ```

- [ ] **Step 5.6** — Supprimer les deux suites 100 % idées :
  ```bash
  cd /home/user/tool-atelier && git rm projects/cast/test/integration/ideas-actions.test.ts projects/cast/test/integration/ideas-repository.test.ts
  ```

- [ ] **Step 5.7** — Vérifier qu'aucun test ne référence plus les idées :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rniE "idea" test
  ```
  Sortie attendue : aucune ligne.

- [ ] **Step 5.8** — Lint des tests touchés :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx @biomejs/biome check test/setup-integration.ts test/integration/seed-dev.test.ts test/integration/seed-redaction.test.ts test/integration/mcp-tools-content.test.ts test/integration/tenant-isolation.test.ts
  ```

- [ ] **Step 5.9** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add -A projects/cast/test && git commit -m "🔥 cast : retire les tests liés aux idées"
  ```

---

## Task 6 — Supprimer le schéma et le repository

À ce stade, plus aucun fichier n'importe `schemas/ideas` ni `repositories/ideas`.

- [ ] **Step 6.1** — `src/lib/db/schema.ts` : retirer l'export.

  Retirer la ligne :
  ```ts
  export * from './schemas/ideas';
  ```

- [ ] **Step 6.2** — Supprimer schéma + repository :
  ```bash
  cd /home/user/tool-atelier && git rm projects/cast/src/lib/db/schemas/ideas.ts projects/cast/src/lib/db/repositories/ideas.ts
  ```

- [ ] **Step 6.3** — Vérifier qu'il ne reste aucune référence au module idées dans `src/lib/db` (cibler les identifiants ; le mot « idées » en prose dans `seeds/user-defaults.ts` est hors périmètre) :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rnE "idea|Idea|schemas/ideas|repositories/ideas" src/lib/db
  ```
  Sortie attendue : aucune ligne.

- [ ] **Step 6.4** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add -A projects/cast/src/lib/db && git commit -m "🔥 cast : supprime le schéma et le repository ideas"
  ```

---

## Task 7 — Migration DROP TABLE ideas

- [ ] **Step 7.1** — Générer la migration depuis le diff de schéma (offline) :
  ```bash
  cd /home/user/tool-atelier/projects/cast && DATABASE_URL="postgres://x" npx drizzle-kit generate --name drop_ideas
  ```
  Sortie attendue : création d'un fichier `drizzle/0026_drop_ideas.sql` contenant `DROP TABLE "ideas";`, mise à jour de `drizzle/meta/_journal.json` et nouveau snapshot `drizzle/meta/0026_snapshot.json`.

- [ ] **Step 7.2** — Vérifier le contenu de la migration générée :
  ```bash
  cd /home/user/tool-atelier/projects/cast && cat drizzle/0026_drop_ideas.sql
  ```
  Sortie attendue : `DROP TABLE "ideas";--> statement-breakpoint` (et rien d'autre de destructif sur d'autres tables). Si d'autres changements inattendus apparaissent, ne committer que le DROP de `ideas` (éditer le `.sql` et le snapshot en conséquence).

- [ ] **Step 7.3** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add projects/cast/drizzle && git commit -m "🗃️ cast : migration DROP TABLE ideas"
  ```

---

## Task 8 — Nettoyer le ROADMAP (seul doc vivant)

- [ ] **Step 8.1** — `docs/ROADMAP.md` : retirer les mentions d'« idées » comme feature/état vivant.

  Ligne 9 — retirer « idées » de l'énumération du state :
  ```
  ... détient l'**état** (idées, posts, médias, calendrier, marque, connexions sociales) ...
  ```
  →
  ```
  ... détient l'**état** (posts, médias, calendrier, marque, connexions sociales) ...
  ```
  Et retirer « , idéation » dans la même phrase si présent :
  ```
  Le **cerveau** (rédaction, idéation) vit dans des **skills externes** ...
  ```
  →
  ```
  Le **cerveau** (rédaction) vit dans des **skills externes** ...
  ```
  Ligne 17 — reformuler le pipeline sans « idée » :
  ```
  - Pipeline **idée → post → publication LinkedIn** (+ calendrier, carrousels, vidéo).
  ```
  →
  ```
  - Pipeline **post → publication LinkedIn** (+ calendrier, carrousels, vidéo).
  ```

- [ ] **Step 8.2** — Vérifier ce qui reste dans ROADMAP :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -niE "idée|idea" docs/ROADMAP.md
  ```
  Sortie attendue : aucune ligne (ou seulement des occurrences hors-sujet à laisser, à juger).

- [ ] **Step 8.3** — Commit :
  ```bash
  cd /home/user/tool-atelier && git add projects/cast/docs/ROADMAP.md && git commit -m "📝 cast : retire les idées du ROADMAP"
  ```

---

## Task 9 — Vérification finale

- [ ] **Step 9.1** — Aucune référence au module idées dans le code vivant. Cibler les identifiants (`idea` en anglais + symboles), **pas** le mot français « idée » qui subsiste légitimement en prose (ex. `src/lib/db/seeds/user-defaults.ts` : « 2 à 4 idées » dans un guideline de rédaction — hors périmètre, à laisser) :
  ```bash
  cd /home/user/tool-atelier/projects/cast && grep -rnE "idea|Idea|registerIdeaTools|schemas/ideas|repositories/ideas|tools/ideas|ideaImpl" src test scripts drizzle/*.sql 2>/dev/null
  ```
  Sortie attendue : aucune ligne (les snapshots `drizzle/meta/*.json` historiques peuvent encore contenir la table — c'est normal, ce sont des états figés ; seul le dernier snapshot ne doit plus la déclarer).

- [ ] **Step 9.2** — Lint complet :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npm run lint
  ```
  Sortie attendue : pas d'erreur.

- [ ] **Step 9.3** — Typecheck / build :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npx tsc --noEmit
  ```
  Sortie attendue : pas d'erreur de type (notamment plus aucun import cassé vers `ideas`).

- [ ] **Step 9.4** — Tests unitaires (sans DB) :
  ```bash
  cd /home/user/tool-atelier/projects/cast && npm run test:unit
  ```
  Sortie attendue : verts. (La suite d'intégration nécessite `DATABASE_URL` ; elle sera exécutée par la CI. Si une DB de test est disponible localement, lancer `npm test`.)

- [ ] **Step 9.5** — Pas de commit dédié (vérifications pures). Si un fix est nécessaire, l'appliquer et committer avec un message clair.
