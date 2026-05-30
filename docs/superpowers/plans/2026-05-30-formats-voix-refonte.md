# Refonte formats de publication + voix partagées + skill Contentos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renommer `writing_templates` → `publication_formats` (+ champ `visualIntent`), déplacer la gestion des voix de cast vers l'espace Compte, et remplacer le catalogue de skills par un unique skill `contentos`.

**Architecture:** App Next.js unique (`projects/app`). On suit les patterns existants : Drizzle schema → repository → server-action `*-core` (pure, testée) → action `'use server'` → page/form ; outils MCP = impl exporté + `registerTool`. Migration de **rename** hand-éditée (pas de DROP) pour préserver les données de l'intégration persistante. L'intelligence reste côté agent ; l'app ne fait que stocker/exposer.

**Tech Stack:** Next.js 16 (App Router), Drizzle ORM (pg), Zod, Vitest (unit + integration), Biome, MCP SDK.

**Toutes les commandes s'exécutent depuis `/home/user/tool-atelier/projects/app`.**

---

## Fichiers touchés

**Schéma & repo (rename + colonne)**
- Renommer `src/lib/db/schemas/writing-templates.ts` → `publication-formats.ts`
- Renommer `src/lib/db/repositories/writing-templates.ts` → `publication-formats.ts`
- Modifier `src/lib/db/schema.ts` (barrel)
- Créer `drizzle/0032_*.sql` (rename + add column, hand-édité) + meta journal

**MCP**
- Modifier `src/lib/mcp/tools/config.ts` (rename outils + `visualIntent`)

**UI formats (restent dans cast)**
- Renommer `src/app/(app)/cast/settings/writing-templates/` → `formats/`
- Modifier form, page liste, actions, actions-core (chemins + `visualIntent`)
- Modifier `src/app/(app)/cast/cast-nav.tsx`, `src/app/(app)/cast/settings/page.tsx`

**UI voix (déménagent vers Compte)**
- Déplacer `src/app/(app)/cast/settings/voice/` → `src/app/(app)/account/voices/`
- Modifier `src/app/(app)/account/account-nav.tsx`

**Seeds**
- Modifier `src/lib/db/seeds/user-defaults.ts`, `src/lib/db/seeds/dev-sample.ts`
- Modifier `scripts/seed-preview.mjs`, `scripts/seed-redaction.ts`

**Skills**
- Supprimer `src/lib/skills/catalog/{content-os-redaction,creer-une-ressource,creer-un-visuel,suite-avqn}/`
- Créer `src/lib/skills/catalog/contentos/{manifest.json,SKILL.md}`
- Modifier `src/lib/skills/catalog/README.md`

**Tests** (renommés/étendus) : `writing-templates-repository` → `publication-formats-repository`, `writing-template-create-action` → `publication-format-create-action`, `writing-template-edit-action` → `publication-format-edit-action`, `mcp-tools-config`, `mcp-endpoint-catalog`, `user-defaults-seed`, `seed-dev`, `seed-redaction`, `tenant-isolation`, + tests voix dont les imports d'action changent.

---

## Task 1 : Schéma `publication_formats` + repository (rename + `visualIntent`)

**Files:**
- Create: `src/lib/db/schemas/publication-formats.ts` (depuis `writing-templates.ts`)
- Create: `src/lib/db/repositories/publication-formats.ts` (depuis `writing-templates.ts`)
- Delete: `src/lib/db/schemas/writing-templates.ts`, `src/lib/db/repositories/writing-templates.ts`
- Modify: `src/lib/db/schema.ts`
- Test: `test/integration/publication-formats-repository.test.ts` (depuis `writing-templates-repository.test.ts`)

- [ ] **Step 1 : Écrire le schéma renommé + colonne**

`src/lib/db/schemas/publication-formats.ts` :
```ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const publicationFormats = pgTable(
  'publication_formats',
  {
    id: text('id').primaryKey(),
    // user_id : référence l'id du user (table "user", auth in-app). Pas de FK
    // locale : ces tables restent découplées du cycle de vie des comptes.
    userId: text('user_id').notNull(),
    name: text('name').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    structure: text('structure').notNull(),
    // Intention de visuel qui accompagne ce format (type/direction, pas DA précise).
    visualIntent: text('visual_intent'),
    writingRules: text('writing_rules'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('publication_formats_user_id_idx').on(table.userId)],
);

export type PublicationFormat = typeof publicationFormats.$inferSelect;
```

