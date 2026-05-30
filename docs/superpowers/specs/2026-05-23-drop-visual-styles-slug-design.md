# Drop slug from visual_styles — Design

## Contexte

Spec 3 a porté en v2 (`content-os-v2`) le repo `visual_styles` avec la même forme que la v1 : `id`, `userId`, `name`, `slug`, `prompt`, `createdAt`, `updatedAt`. La v1 avait besoin du `slug` parce que les styles vivaient en code source et étaient référencés textuellement.

En v2 :

- Les `visual_styles` sont stockés en DB.
- Les routes sont indexées par `id` (`/settings/visual-styles/[id]`).
- Aucune FK ne pointe sur le slug.
- Au moment de la génération, un style sera choisi via dropdown UI par `id`, pas par lookup textuel.

Le `slug` est mort. Cette spec le retire avant qu'aucune donnée n'existe en prod.

## Décisions

- Pas de contrainte d'unicité de remplacement sur `name`. Deux styles `Cinematic` chez le même user est autorisé. Si la friction émerge plus tard, on ajoute. YAGNI.
- `writing_templates.slug` reste : il sera référencé par le pipeline de génération.
- Pas de backfill, pas de garde-fou compat : DROP COLUMN sec.
- Work directement sur `main` (pas de PR ni de branche feature), même workflow que les specs précédentes.

## Périmètre du changement

### DB

- `src/lib/db/schemas/visual-styles.ts` : retirer le champ `slug` et la contrainte `unique('visual_styles_user_id_slug_unique')`. Garder `index('visual_styles_user_id_idx')`.
- Nouvelle migration `drizzle/0003_*.sql` générée par drizzle-kit, contenant `ALTER TABLE visual_styles DROP CONSTRAINT visual_styles_user_id_slug_unique` puis `DROP COLUMN slug`.

### Repository

`src/lib/db/repositories/visual-styles.ts` :

- `CreateVisualStyleInput` : `{ name: string; prompt: string }`.
- `UpdateVisualStylePatch` : `Partial<CreateVisualStyleInput>` (dérivé, suit automatiquement).
- `createVisualStyle` : insert simple sans `onConflictDoNothing`, return type passe à `Promise<VisualStyle>` (plus de cas undefined).
- `getVisualStyle`, `listVisualStyles`, `updateVisualStyle`, `deleteVisualStyle` : aucune signature ne change ; le `slug` sortait juste de la row, plus rien à corriger dans le corps.

### Actions cores

`src/app/(app)/settings/visual-styles/new/actions-core.ts` :

- Zod schema : retirer la clé `slug`.
- Retirer la branche `if (!created) return { ..., message: 'duplicate-slug', ... }`. Avec la signature `createVisualStyle` resserrée, `created` est toujours défini.

`src/app/(app)/settings/visual-styles/[id]/actions-core.ts` :

- Zod schema (update) : retirer la clé `slug`.
- Pas d'autre changement.

### UI

`src/app/(app)/settings/visual-styles/visual-style-form.tsx` :

- Retirer le champ `<Input name="slug">`.
- Retirer `slug` de `Initial` et de `EMPTY_INITIAL`.
- Retirer la branche `if (state.message === 'duplicate-slug') ...` du `useEffect` (la message ne sera plus émise).

`src/app/(app)/settings/visual-styles/page.tsx` (liste) :

- Retirer le `<p className="text-xs text-neutral-500">{s.slug}</p>` qui s'affiche sous le nom dans chaque card.

`src/app/(app)/settings/visual-styles/[id]/page.tsx` (edit) :

- Retirer `slug` du prop `initial={{...}}`.

### Tests

- `test/integration/visual-styles-repository.test.ts` :
  - `SAMPLE` perd `slug`.
  - Supprimer le test `'createVisualStyle retourne undefined sur conflit (user_id, slug)'`.
  - Adapter le test `listVisualStyles` : créer deux styles avec `name` différent, plus de `slug: 'cinematic-2'`.
- `test/integration/visual-style-create-action.test.ts` :
  - Supprimer les tests `'validation error : slug invalide'` et `'duplicate-slug : retourne erreur sur conflit'`.
  - Garder le test success (sans le champ slug dans le FormData).
- `test/integration/visual-style-edit-action.test.ts` :
  - Retirer la clé `slug` des `fd({...})` (les 3 tests : success update, cross-tenant, delete). Aucune assertion ne porte sur slug donc rien d'autre à changer.
- `test/integration/tenant-isolation.test.ts` :
  - Le `seed` de l'appel `runTenantIsolationSuite('visual_styles', ...)` retire la clé `slug` de l'objet passé à `createVisualStyle`.
- `test/e2e/settings-editorial.spec.ts` :
  - Le test `'visual_styles create flow'` retire la ligne `await page.fill('input[name="slug"]', 'cinematic');`.

### Hors scope

- `writing_templates` reste tel quel (slug conservé).
- Sidebar, layout, navigation : inchangés.
- Pas de migration de données (la table est vide en prod).

## Stratégie d'exécution

Subagent-driven-development en une seule passe. ~4 commits attendus :

1. Schema + migration + setup-integration check (reset DB locale puis migrate).
2. Repo + tests repo.
3. Actions cores + form + pages UI.
4. Tests E2E + tests tenant-isolation + vérif lint + tests + build + push + watch CI.

Le découpage exact sera défini dans le plan d'implémentation par le skill `writing-plans`.
