# Spec 28 — Types de variables complets sur le MCP — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exposer les quatre types de variables (`string`, `image`, `list`, `color`) sur les outils MCP `create_visual_template` / `update_visual_template`, en réutilisant le schéma canonique du DSL.

**Architecture:** Le schéma d'entrée MCP cesse d'être un sous-ensemble écrit à la main et devient le `variableSpecSchema` (union discriminée) déjà défini dans le DSL. Source de vérité unique → plus de dérive possible. Une `.describe()` sur le champ `variablesSchema` documente les types pour le client MCP.

**Tech Stack:** TypeScript, Zod (union discriminée), `@modelcontextprotocol/sdk`, Vitest.

---

## Fichiers touchés

- Modifier : `src/lib/visual-templates/dsl.ts` — exporter `variableSpecSchema`.
- Modifier : `src/lib/mcp/tools/visuals.ts` — réutiliser `variableSpecSchema`, exposer un binding testable, ajouter `.describe()`.
- Créer : `test/unit/visual-variable-spec-schema.test.ts` — teste le schéma canonique exporté du DSL (pur, sans env).
- Modifier : `test/integration/mcp-tools-visuals.test.ts` — frontière MCP (`variableSpecInput`) + cycle complet create→get avec `list` + `color`.

## Contrainte d'environnement

`src/lib/mcp/tools/visuals.ts` importe les repositories → `db/client` → `env.ts`,
qui parse des variables d'env requises (`APP_URL`, `DATABASE_URL`, `REDIS_URL`,
`BETTER_AUTH_SECRET`). Importer ce module n'est donc possible que dans le projet
`integration` (env + Postgres `contentos_test` fournis par la CI). Le projet `unit`
ne peut tester que des modules purs. D'où la répartition : le schéma canonique
(`dsl.ts`, sans env) est testé en `unit` (vérifiable localement) ; la frontière MCP
réelle est testée en `integration` (exécutée en CI).

---

### Task 1 : Exposer le schéma complet sur la frontière MCP (TDD)

**Files:**
- Modify: `src/lib/visual-templates/dsl.ts:50-55`
- Modify: `src/lib/mcp/tools/visuals.ts:19-21` (remplacement) et `:108`, `:128` (usage)
- Test: `test/unit/visual-variable-spec-schema.test.ts` (créer)

- [ ] **Step 1 : Écrire le test qui échoue**

Créer `test/unit/visual-variable-spec-schema.test.ts`. Il importe le schéma
canonique du DSL (pur, sans env) — c'est l'objet que le MCP réutilise :

```ts
import { describe, expect, test } from 'vitest';
import { variableSpecSchema } from '@/lib/visual-templates/dsl';

describe('variableSpecSchema — schéma de spec exposé au MCP', () => {
  test('accepte une variable list', () => {
    const r = variableSpecSchema.safeParse({
      name: 'items',
      label: 'Points clés',
      type: 'list',
      minItems: 2,
      maxItems: 4,
      itemMax: 110,
    });
    expect(r.success).toBe(true);
  });

  test('accepte une variable color', () => {
    const r = variableSpecSchema.safeParse({
      name: 'accent',
      label: 'Couleur',
      type: 'color',
      default: '#1a1a1a',
    });
    expect(r.success).toBe(true);
  });

  test('accepte encore string et image', () => {
    expect(
      variableSpecSchema.safeParse({ name: 'titre', label: 'Titre', type: 'string', max: 120 })
        .success,
    ).toBe(true);
    expect(
      variableSpecSchema.safeParse({ name: 'photo', label: 'Photo', type: 'image' }).success,
    ).toBe(true);
  });

  test('rejette un type inconnu', () => {
    const r = variableSpecSchema.safeParse({ name: 'x', label: 'X', type: 'video' });
    expect(r.success).toBe(false);
  });

  test('rejette une string sans max', () => {
    const r = variableSpecSchema.safeParse({ name: 'x', label: 'X', type: 'string' });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2 : Lancer le test pour vérifier qu'il échoue**

Run: `npx vitest run --project=unit test/unit/visual-variable-spec-schema.test.ts`
Expected: FAIL — `variableSpecSchema` n'est pas exporté (import `undefined` → `safeParse` indéfini).

- [ ] **Step 3 : Exporter le schéma canonique du DSL**

Dans `src/lib/visual-templates/dsl.ts`, ajouter `export` devant la déclaration existante :

```ts
export const variableSpecSchema = z.discriminatedUnion('type', [
  stringSpec,
  imageSpec,
  listSpec,
  colorSpec,
]);
```

(La ligne `export type VariableSpec = z.infer<typeof variableSpecSchema>;` juste en dessous reste inchangée.)

- [ ] **Step 4 : Réutiliser le schéma dans les outils MCP**

Dans `src/lib/mcp/tools/visuals.ts` :

Remplacer l'import du DSL (ligne 16) pour inclure le schéma :

```ts
import { parseVariablesSchema, variableSpecSchema } from '@/lib/visual-templates/dsl';
```

Remplacer le bloc `variableSpecInput` (lignes 19-21) par un ré-export du schéma canonique :

```ts
// Schéma d'entrée des variables = schéma canonique du DSL (string | image | list | color).
export const variableSpecInput = variableSpecSchema;