- [ ] **Step 2 : Écrire le repository renommé**

`src/lib/db/repositories/publication-formats.ts` :
```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type PublicationFormat, publicationFormats } from '../schema';

export type CreatePublicationFormatInput = {
  name: string;
  platform: string;
  structure: string;
  visualIntent?: string | null;
  writingRules?: string | null;
};

export type UpdatePublicationFormatPatch = Partial<{
  name: string;
  platform: string;
  structure: string;
  visualIntent: string | null;
  writingRules: string | null;
}>;

export async function createPublicationFormat(
  userId: string,
  data: CreatePublicationFormatInput,
): Promise<PublicationFormat | undefined> {
  const [row] = await db
    .insert(publicationFormats)
    .values({
      id: createId(),
      userId,
      name: data.name,
      platform: data.platform,
      structure: data.structure,
      visualIntent: data.visualIntent ?? null,
      writingRules: data.writingRules ?? null,
    })
    .returning();
  return row;
}

export async function getPublicationFormat(
  userId: string,
  id: string,
): Promise<PublicationFormat | undefined> {
  const rows = await db
    .select()
    .from(publicationFormats)
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listPublicationFormats(userId: string): Promise<PublicationFormat[]> {
  return db.select().from(publicationFormats).where(eq(publicationFormats.userId, userId));
}

export async function updatePublicationFormat(
  userId: string,
  id: string,
  patch: UpdatePublicationFormatPatch,
): Promise<PublicationFormat | undefined> {
  const rows = await db
    .update(publicationFormats)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)))
    .returning();
  return rows[0];
}

export async function deletePublicationFormat(userId: string, id: string): Promise<void> {
  await db
    .delete(publicationFormats)
    .where(and(eq(publicationFormats.id, id), eq(publicationFormats.userId, userId)));
}
```

- [ ] **Step 3 : Mettre à jour le barrel + supprimer les anciens fichiers**

`src/lib/db/schema.ts` : remplacer `export * from './schemas/writing-templates';` par `export * from './schemas/publication-formats';`. Puis `git rm` des deux anciens fichiers.

- [ ] **Step 4 : Écrire le test repo (rename + `visualIntent`)**

`test/integration/publication-formats-repository.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import {
  createPublicationFormat,
  deletePublicationFormat,
  getPublicationFormat,
  listPublicationFormats,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';

async function makeUser(_id: string, _email: string) {}

const SAMPLE = {
  name: 'Sample',
  platform: 'linkedin',
  structure: 'HOOK / CORPS / CLOSURE',
  visualIntent: null,
  writingRules: null,
};

describe('publication_formats repository', () => {
  test('createPublicationFormat insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const t = await createPublicationFormat('u1', SAMPLE);
    expect(t?.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(t?.userId).toBe('u1');
    expect(t?.platform).toBe('linkedin');
    expect(t?.visualIntent).toBeNull();
    expect(t?.writingRules).toBeNull();
  });

  test('visualIntent est persisté quand fourni', async () => {
    const t = await createPublicationFormat('u1', { ...SAMPLE, visualIntent: 'carrousel 5-7 slides' });
    const found = await getPublicationFormat('u1', t!.id);
    expect(found?.visualIntent).toBe('carrousel 5-7 slides');
  });

  test('getPublicationFormat retourne la row pour le bon user', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    const found = await getPublicationFormat('u1', created!.id);
    expect(found?.name).toBe('Sample');
  });

  test('listPublicationFormats retourne tous les formats du user', async () => {
    await createPublicationFormat('u1', SAMPLE);
    await createPublicationFormat('u1', { ...SAMPLE, name: 'Sample 2' });
    const rows = await listPublicationFormats('u1');
    expect(rows.length).toBeGreaterThanOrEqual(2);
  });

  test('updatePublicationFormat modifie visualIntent + updated_at', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    const before = created!.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updatePublicationFormat('u1', created!.id, { visualIntent: 'citation' });
    expect(updated?.visualIntent).toBe('citation');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deletePublicationFormat supprime la row', async () => {
    const created = await createPublicationFormat('u1', SAMPLE);
    await deletePublicationFormat('u1', created!.id);
    expect(await getPublicationFormat('u1', created!.id)).toBeUndefined();
  });
});
```
Puis `git rm test/integration/writing-templates-repository.test.ts`.