const variablesSchemaDescription =
  'Liste de variables du template. Types : string (texte, champ `max` requis), ' +
  'image (mediaId d’une image de la galerie), list (tableau de chaînes, rendu via {{#each}}), ' +
  'color (couleur hex #rrggbb).';
```

Dans `create_visual_template` (ligne 108), remplacer :

```ts
        variablesSchema: z.array(variableSpecInput).describe(variablesSchemaDescription),
```

Dans `update_visual_template` (ligne 128), remplacer :

```ts
        variablesSchema: z.array(variableSpecInput).describe(variablesSchemaDescription).optional(),
```

- [ ] **Step 5 : Lancer le test pour vérifier qu'il passe**

Run: `npx vitest run --project=unit test/unit/visual-variable-spec-schema.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 6 : Non-régression DSL + lint**

Run: `npx vitest run --project=unit test/unit/dsl-list-color.test.ts test/unit/visual-templates-dsl.test.ts`
Expected: PASS (tous verts).

Run: `npm run format && npm run lint`
Expected: aucune erreur Biome.

- [ ] **Step 7 : Commit**

```bash
git add src/lib/visual-templates/dsl.ts src/lib/mcp/tools/visuals.ts test/unit/visual-variable-spec-schema.test.ts
git commit -m "$(printf '%s\n' '🤖 feat(mcp): expose les types list et color des templates visuels' '' 'Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

### Task 2 : Frontière MCP + cycle create→get avec list + color (intégration, CI)

**Files:**
- Modify: `test/integration/mcp-tools-visuals.test.ts`

- [ ] **Step 1 : Écrire les tests d'intégration**

Ajouter l'import du schéma exposé en tête de fichier, après les imports existants :

```ts
import { variableSpecInput } from '@/lib/mcp/tools/visuals';
```

Ajouter ce `describe` (frontière MCP réelle — `variableSpecInput` est le schéma
que l'outil valide) :

```ts
describe('mcp tools — schéma de variables exposé', () => {
  test('variableSpecInput accepte list et color, rejette un type inconnu', () => {
    expect(
      variableSpecInput.safeParse({
        name: 'items',
        label: 'Points',
        type: 'list',
        minItems: 1,
        maxItems: 5,
        itemMax: 110,
      }).success,
    ).toBe(true);
    expect(
      variableSpecInput.safeParse({ name: 'accent', label: 'Couleur', type: 'color' }).success,
    ).toBe(true);
    expect(
      variableSpecInput.safeParse({ name: 'x', label: 'X', type: 'video' }).success,
    ).toBe(false);
  });
});
```

Ajouter ce test dans le `describe('mcp tools — templates visuels', ...)` :

```ts
  test('create avec list + color → get (specs reparsées intactes)', async () => {
    const userId = await createTestUser('mcpvtlc');
    const tpl = await visualImpl.createTemplate(userId, {
      ...baseTemplate,
      slug: 'mcp-tpl-lc',
      bodyHtml: '<ul>{{#each items}}<li>{{this}}</li>{{/each}}</ul>',
      css: '.u{background:{{accent}}}',
      variablesSchema: [
        { name: 'items', label: 'Points', type: 'list' as const, minItems: 1, maxItems: 5, itemMax: 110 },
        { name: 'accent', label: 'Couleur', type: 'color' as const, default: '#1a1a1a' },
      ],
      sampleVars: { items: ['un', 'deux'], accent: '#1a1a1a' },
    });
    expect(tpl?.slug).toBe('mcp-tpl-lc');

    const got = await visualImpl.getTemplate(userId, { id: tpl!.id });
    const byName = Object.fromEntries(got.variableSpecs.map((s) => [s.name, s.type]));
    expect(byName).toEqual({ items: 'list', accent: 'color' });
  });
```

- [ ] **Step 2 : Lancer le test d'intégration**

Run: `npx vitest run --project=integration test/integration/mcp-tools-visuals.test.ts`
Expected: PASS (les tests existants + le nouveau). Nécessite la base de test (`contentos_test`) ; si elle n'est pas prête : `npm run db:test:prepare` d'abord.

- [ ] **Step 3 : Commit**

```bash
git add test/integration/mcp-tools-visuals.test.ts
git commit -m "$(printf '%s\n' '🤖 test(mcp): cycle create→get d’un template avec list + color' '' 'Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>')"
```

---

## Vérification finale

- [ ] **Suite unit complète + lint**

Run: `npm run test:unit && npm run lint`
Expected: tout vert, aucune erreur Biome.

- [ ] **Suite intégration visuals**

Run: `npx vitest run --project=integration test/integration/mcp-tools-visuals.test.ts`
Expected: vert.

---

## Notes de risque

- **Union discriminée + JSON Schema MCP** : `@modelcontextprotocol/sdk` sérialise l'`inputSchema` Zod en JSON Schema via `zod-to-json-schema`. Une `z.discriminatedUnion` produit un `anyOf` avec discriminant — supporté. Si la sérialisation du tool échoue au démarrage du serveur MCP, c'est visible immédiatement (le serveur lève à l'enregistrement) ; le test d'intégration et un `ping` le révèlent.
- **`.describe()` sur le champ tableau** (et non sur les littéraux `type`) : évite tout risque sur le discriminant de l'union.