- [ ] **Step 5 : Générer la migration et la hand-éditer**

Run: `npm run db:generate`. Drizzle va proposer un rename (kit détecte parfois rename, sinon DROP/CREATE). **Inspecter le SQL généré** : il DOIT être un rename, pas un drop. Si drizzle-kit demande interactivement « rename or create », ce mode interactif n'est pas dispo ici → générer puis **réécrire le fichier `drizzle/00XX_*.sql`** à la main :
```sql
ALTER TABLE "writing_templates" RENAME TO "publication_formats";
--> statement-breakpoint
ALTER INDEX "writing_templates_user_id_idx" RENAME TO "publication_formats_user_id_idx";
--> statement-breakpoint
ALTER TABLE "publication_formats" ADD COLUMN IF NOT EXISTS "visual_intent" text;
```
Vérifier que `drizzle/meta/_journal.json` et le snapshot meta correspondant ont bien été ajoutés par `db:generate` (sinon la migration ne sera pas jouée). Si on réécrit le `.sql`, garder le snapshot meta tel que généré (il reflète l'état cible `publication_formats` + `visual_intent`).

- [ ] **Step 6 : Préparer la base de test et lancer le test repo**

Run: `npm run db:test:prepare && npm run test:integration -- publication-formats-repository`
Expected: PASS (6 tests).

- [ ] **Step 7 : Commit**

```bash
git add -A && git commit -m "db: rename writing_templates -> publication_formats + visual_intent"
```

---

## Task 2 : Outils MCP `*_publication_format` + `visualIntent`

**Files:**
- Modify: `src/lib/mcp/tools/config.ts`
- Test: `test/integration/mcp-tools-config.test.ts`, `test/unit/mcp-endpoint-catalog.test.ts`

- [ ] **Step 1 : Réécrire `config.ts`**
```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createPublicationFormat,
  deletePublicationFormat,
  listPublicationFormats,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';
import { handle } from '../register';

export const configImpl = {
  listPublicationFormats: (userId: string) => listPublicationFormats(userId),
  createPublicationFormat: (
    userId: string,
    input: {
      name: string;
      platform: string;
      structure: string;
      visualIntent?: string;
      writingRules?: string;
    },
  ) => createPublicationFormat(userId, input),
  updatePublicationFormat: (
    userId: string,
    input: {
      id: string;
      name?: string;
      platform?: string;
      structure?: string;
      visualIntent?: string;
      writingRules?: string;
    },
  ) => updatePublicationFormat(userId, input.id, input),
  deletePublicationFormat: async (userId: string, input: { id: string }) => {
    await deletePublicationFormat(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerConfigTools(server: McpServer): void {
  server.registerTool(
    'list_publication_formats',
    {
      title: 'Lister les formats de publication',
      description: 'Formats de publication du compte (structure, intention visuelle, cosmétique).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => configImpl.listPublicationFormats(u)),
  );
  server.registerTool(
    'create_publication_format',
    {
      title: 'Créer un format de publication',
      description: 'Crée un format de publication.',
      inputSchema: {
        name: z.string(),
        platform: z.string(),
        structure: z.string(),
        visualIntent: z.string().optional(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.createPublicationFormat(u, input)),
  );
  server.registerTool(
    'update_publication_format',
    {
      title: 'Modifier un format de publication',
      description: 'Met à jour un format de publication.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        platform: z.string().optional(),
        structure: z.string().optional(),
        visualIntent: z.string().optional(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.updatePublicationFormat(u, input)),
  );
  server.registerTool(
    'delete_publication_format',
    {
      title: 'Supprimer un format de publication',
      description: 'Supprime un format de publication.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => configImpl.deletePublicationFormat(u, input)),
  );
}
```

- [ ] **Step 2 : Mettre à jour le test config**

`test/integration/mcp-tools-config.test.ts` : remplacer `configImpl.listWritingTemplates`/`createWritingTemplate` par `listPublicationFormats`/`createPublicationFormat`, et ajouter `visualIntent: 'carrousel'` dans le create + assertion :
```ts
import { describe, expect, test } from 'vitest';
import { configImpl } from '@/lib/mcp/tools/config';
import { createTestUser } from './helpers/seed';

describe('mcp tools — config', () => {
  test('create_publication_format puis list', async () => {
    const userId = await createTestUser('mcpfmt');
    const before = (await configImpl.listPublicationFormats(userId)).length;
    await configImpl.createPublicationFormat(userId, {
      name: 'Via MCP',
      platform: 'linkedin',
      structure: 'structure',
      visualIntent: 'carrousel',
    });
    const after = await configImpl.listPublicationFormats(userId);
    expect(after.length).toBe(before + 1);
    const created = after.find((t) => t.name === 'Via MCP');
    expect(created?.visualIntent).toBe('carrousel');
  });
});
```

- [ ] **Step 3 : Mettre à jour le test catalogue MCP**

`test/unit/mcp-endpoint-catalog.test.ts`, dans le bloc « cast », ajouter :
```ts
    expect(names.has('create_publication_format')).toBe(true);
    expect(names.has('create_writing_template')).toBe(false);
```

- [ ] **Step 4 : Lancer les tests MCP**

Run: `npm run test:integration -- mcp-tools-config && npm run test:unit -- mcp-endpoint-catalog`
Expected: PASS.

- [ ] **Step 5 : Commit**
```bash
git add -A && git commit -m "mcp: outils publication_format (+ visualIntent), retire writing_template"
```

---

## Task 3 : UI formats de publication (rename segment + champ visuel)

**Files:**
- Move dir: `src/app/(app)/cast/settings/writing-templates/` → `src/app/(app)/cast/settings/formats/`
- Modify (renommer composant + ajouter champ) : `formats/writing-template-form.tsx` → `formats/format-form.tsx`
- Modify: `formats/page.tsx`, `formats/new/page.tsx`, `formats/new/actions.ts`, `formats/new/actions-core.ts`, `formats/[id]/page.tsx`, `formats/[id]/actions.ts`, `formats/[id]/actions-core.ts`, `formats/[id]/danger-zone.tsx`
- Modify: `src/app/(app)/cast/cast-nav.tsx`, `src/app/(app)/cast/settings/page.tsx`
- Test: `test/integration/publication-format-create-action.test.ts`, `test/integration/publication-format-edit-action.test.ts`

- [ ] **Step 1 : Déplacer le dossier**
```bash
git mv "src/app/(app)/cast/settings/writing-templates" "src/app/(app)/cast/settings/formats"
git mv "src/app/(app)/cast/settings/formats/writing-template-form.tsx" "src/app/(app)/cast/settings/formats/format-form.tsx"
```

- [ ] **Step 2 : Réécrire `format-form.tsx`** (rename type/composant + champ Intention visuelle)

Renommer `WritingTemplateForm`→`FormatForm`, `WritingTemplateActionState`→`FormatActionState`. `Initial` devient `{ name; platform; structure; visualIntent: string | null; writingRules: string | null }`, `EMPTY_INITIAL` ajoute `visualIntent: null`. Insérer **entre** le champ `structure` et `writingRules` :
```tsx
      <div className="space-y-2">
        <Label htmlFor="visualIntent">Intention visuelle (optionnel)</Label>
        <Textarea
          id="visualIntent"
          name="visualIntent"
          defaultValue={values.visualIntent ?? ''}
          maxLength={2000}
          rows={4}
          placeholder="Type / direction de visuel qui va avec ce format (ex. carrousel 5-7 slides, citation sur fond de marque). Pas une DA précise."
          className="font-mono text-sm"
        />
        {fieldErrors?.visualIntent && (
          <p className="text-sm text-red-600">{fieldErrors.visualIntent}</p>
        )}
      </div>
```
Renommer le libellé du champ `writingRules` en `Règles d'écriture / cosmétique (optionnel)`.

- [ ] **Step 3 : Mettre à jour `new/actions-core.ts`**

Importer `createPublicationFormat` depuis `@/lib/db/repositories/publication-formats`, type depuis `../format-form` (`FormatActionState`). Schéma Zod ajoute `visualIntent: z.string().max(2000)`. Lire `visualIntent` du FormData, passer `visualIntent: parsed.data.visualIntent === '' ? null : parsed.data.visualIntent` au repo. (Même structure que l'existant.)

- [ ] **Step 4 : Mettre à jour `new/actions.ts`, `new/page.tsx`**

Renommer imports/exports : `createWritingTemplateAction`→`createPublicationFormatAction`, composant `FormatForm`, redirect/revalidate `/cast/settings/formats`. `page.tsx` titre « Nouveau format de publication ».

- [ ] **Step 5 : Mettre à jour `[id]/actions-core.ts`, `[id]/actions.ts`, `[id]/page.tsx`, `[id]/danger-zone.tsx`**

`actions-core` : importer `getPublicationFormat`/`updatePublicationFormat`/`deletePublicationFormat`, ajouter `visualIntent` au schéma + passage repo, fonctions `updatePublicationFormatCore`/`deletePublicationFormatCore`. `actions.ts` : `updatePublicationFormatAction`/`deletePublicationFormatActionRaw`, revalidate `/cast/settings/formats`. `page.tsx` : `getPublicationFormat`, `initial` inclut `visualIntent: format.visualIntent`, titre « Éditer le format ». `danger-zone.tsx` : libellé « Supprimer ce format ».

- [ ] **Step 6 : Mettre à jour `formats/page.tsx`**

`listPublicationFormats`, titre `Formats de publication`, description `Structure, intention visuelle et cosmétique par type de post.`, bouton vers `/cast/settings/formats/new`, liens `/cast/settings/formats/${t.id}`.

- [ ] **Step 7 : Mettre à jour la nav cast + redirect settings**

`cast-nav.tsx` : l'entrée Réglages devient `{ href: '/cast/settings/formats', label: 'Réglages', group: '/cast/settings' }`. `cast/settings/page.tsx` : `redirect('/cast/settings/formats')`.

- [ ] **Step 8 : Renommer + réécrire les tests d'action**
```bash
git mv test/integration/writing-template-create-action.test.ts test/integration/publication-format-create-action.test.ts
git mv test/integration/writing-template-edit-action.test.ts test/integration/publication-format-edit-action.test.ts
```
Dans `publication-format-create-action.test.ts` : importer `createPublicationFormatCore` depuis `@/app/(app)/cast/settings/formats/new/actions-core` et `listPublicationFormats`. Ajouter `visualIntent` dans le FormData du cas success + assertion `rows[0]?.visualIntent`. Exemple du cas success :
```ts
import { createPublicationFormatCore } from '@/app/(app)/cast/settings/formats/new/actions-core';
import { listPublicationFormats } from '@/lib/db/repositories/publication-formats';
// ...
const result = await createPublicationFormatCore(
  'u1',
  fd({
    name: 'Carrousel LinkedIn',
    platform: 'linkedin',
    structure: 'HOOK / 5-7 slides / CTA',
    visualIntent: 'carrousel 5-7 slides',
    writingRules: '',
  }),
);
expect(result.status).toBe('success');
const rows = await listPublicationFormats('u1');
expect(rows[0]?.name).toBe('Carrousel LinkedIn');
expect(rows[0]?.visualIntent).toBe('carrousel 5-7 slides');
```
Le cas validation error : ajouter `visualIntent: ''` au FormData.

Dans `publication-format-edit-action.test.ts` : importer `deletePublicationFormatCore`/`updatePublicationFormatCore` depuis `@/app/(app)/cast/settings/formats/[id]/actions-core`, `createPublicationFormat`/`getPublicationFormat` depuis le repo. Ajouter `visualIntent: ''` (ou une valeur) dans tous les `fd({...})`, et `visualIntent: null` dans tous les `createPublicationFormat({...})`.

- [ ] **Step 9 : Lancer les tests d'action**

Run: `npm run test:integration -- publication-format-create-action publication-format-edit-action`
Expected: PASS.

- [ ] **Step 10 : Commit**
```bash
git add -A && git commit -m "cast: section Formats de publication (rename + champ intention visuelle)"
```

---

## Task 4 : Déménager les voix vers l'espace Compte

**Files:**
- Move dir: `src/app/(app)/cast/settings/voice/` → `src/app/(app)/account/voices/`
- Modify: tous les fichiers déplacés (redirect/revalidate `/account/voices`), `src/app/(app)/account/account-nav.tsx`
- Test: `test/integration/voice-action.test.ts` (import path)

- [ ] **Step 1 : Déplacer le dossier**
```bash
git mv "src/app/(app)/cast/settings/voice" "src/app/(app)/account/voices"
```

- [ ] **Step 2 : Réécrire les chemins dans les fichiers voix**

Dans `account/voices/page.tsx` : liens `/account/voices/new` et `/account/voices/${v.id}`. Description peut rester. `account/voices/new/actions.ts` : revalidate + redirect `/account/voices`. `account/voices/[id]/actions.ts` : revalidate `/account/voices/${id}`, deleteVoiceAction redirect `/account/voices`. (Imports relatifs `../voice-form`, `./actions` inchangés car déplacés ensemble.)

- [ ] **Step 3 : Ajouter l'onglet Voix dans la nav Compte**

`account/account-nav.tsx` : `const ACCOUNT_LINKS = [{ href: '/account/voices', label: 'Voix' }, { href: '/account/connections', label: 'Connexions' }];`

- [ ] **Step 4 : Corriger l'import du test d'action voix**

`test/integration/voice-action.test.ts` : remplacer le chemin d'import des cores `@/app/(app)/cast/settings/voice/...` par `@/app/(app)/account/voices/...`.

- [ ] **Step 5 : Lancer les tests voix**

Run: `npm run test:integration -- voice-action voice-repository`
Expected: PASS.

- [ ] **Step 6 : Vérifier qu'aucune référence cast→voix ne subsiste**

Run: `grep -rn "cast/settings/voice" src test` → attendu : vide.
Run: `grep -rn "settings/voice" "src/app/(app)/cast"` → attendu : vide.

- [ ] **Step 7 : Commit**
```bash
git add -A && git commit -m "account: gestion des voix déménagée dans l'espace Compte (partagée suite)"
```

---

## Task 5 : Seeds & defaults

**Files:**
- Modify: `src/lib/db/seeds/user-defaults.ts`, `src/lib/db/seeds/dev-sample.ts`, `scripts/seed-preview.mjs`, `scripts/seed-redaction.ts`
- Test: `test/integration/user-defaults-seed.test.ts`, `test/integration/seed-dev.test.ts`, `test/integration/seed-redaction.test.ts`, `test/integration/tenant-isolation.test.ts`

- [ ] **Step 1 : `user-defaults.ts`**

Renommer l'import vers `@/lib/db/repositories/publication-formats` (`createPublicationFormat`, `listPublicationFormats`). Renommer `DEFAULT_WRITING_TEMPLATE` → `DEFAULT_PUBLICATION_FORMAT`, ajouter `visualIntent: null as string | null` dans l'objet. Dans `seedUserDefaults`, utiliser `listPublicationFormats`/`createPublicationFormat` et `DEFAULT_PUBLICATION_FORMAT`.

- [ ] **Step 2 : `dev-sample.ts`**

Imports `createPublicationFormat`/`listPublicationFormats` + `DEFAULT_PUBLICATION_FORMAT`. Dans `seedUserDefaultsIdempotent`, remplacer les appels templates par formats.

- [ ] **Step 3 : `scripts/seed-preview.mjs`**

`INSERT INTO publication_formats (id, user_id, name, platform, structure, created_at, updated_at)` (la colonne `visual_intent` reste NULL, non insérée). Commentaire ligne 6 : « 1 voix, 1 format de publication ». Log final : « voix + format assurés ».

- [ ] **Step 4 : `scripts/seed-redaction.ts`**

Imports `createPublicationFormat`/`listPublicationFormats`/`updatePublicationFormat`. Garder le nom « Post-thèse LinkedIn ». (visualIntent laissé NULL — minimal.)

- [ ] **Step 5 : Mettre à jour les tests de seed**

`user-defaults-seed.test.ts` : import `listPublicationFormats` + `DEFAULT_PUBLICATION_FORMAT`, assertions inchangées (nom). `seed-dev.test.ts` : import `listPublicationFormats`. `seed-redaction.test.ts` : import `listPublicationFormats` (nom de format inchangé).

- [ ] **Step 6 : Mettre à jour `tenant-isolation.test.ts`**

Bloc `runTenantIsolationSuite('writing_templates', {...})` → `'publication_formats'`, imports `createPublicationFormat`/`getPublicationFormat`/`listPublicationFormats`/`updatePublicationFormat`/`deletePublicationFormat`, seed ajoute `visualIntent: null`.

- [ ] **Step 7 : Lancer la suite seeds + isolation**

Run: `npm run test:integration -- user-defaults-seed seed-dev seed-redaction tenant-isolation`
Expected: PASS.

- [ ] **Step 8 : Commit**
```bash
git add -A && git commit -m "seeds: aligner sur publication_formats (defaults, dev, preview, redaction)"
```

---

## Task 6 : Skills — nettoyage catalogue + skill `contentos`

**Files:**
- Delete: `src/lib/skills/catalog/{content-os-redaction,creer-une-ressource,creer-un-visuel,suite-avqn}/`
- Create: `src/lib/skills/catalog/contentos/manifest.json`, `src/lib/skills/catalog/contentos/SKILL.md`
- Modify: `src/lib/skills/catalog/README.md`

- [ ] **Step 1 : Supprimer les anciens skills**
```bash
git rm -r "src/lib/skills/catalog/content-os-redaction" "src/lib/skills/catalog/creer-une-ressource" "src/lib/skills/catalog/creer-un-visuel" "src/lib/skills/catalog/suite-avqn"
```

- [ ] **Step 2 : Créer le manifest `contentos`**

`src/lib/skills/catalog/contentos/manifest.json` :
```json
{
  "name": "contentos",
  "tool": "suite",
  "version": 1,
  "tagline": "Produire un contenu de A à Z avec Contentos, piloté par l'agent.",
  "description": "Mode d'emploi unique de la suite Contentos pour l'agent : brainstorm de l'idée, choix plateforme/format/voix, plan, rédaction du fond, réécriture dans la voix, cosmétique, puis post prêt à publier. Toute l'intelligence est côté agent ; Contentos stocke l'état et l'expose via MCP.",
  "requires_mcp": ["contentos"],
  "latest_changes": "Squelette initial du skill unifié contentos."
}
```

- [ ] **Step 3 : Créer le `SKILL.md` (squelette minimal)**

`src/lib/skills/catalog/contentos/SKILL.md` :
```markdown
---
name: contentos
description: Produire un contenu éditorial de bout en bout avec la suite Contentos. Déclencher quand l'utilisateur veut écrire un post (LinkedIn aujourd'hui), partir d'une idée, ou mettre au propre un brouillon dans sa voix. Contentos est un outil pour agent : toute l'intelligence rédactionnelle est ici, dans l'agent ; Contentos stocke l'état (voix, formats de publication, posts) et l'expose via les outils MCP de la suite.
---

# contentos

Squelette du workflow de rédaction piloté par l'agent. On ne détaille pas encore chaque
sous-étape (itération ultérieure) — c'est la **séquence** qui compte.

## Outils MCP utilisés

- `list_voices` — voix éditoriales (espace Compte, partagées dans la suite).
- `list_publication_formats` — formats de publication : `structure`, `visualIntent`
  (intention de visuel), `writingRules` (cosmétique). Liés à une plateforme (`linkedin`).
- `create_post` / `get_post` / `edit_post` — poser et amender le post.
- (Plus tard, partie visuel : `generate_image`, `render_template`, `attach_media_to_post`…)

## Séquence

1. **Brainstorm de l'idée** avec l'humain : cerner le sujet, l'angle, la matière.
2. **Cadre de publication** : choisir la **plateforme**, le **format**
   (`list_publication_formats`) et la **voix** (`list_voices`). Demander à l'humain si
   ambigu.
3. **Plan / déroulé** : construire le plan du post en respectant la `structure` du format.
   Faire valider le déroulé à l'humain.
4. **Fond** : rédiger le contenu selon le plan validé. On vise le fond juste, pas encore
   le style.
5. **Voix** : réécrire le texte dans la voix choisie. **Itérer** jusqu'à ce que la voix
   soit vraiment satisfaisante (aller-retour avec l'humain).
6. **Cosmétique** : appliquer les `writingRules` du format (emojis, hashtags, puces,
   règles de mise en page) pour la finalisation.
7. **Poser le post** : `create_post` → le post est prêt à être publié (l'humain valide,
   planifie ou publie depuis Contentos).
8. **Visuel** (étape ultérieure, hors de ce squelette) : à partir de `visualIntent` du
   format, produire le visuel d'accompagnement avec les outils média.

## Principe

L'agent porte la méthode et le jugement éditorial. Contentos ne « pense » pas : il garde
la voix, les formats et les posts, et les expose. Les spécificités de format vivent dans
le format de publication chargé, pas en dur dans ce skill.
```

- [ ] **Step 4 : Mettre à jour le README du catalogue**

`src/lib/skills/catalog/README.md` : remplacer la table « Skills publiés » par une seule ligne `contentos` (tool `contentos`/suite), et retirer les anciennes entrées.

- [ ] **Step 5 : Vérifier le catalogue à chaud (pas de test cassé)**

Run: `npm run test:unit` (le catalogue de skills n'a pas de test dédié ; vérifier juste qu'aucun test unit ne référence les anciens skills). Si un test échoue en référençant un ancien skill, l'adapter.

- [ ] **Step 6 : Commit**
```bash
git add -A && git commit -m "skills: catalogue réduit au seul skill contentos (séquence de rédaction)"
```

---

## Task 7 : Vérification globale + grep de contrôle + œil de l'agent

**Files:** aucun (vérif), corrections inline si besoin.

- [ ] **Step 1 : Grep de contrôle — plus aucune référence legacy**

Run:
```bash
grep -rn "writing_templates\|writingTemplate\|WritingTemplate\|writing-template" src test scripts
```
Expected: vide (hormis d'éventuelles occurrences dans `docs/` qui sont du spec/historique — acceptables).

- [ ] **Step 2 : Suite complète + lint**

Run: `npm test && npm run lint`
Expected: tout vert. Corriger inline sinon.

- [ ] **Step 3 : Œil de l'agent (réflexe front)**

Charger la skill `apercu`. Lancer le dev, screenshoter `/cast/settings/formats/new` et `/account/voices` (mobile + desktop), Read les PNG, critiquer (le nouveau champ Intention visuelle, l'onglet Voix dans Compte, hiérarchie/espacement), corriger si besoin, re-screenshoter.

- [ ] **Step 4 : Commit (si corrections front)**
```bash
git add -A && git commit -m "ui: ajustements après revue visuelle (formats + voix)"
```

---

## Task 8 : Push + PR + abonnement CI

- [ ] **Step 1 : Push**
```bash
git push -u origin claude/post-format-voice-refactor-3nYOI
```
(retry/backoff sur erreur réseau : 2s, 4s, 8s, 16s.)

- [ ] **Step 2 : Ouvrir la PR** (titre : « Voix dans l'espace Compte + formats de publication (3 champs) + skill contentos ») via le tool MCP GitHub `create_pull_request`, base `main`.

- [ ] **Step 3 : S'abonner à la CI de la PR** via `subscribe_pr_activity` (systématique, pas d'option). Puis rendre la main et rester jusqu'au vert.

---

## Notes de cohérence

- Noms de fonctions stables sur tout le plan : `createPublicationFormat`, `getPublicationFormat`, `listPublicationFormats`, `updatePublicationFormat`, `deletePublicationFormat` ; impl MCP `configImpl.{list,create,update,delete}PublicationFormat` ; outils MCP `{list,create,update,delete}_publication_format` ; composant `FormatForm` / `FormatActionState` ; cores `createPublicationFormatCore` / `updatePublicationFormatCore` / `deletePublicationFormatCore`.
- `buildSystemPrompt` (`src/lib/ai/build-system-prompt.ts`) : **non modifié** (YAGNI, inerte en runtime ; son test reste vert car son API ne change pas).
- Migration : **rename** (pas de DROP), index renommé, colonne `visual_intent` ajoutée. Critique pour l'intégration persistante.
