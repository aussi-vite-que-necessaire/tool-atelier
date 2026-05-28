# Style guides — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter une entité « style guide » (markdown : palette, typos, exemples) créable/éditable dans le back-office et exposée au MCP, que Claude lit pour produire des `visual_template` cohérents ; et retirer la couleur dynamique de la marque.

**Architecture:** Nouvelle table `style_guides` (id, userId, name, content markdown), miroir de `visual_styles` à tous les étages (repository → MCP → back-office). `visual_templates` gagne une FK nullable `styleGuideId` (on delete set null). Le tool `get_style_guide` renvoie le markdown + une liste légère des templates rattachés (id/label/slug). La couleur de marque (`brandColor` / `{{brand.color}}`) disparaît : les couleurs vivent désormais dans les style guides, écrites en dur dans le CSS des templates par Claude.

**Tech Stack:** Next.js 16 (App Router, server actions), Drizzle ORM + Postgres, MCP SDK + zod, Vitest (projets `unit`/`integration`), biome. Ajout de `marked` pour le rendu markdown de l'aperçu.

---

## Référence — commandes communes

- **Lint/format avant chaque commit :** `npm run format` puis `npm run lint`. (Le cache biome local peut masquer des erreurs ; `format` écrit, `lint` vérifie.)
- **Générer une migration après un changement de schéma :** `npm run db:generate` (non-interactif pour create/add/drop de colonne).
- **Appliquer le schéma à la base de test :** `npm run db:test:prepare` (crée `contentos_test` si absent + applique les migrations de `./drizzle`).
- **Tests :** `npm run test:integration` (DB), `npm run test:unit` (pur), `npm test` (tout).
- **Type-check ciblé :** `npx tsc --noEmit`.

Chaque commit se termine par le trailer :
```
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
```

## File Structure

**Créés :**
- `src/lib/db/schemas/style-guides.ts` — table Drizzle `style_guides` + type `StyleGuide`.
- `src/lib/db/repositories/style-guides.ts` — CRUD repository.
- `src/lib/mcp/tools/style-guides.ts` — `styleGuideImpl` + `registerStyleGuideTools`.
- `src/lib/markdown.ts` — `renderMarkdown(md)` (wrap `marked`).
- `src/app/(settings)/settings/style-guides/page.tsx` — liste.
- `src/app/(settings)/settings/style-guides/style-guide-form.tsx` — formulaire (name + content markdown).
- `src/app/(settings)/settings/style-guides/new/page.tsx`, `new/actions.ts`, `new/actions-core.ts`.
- `src/app/(settings)/settings/style-guides/[id]/page.tsx`, `[id]/actions.ts`, `[id]/actions-core.ts`, `[id]/danger-zone.tsx`.
- Tests : `test/integration/style-guides-repository.test.ts`, `test/integration/visual-template-style-guide-link.test.ts`, `test/integration/mcp-tools-style-guides.test.ts`, `test/integration/style-guide-create-action.test.ts`, `test/unit/markdown.test.ts`.

**Modifiés :**
- `src/lib/db/schema.ts` — export du nouveau schéma.
- `src/lib/db/schemas/visual-templates.ts` — colonne `styleGuideId`.
- `src/lib/db/repositories/visual-templates.ts` — `styleGuideId` dans les types + `listVisualTemplatesByStyleGuide`.
- `src/lib/mcp/tools/visuals.ts` — `styleGuideId` sur create/update template.
- `src/lib/mcp/server.ts` — `registerStyleGuideTools`.
- `test/setup-integration.ts` — purge de `style_guides`.
- `src/components/settings/settings-sidebar.tsx` — entrée de menu.
- Retrait couleur : `src/lib/db/schemas/settings.ts`, `src/lib/db/repositories/settings.ts`, `src/lib/visual-templates/brand.ts`, `src/app/(settings)/settings/brand/{actions-core.ts,brand-form.tsx,page.tsx}`, `src/app/(settings)/settings/visual-templates/visual-template-form.tsx`, et tests `test/integration/brand-context.test.ts`, `test/integration/settings-action.test.ts`, `test/unit/visual-templates-compile.test.ts`, `test/e2e/settings-brand.spec.ts`.
- Skill : `skills/content-os-redaction/SKILL.md`, `skills/content-os-redaction/visuel/choisir-template-et-remplir.md`.

---

## Task 1 : Table `style_guides` + repository

**Files:**
- Create: `src/lib/db/schemas/style-guides.ts`
- Create: `src/lib/db/repositories/style-guides.ts`
- Modify: `src/lib/db/schema.ts`
- Modify: `test/setup-integration.ts`
- Test: `test/integration/style-guides-repository.test.ts`

- [ ] **Step 1 : Écrire le schéma de la table**

`src/lib/db/schemas/style-guides.ts` :
```ts
import { index, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const styleGuides = pgTable(
  'style_guides',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('style_guides_user_id_idx').on(table.userId)],
);

export type StyleGuide = typeof styleGuides.$inferSelect;
```

- [ ] **Step 2 : Exporter le schéma**

Dans `src/lib/db/schema.ts`, ajouter après la ligne `export * from './schemas/settings';` :
```ts
export * from './schemas/style-guides';
```

- [ ] **Step 3 : Purger la table dans le setup de test**

Dans `test/setup-integration.ts` : ajouter `styleGuides` à l'import depuis `@/lib/db/schema` (par ordre alphabétique, avant `voice`), et ajouter la ligne de purge juste après `await db.delete(visualTemplates);` :
```ts
  await db.delete(styleGuides);
```

- [ ] **Step 4 : Générer et appliquer la migration**

Run : `npm run db:generate && npm run db:test:prepare`
Expected : un nouveau fichier `drizzle/NNNN_*.sql` contenant `CREATE TABLE "style_guides"`, puis `migrations OK`.

- [ ] **Step 5 : Écrire le test repository (doit échouer)**

`test/integration/style-guides-repository.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import {
  createStyleGuide,
  deleteStyleGuide,
  getStyleGuide,
  listStyleGuides,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const SAMPLE = {
  name: 'Éditorial sombre',
  content: '# Palette\n- #0a0a0a\n- #f5f5f5\n\n## Typo\nInter via Google Fonts.',
};

describe('style_guides repository', () => {
  test('createStyleGuide insère une row', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', SAMPLE);
    expect(g.id).toMatch(/^[a-z0-9]{20,30}$/);
    expect(g.userId).toBe('u1');
    expect(g.name).toBe('Éditorial sombre');
    expect(g.content).toBe(SAMPLE.content);
  });

  test('getStyleGuide retourne la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    const found = await getStyleGuide('u1', created.id);
    expect(found?.name).toBe('Éditorial sombre');
  });

  test('listStyleGuides retourne tous les guides du user', async () => {
    await makeUser('u1', 'a@test.com');
    await createStyleGuide('u1', SAMPLE);
    await createStyleGuide('u1', { ...SAMPLE, name: 'Clair' });
    expect(await listStyleGuides('u1')).toHaveLength(2);
  });

  test('updateStyleGuide modifie content + updated_at', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    const before = created.updatedAt;
    await new Promise((r) => setTimeout(r, 1100));
    const updated = await updateStyleGuide('u1', created.id, { content: 'nouveau' });
    expect(updated?.content).toBe('nouveau');
    expect(updated!.updatedAt.getTime()).toBeGreaterThan(before.getTime());
  });

  test('deleteStyleGuide supprime la row', async () => {
    await makeUser('u1', 'a@test.com');
    const created = await createStyleGuide('u1', SAMPLE);
    await deleteStyleGuide('u1', created.id);
    expect(await getStyleGuide('u1', created.id)).toBeUndefined();
  });
});
```

Run : `npm run test:integration -- style-guides-repository`
Expected : FAIL (le module `repositories/style-guides` n'existe pas encore).

- [ ] **Step 6 : Implémenter le repository**

`src/lib/db/repositories/style-guides.ts` :
```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type StyleGuide, styleGuides } from '../schema';

export type CreateStyleGuideInput = {
  name: string;
  content: string;
};

export type UpdateStyleGuidePatch = Partial<CreateStyleGuideInput>;

export async function createStyleGuide(
  userId: string,
  data: CreateStyleGuideInput,
): Promise<StyleGuide> {
  const id = createId();
  const [row] = await db
    .insert(styleGuides)
    .values({ id, userId, ...data })
    .returning();
  return row!;
}

export async function getStyleGuide(userId: string, id: string): Promise<StyleGuide | undefined> {
  const rows = await db
    .select()
    .from(styleGuides)
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listStyleGuides(userId: string): Promise<StyleGuide[]> {
  return db.select().from(styleGuides).where(eq(styleGuides.userId, userId));
}

export async function updateStyleGuide(
  userId: string,
  id: string,
  patch: UpdateStyleGuidePatch,
): Promise<StyleGuide | undefined> {
  const rows = await db
    .update(styleGuides)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteStyleGuide(userId: string, id: string): Promise<void> {
  await db
    .delete(styleGuides)
    .where(and(eq(styleGuides.id, id), eq(styleGuides.userId, userId)));
}
```

- [ ] **Step 7 : Lancer le test (doit passer)**

Run : `npm run test:integration -- style-guides-repository`
Expected : PASS (5 tests).

- [ ] **Step 8 : Commit**

```bash
npm run format && npm run lint
git add src/lib/db/schemas/style-guides.ts src/lib/db/repositories/style-guides.ts src/lib/db/schema.ts test/setup-integration.ts test/integration/style-guides-repository.test.ts drizzle/
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): table style_guides + repository

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : Lien `styleGuideId` sur `visual_templates`

**Files:**
- Modify: `src/lib/db/schemas/visual-templates.ts`
- Modify: `src/lib/db/repositories/visual-templates.ts`
- Test: `test/integration/visual-template-style-guide-link.test.ts`

- [ ] **Step 1 : Ajouter la colonne au schéma**

Dans `src/lib/db/schemas/visual-templates.ts`, importer `styleGuides` et ajouter la colonne. Remplacer la ligne d'import du haut :
```ts
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';
import { styleGuides } from './style-guides';
```
Et ajouter, après la ligne `css: text('css').notNull(),` :
```ts
    styleGuideId: text('style_guide_id').references(() => styleGuides.id, {
      onDelete: 'set null',
    }),
```

- [ ] **Step 2 : Générer et appliquer la migration**

Run : `npm run db:generate && npm run db:test:prepare`
Expected : migration `drizzle/NNNN_*.sql` avec `ALTER TABLE "visual_templates" ADD COLUMN "style_guide_id"` + contrainte FK, puis `migrations OK`.

- [ ] **Step 3 : Écrire le test du lien (doit échouer)**

`test/integration/visual-template-style-guide-link.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { db } from '@/lib/db/client';
import { createStyleGuide, deleteStyleGuide } from '@/lib/db/repositories/style-guides';
import {
  createVisualTemplate,
  getVisualTemplate,
  listVisualTemplatesByStyleGuide,
} from '@/lib/db/repositories/visual-templates';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

const TPL = {
  slug: 'lien-tpl',
  label: 'Lien',
  platform: 'linkedin',
  width: 1080,
  height: 1080,
  bodyHtml: '<div>{{t}}</div>',
  css: 'div{}',
  variablesSchema: [{ name: 't', label: 'T', type: 'string' as const }],
  sampleVars: { t: 'x' },
};

describe('lien visual_template ↔ style_guide', () => {
  test('createVisualTemplate persiste styleGuideId', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    const tpl = await createVisualTemplate('u1', { ...TPL, styleGuideId: g.id });
    expect(tpl?.styleGuideId).toBe(g.id);
  });

  test('listVisualTemplatesByStyleGuide ne renvoie que les templates du guide', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    await createVisualTemplate('u1', { ...TPL, slug: 'lie', styleGuideId: g.id });
    await createVisualTemplate('u1', { ...TPL, slug: 'libre', styleGuideId: null });
    const linked = await listVisualTemplatesByStyleGuide('u1', g.id);
    expect(linked).toHaveLength(1);
    expect(linked[0]?.slug).toBe('lie');
  });

  test('supprimer le guide remet styleGuideId à null sans casser le template', async () => {
    await makeUser('u1', 'a@test.com');
    const g = await createStyleGuide('u1', { name: 'G', content: '# g' });
    const tpl = await createVisualTemplate('u1', { ...TPL, styleGuideId: g.id });
    await deleteStyleGuide('u1', g.id);
    const after = await getVisualTemplate('u1', tpl!.id);
    expect(after).toBeDefined();
    expect(after?.styleGuideId).toBeNull();
  });
});
```

Run : `npm run test:integration -- visual-template-style-guide-link`
Expected : FAIL (type `styleGuideId` absent des inputs + `listVisualTemplatesByStyleGuide` introuvable).

- [ ] **Step 4 : Étendre le repository**

Dans `src/lib/db/repositories/visual-templates.ts` :

Ajouter `styleGuideId?: string | null;` à la fin de `CreateVisualTemplateInput` et à l'objet de `UpdateVisualTemplatePatch` :
```ts
export type CreateVisualTemplateInput = {
  slug: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: unknown;
  styleGuideId?: string | null;
};

export type UpdateVisualTemplatePatch = Partial<{
  slug: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: unknown;
  sampleVars: unknown;
  styleGuideId: string | null;
}>;
```

Ajouter la fonction (après `listVisualTemplates`) :
```ts
export async function listVisualTemplatesByStyleGuide(
  userId: string,
  styleGuideId: string,
): Promise<VisualTemplate[]> {
  return db
    .select()
    .from(visualTemplates)
    .where(
      and(eq(visualTemplates.userId, userId), eq(visualTemplates.styleGuideId, styleGuideId)),
    );
}
```

- [ ] **Step 5 : Lancer le test (doit passer)**

Run : `npm run test:integration -- visual-template-style-guide-link`
Expected : PASS (3 tests).

- [ ] **Step 6 : Commit**

```bash
npm run format && npm run lint
git add src/lib/db/schemas/visual-templates.ts src/lib/db/repositories/visual-templates.ts test/integration/visual-template-style-guide-link.test.ts drizzle/
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): visual_templates.styleGuideId (FK nullable, set null)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Tools MCP style guides + `styleGuideId` sur les templates

**Files:**
- Create: `src/lib/mcp/tools/style-guides.ts`
- Modify: `src/lib/mcp/server.ts`
- Modify: `src/lib/mcp/tools/visuals.ts`
- Test: `test/integration/mcp-tools-style-guides.test.ts`

- [ ] **Step 1 : Écrire le test MCP (doit échouer)**

`test/integration/mcp-tools-style-guides.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { styleGuideImpl } from '@/lib/mcp/tools/style-guides';
import { visualImpl } from '@/lib/mcp/tools/visuals';
import { createTestUser } from './helpers/seed';

describe('mcp tools — style guides', () => {
  test('create → list → update → delete', async () => {
    const userId = await createTestUser('sg');
    const g = await styleGuideImpl.create(userId, { name: 'Sombre', content: '# palette' });
    expect((await styleGuideImpl.list(userId)).some((x) => x.id === g.id)).toBe(true);
    const upd = await styleGuideImpl.update(userId, { id: g.id, name: 'Sombre 2' });
    expect(upd?.name).toBe('Sombre 2');
    await styleGuideImpl.delete(userId, { id: g.id });
    expect((await styleGuideImpl.list(userId)).some((x) => x.id === g.id)).toBe(false);
  });

  test('get renvoie le markdown + refs légères des templates rattachés', async () => {
    const userId = await createTestUser('sgget');
    const g = await styleGuideImpl.create(userId, { name: 'G', content: '# md' });
    await visualImpl.createTemplate(userId, {
      slug: 'sg-tpl',
      label: 'SG TPL',
      platform: 'linkedin',
      width: 1080,
      height: 1080,
      bodyHtml: '<div>{{t}}</div>',
      css: 'div{}',
      variablesSchema: [{ name: 't', label: 'T', type: 'string' as const }],
      sampleVars: { t: 'x' },
      styleGuideId: g.id,
    });
    const got = await styleGuideImpl.get(userId, { id: g.id });
    expect(got.content).toBe('# md');
    expect(got.templates).toEqual([{ id: expect.any(String), label: 'SG TPL', slug: 'sg-tpl' }]);
  });

  test('get sur un id inconnu → throw', async () => {
    const userId = await createTestUser('sgko');
    await expect(styleGuideImpl.get(userId, { id: 'nope' })).rejects.toThrow(/introuvable/);
  });
});
```

Run : `npm run test:integration -- mcp-tools-style-guides`
Expected : FAIL (module `tools/style-guides` absent ; `createTemplate` n'accepte pas `styleGuideId`).

- [ ] **Step 2 : Implémenter les tools style guides**

`src/lib/mcp/tools/style-guides.ts` :
```ts
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createStyleGuide,
  deleteStyleGuide,
  getStyleGuide,
  listStyleGuides,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import { listVisualTemplatesByStyleGuide } from '@/lib/db/repositories/visual-templates';
import { handle } from '../register';

export const styleGuideImpl = {
  list: (userId: string) => listStyleGuides(userId),
  get: async (userId: string, input: { id: string }) => {
    const guide = await getStyleGuide(userId, input.id);
    if (!guide) throw new Error('Style guide introuvable');
    const templates = await listVisualTemplatesByStyleGuide(userId, guide.id);
    return {
      ...guide,
      templates: templates.map((t) => ({ id: t.id, label: t.label, slug: t.slug })),
    };
  },
  create: (userId: string, input: { name: string; content: string }) =>
    createStyleGuide(userId, input),
  update: (userId: string, input: { id: string; name?: string; content?: string }) =>
    updateStyleGuide(userId, input.id, { name: input.name, content: input.content }),
  delete: async (userId: string, input: { id: string }) => {
    await deleteStyleGuide(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerStyleGuideTools(server: McpServer): void {
  server.registerTool(
    'list_style_guides',
    {
      title: 'Lister les style guides',
      description: 'Style guides (langue visuelle : palette, typos, exemples).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => styleGuideImpl.list(u)),
  );
  server.registerTool(
    'get_style_guide',
    {
      title: 'Détails d’un style guide',
      description:
        'Renvoie un style guide (markdown) + la liste légère de ses templates rattachés (id, label, slug). Charger un exemple via get_visual_template.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.get(u, input)),
  );
  server.registerTool(
    'create_style_guide',
    {
      title: 'Créer un style guide',
      description:
        'Crée un style guide (name + content markdown : palette, typos avec URLs/@font-face, exemples, conventions).',
      inputSchema: { name: z.string(), content: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.create(u, input)),
  );
  server.registerTool(
    'update_style_guide',
    {
      title: 'Modifier un style guide',
      description: 'Met à jour un style guide.',
      inputSchema: { id: z.string(), name: z.string().optional(), content: z.string().optional() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.update(u, input)),
  );
  server.registerTool(
    'delete_style_guide',
    {
      title: 'Supprimer un style guide',
      description: 'Supprime un style guide.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.delete(u, input)),
  );
}
```

- [ ] **Step 3 : Enregistrer les tools dans le serveur**

Dans `src/lib/mcp/server.ts` : ajouter l'import (ordre alphabétique, avant `registerVisualTools`) :
```ts
import { registerStyleGuideTools } from './tools/style-guides';
```
Et l'appel dans `registerAllTools`, avant `registerVisualTools(server);` :
```ts
  registerStyleGuideTools(server);
```

- [ ] **Step 4 : Accepter `styleGuideId` sur create/update template**

Dans `src/lib/mcp/tools/visuals.ts` :

Ajouter `styleGuideId?: string | null;` à la fin du type `TemplateInput`.

Dans `createTemplate`, ajouter au littéral passé à `createVisualTemplate` (après `sampleVars: input.sampleVars,`) :
```ts
      styleGuideId: input.styleGuideId ?? null,
```

Dans l'`inputSchema` de `create_visual_template`, ajouter après `sampleVars: ...` :
```ts
        styleGuideId: z.string().nullable().optional(),
```
Dans l'`inputSchema` de `update_visual_template`, ajouter après `sampleVars: ...optional(),` :
```ts
        styleGuideId: z.string().nullable().optional(),
```
(`updateTemplate` propage déjà `styleGuideId` via `const { id, ...patch } = input;`.)

- [ ] **Step 5 : Lancer le test (doit passer)**

Run : `npm run test:integration -- mcp-tools-style-guides`
Expected : PASS (3 tests).

- [ ] **Step 6 : Non-régression des tools visuels existants**

Run : `npm run test:integration -- mcp-tools-visuals`
Expected : PASS (inchangé).

- [ ] **Step 7 : Commit**

```bash
npm run format && npm run lint
git add src/lib/mcp/tools/style-guides.ts src/lib/mcp/server.ts src/lib/mcp/tools/visuals.ts test/integration/mcp-tools-style-guides.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): tools MCP style guides + styleGuideId sur templates

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : `renderMarkdown` + back-office style guides

**Files:**
- Create: `src/lib/markdown.ts`
- Create: `src/app/(settings)/settings/style-guides/style-guide-form.tsx`
- Create: `src/app/(settings)/settings/style-guides/page.tsx`
- Create: `src/app/(settings)/settings/style-guides/new/page.tsx`, `new/actions.ts`, `new/actions-core.ts`
- Create: `src/app/(settings)/settings/style-guides/[id]/page.tsx`, `[id]/actions.ts`, `[id]/actions-core.ts`, `[id]/danger-zone.tsx`
- Modify: `src/components/settings/settings-sidebar.tsx`
- Test: `test/unit/markdown.test.ts`, `test/integration/style-guide-create-action.test.ts`

- [ ] **Step 1 : Installer `marked`**

Run : `npm install marked`
Expected : `marked` ajouté aux `dependencies` de `package.json`.

- [ ] **Step 2 : Écrire le test de `renderMarkdown` (doit échouer)**

`test/unit/markdown.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { renderMarkdown } from '@/lib/markdown';

describe('renderMarkdown', () => {
  test('rend titres et gras', () => {
    const html = renderMarkdown('# Titre\n\n**gras**');
    expect(html).toContain('<h1>Titre</h1>');
    expect(html).toContain('<strong>gras</strong>');
  });

  test('rend les listes', () => {
    const html = renderMarkdown('- a\n- b');
    expect(html).toContain('<li>a</li>');
  });
});
```

Run : `npm run test:unit -- markdown`
Expected : FAIL (module `@/lib/markdown` absent).

- [ ] **Step 3 : Implémenter `renderMarkdown`**

`src/lib/markdown.ts` :
```ts
import { marked } from 'marked';

// Rend du markdown en HTML (synchrone). Utilisé pour l'aperçu d'un style guide
// dans le back-office. Le contenu provient de l'auteur authentifié.
export function renderMarkdown(md: string): string {
  return marked.parse(md, { async: false });
}
```

Run : `npm run test:unit -- markdown`
Expected : PASS (2 tests).

- [ ] **Step 4 : Écrire le formulaire**

`src/app/(settings)/settings/style-guides/style-guide-form.tsx` :
```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export type StyleGuideActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = { name: string; content: string };

const EMPTY_INITIAL: Initial = { name: '', content: '' };

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function StyleGuideForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (prev: StyleGuideActionState, formData: FormData) => Promise<StyleGuideActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<StyleGuideActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'validation') toast.error('Champs invalides');
      else toast.error('Erreur lors de la sauvegarde');
    }
  }, [state, successMessage]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form key={JSON.stringify(values)} action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Nom</Label>
        <Input id="name" name="name" type="text" defaultValue={values.name} maxLength={100} />
        {fieldErrors?.name && <p className="text-sm text-red-600">{fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="content">Contenu (markdown)</Label>
        <Textarea
          id="content"
          name="content"
          defaultValue={values.content}
          maxLength={50000}
          rows={20}
        />
        {fieldErrors?.content && <p className="text-sm text-red-600">{fieldErrors.content}</p>}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
```

- [ ] **Step 5 : Écrire la logique de validation (core) du create**

`src/app/(settings)/settings/style-guides/new/actions-core.ts` :
```ts
import { z } from 'zod';
import { createStyleGuide } from '@/lib/db/repositories/style-guides';
import type { StyleGuideActionState } from '../style-guide-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(50000),
});

export async function createStyleGuideCore(
  userId: string,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    content: String(formData.get('content') ?? ''),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await createStyleGuide(userId, parsed.data);
  return { status: 'success' };
}
```

- [ ] **Step 6 : Écrire le test de l'action core (doit échouer puis passer)**

`test/integration/style-guide-create-action.test.ts` :
```ts
import { describe, expect, test } from 'vitest';
import { createStyleGuideCore } from '@/app/(settings)/settings/style-guides/new/actions-core';
import { db } from '@/lib/db/client';
import { listStyleGuides } from '@/lib/db/repositories/style-guides';
import { user } from '@/lib/db/schema';

async function makeUser(id: string, email: string) {
  await db.insert(user).values({ id, email });
}

function fd(values: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.append(k, v);
  return f;
}

describe('createStyleGuideCore', () => {
  test('success : crée le guide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createStyleGuideCore('u1', fd({ name: 'Sombre', content: '# md' }));
    expect(result.status).toBe('success');
    const rows = await listStyleGuides('u1');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toBe('Sombre');
  });

  test('validation error : name vide', async () => {
    await makeUser('u1', 'a@test.com');
    const result = await createStyleGuideCore('u1', fd({ name: '', content: 'x' }));
    expect(result.status).toBe('error');
    if (result.status === 'error') expect(result.fieldErrors?.name).toBeDefined();
  });
});
```

Run : `npm run test:integration -- style-guide-create-action`
Expected : PASS (le core et le repo existent déjà à ce stade).

- [ ] **Step 7 : Écrire les server actions du create**

`src/app/(settings)/settings/style-guides/new/actions.ts` :
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { StyleGuideActionState } from '../style-guide-form';
import { createStyleGuideCore } from './actions-core';

export async function createStyleGuideAction(
  _prev: StyleGuideActionState,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await createStyleGuideCore(session.user.id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/style-guides');
    redirect('/settings/style-guides');
  }
  return result;
}
```

- [ ] **Step 8 : Écrire les core + actions de l'édition**

`src/app/(settings)/settings/style-guides/[id]/actions-core.ts` :
```ts
import { z } from 'zod';
import {
  deleteStyleGuide,
  getStyleGuide,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import type { StyleGuideActionState } from '../style-guide-form';

const schema = z.object({
  name: z.string().min(1).max(100),
  content: z.string().min(1).max(50000),
});

export async function updateStyleGuideCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const existing = await getStyleGuide(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const raw = {
    name: String(formData.get('name') ?? ''),
    content: String(formData.get('content') ?? ''),
  };

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? '');
      if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors };
  }

  await updateStyleGuide(userId, id, parsed.data);
  return { status: 'success' };
}

export async function deleteStyleGuideCore(
  userId: string,
  id: string,
): Promise<StyleGuideActionState> {
  const existing = await getStyleGuide(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };
  await deleteStyleGuide(userId, id);
  return { status: 'success' };
}
```

`src/app/(settings)/settings/style-guides/[id]/actions.ts` :
```ts
'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import type { StyleGuideActionState } from '../style-guide-form';
import { deleteStyleGuideCore, updateStyleGuideCore } from './actions-core';

export async function updateStyleGuideAction(
  id: string,
  _prev: StyleGuideActionState,
  formData: FormData,
): Promise<StyleGuideActionState> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return { status: 'error', message: 'unauthenticated' };

  const result = await updateStyleGuideCore(session.user.id, id, formData);
  if (result.status === 'success') {
    revalidatePath(`/settings/style-guides/${id}`);
    revalidatePath('/settings/style-guides');
  }
  return result;
}

export async function deleteStyleGuideActionRaw(id: string): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return;
  await deleteStyleGuideCore(session.user.id, id);
  revalidatePath('/settings/style-guides');
  redirect('/settings/style-guides');
}
```

- [ ] **Step 9 : Écrire la danger zone**

`src/app/(settings)/settings/style-guides/[id]/danger-zone.tsx` :
```tsx
'use client';

import { useRef } from 'react';
import { Button } from '@/components/ui/button';

export function DangerZone({ deleteAction }: { deleteAction: () => Promise<void> }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <section className="space-y-2">
      <h3 className="text-lg font-semibold text-red-700">Zone dangereuse</h3>
      <p className="text-sm text-neutral-600">La suppression est définitive.</p>
      <Button type="button" variant="destructive" onClick={() => dialogRef.current?.showModal()}>
        Supprimer ce style guide
      </Button>
      <dialog ref={dialogRef} className="rounded-md p-6 shadow-xl backdrop:bg-black/40">
        <p className="mb-4 text-sm">Confirmer la suppression ?</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="px-3 py-1 text-sm"
            onClick={() => dialogRef.current?.close()}
          >
            Annuler
          </button>
          <form action={deleteAction}>
            <button type="submit" className="rounded bg-red-600 px-3 py-1 text-sm text-white">
              Supprimer
            </button>
          </form>
        </div>
      </dialog>
    </section>
  );
}
```

- [ ] **Step 10 : Écrire la page liste**

`src/app/(settings)/settings/style-guides/page.tsx` :
```tsx
import { headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { SettingsPage } from '@/components/settings/settings-page';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { auth } from '@/lib/auth/server';
import { listStyleGuides } from '@/lib/db/repositories/style-guides';

export default async function StyleGuidesListPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const guides = await listStyleGuides(session.user.id);

  return (
    <SettingsPage
      title="Style guides"
      description="La langue visuelle (palette, typos, exemples) lue pour créer des templates cohérents."
      action={
        <Button nativeButton={false} render={<Link href="/settings/style-guides/new" />}>
          + Nouveau
        </Button>
      }
    >
      {guides.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun style guide pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {guides.map((g) => (
            <li key={g.id}>
              <Link href={`/settings/style-guides/${g.id}`} className="block">
                <Card className="p-4 transition-shadow hover:shadow-sm">
                  <p className="font-medium">{g.name}</p>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </SettingsPage>
  );
}
```

- [ ] **Step 11 : Écrire la page création**

`src/app/(settings)/settings/style-guides/new/page.tsx` :
```tsx
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { StyleGuideForm } from '../style-guide-form';
import { createStyleGuideAction } from './actions';

export default async function NewStyleGuidePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  return (
    <SettingsPage title="Nouveau style guide">
      <SettingsCard>
        <StyleGuideForm
          mode="create"
          action={createStyleGuideAction}
          successMessage="Style guide créé"
        />
      </SettingsCard>
    </SettingsPage>
  );
}
```

- [ ] **Step 12 : Écrire la page édition (formulaire + aperçu + templates rattachés)**

`src/app/(settings)/settings/style-guides/[id]/page.tsx` :
```tsx
import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { SettingsCard } from '@/components/settings/settings-card';
import { SettingsPage } from '@/components/settings/settings-page';
import { auth } from '@/lib/auth/server';
import { getStyleGuide } from '@/lib/db/repositories/style-guides';
import { listVisualTemplatesByStyleGuide } from '@/lib/db/repositories/visual-templates';
import { renderMarkdown } from '@/lib/markdown';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { TemplateCard } from '../../visual-templates/_components/template-card';
import { toTemplateCardData } from '../../visual-templates/_components/template-card-data';
import { deleteStyleGuideActionRaw, updateStyleGuideAction } from './actions';
import { DangerZone } from './danger-zone';
import { StyleGuideForm } from '../style-guide-form';

export default async function EditStyleGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/signin');

  const { id } = await params;
  const guide = await getStyleGuide(session.user.id, id);
  if (!guide) notFound();

  const [templates, brand] = await Promise.all([
    listVisualTemplatesByStyleGuide(session.user.id, id),
    buildBrandContext(session.user.id),
  ]);
  const cards = toTemplateCardData(templates, brand);

  const updateAction = updateStyleGuideAction.bind(null, id);
  const deleteAction = deleteStyleGuideActionRaw.bind(null, id);

  return (
    <SettingsPage title="Éditer le style guide">
      <SettingsCard>
        <StyleGuideForm
          mode="edit"
          initial={{ name: guide.name, content: guide.content }}
          action={updateAction}
          successMessage="Style guide mis à jour"
        />
      </SettingsCard>
      <SettingsCard title="Aperçu">
        <div
          className="max-w-none text-sm text-neutral-800 [&_h1]:mb-2 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:my-2"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: contenu markdown de l'auteur, back-office authentifié
          dangerouslySetInnerHTML={{ __html: renderMarkdown(guide.content) }}
        />
      </SettingsCard>
      <SettingsCard title="Templates rattachés">
        {cards.length === 0 ? (
          <p className="text-sm text-neutral-600">Aucun template rattaché.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {cards.map((card) => (
              <TemplateCard key={card.id} card={card} />
            ))}
          </div>
        )}
      </SettingsCard>
      <SettingsCard>
        <DangerZone deleteAction={deleteAction} />
      </SettingsCard>
    </SettingsPage>
  );
}
```

- [ ] **Step 13 : Ajouter l'entrée de menu**

Dans `src/components/settings/settings-sidebar.tsx`, ajouter dans le tableau `items`, après la ligne `{ label: 'Visual templates', href: '/settings/visual-templates' },` :
```ts
  { label: 'Style guides', href: '/settings/style-guides' },
```

- [ ] **Step 14 : Vérifier compilation + suite**

Run : `npx tsc --noEmit`
Expected : aucun erreur.
Run : `npm run test:integration -- style-guide-create-action && npm run test:unit -- markdown`
Expected : PASS.

- [ ] **Step 15 : Commit**

```bash
npm run format && npm run lint
git add src/lib/markdown.ts "src/app/(settings)/settings/style-guides" src/components/settings/settings-sidebar.tsx package.json package-lock.json test/unit/markdown.test.ts test/integration/style-guide-create-action.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): back-office style guides (CRUD + aperçu markdown + templates liés)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Retrait de la couleur de marque

**Files:**
- Modify (source): `src/lib/db/schemas/settings.ts`, `src/lib/db/repositories/settings.ts`, `src/lib/visual-templates/brand.ts`, `src/app/(settings)/settings/brand/actions-core.ts`, `src/app/(settings)/settings/brand/brand-form.tsx`, `src/app/(settings)/settings/brand/page.tsx`, `src/app/(settings)/settings/visual-templates/visual-template-form.tsx`
- Modify (tests): `test/integration/brand-context.test.ts`, `test/integration/settings-action.test.ts`, `test/unit/visual-templates-compile.test.ts`, `test/e2e/settings-brand.spec.ts`

- [ ] **Step 1 : Mettre à jour les tests d'abord (rouge attendu)**

`test/unit/visual-templates-compile.test.ts` :
- Dans la const `BRAND`, supprimer la ligne `color: '#123456',`.
- Test `expose le contexte brand` : remplacer le `bodyHtml` par `'<div>{{brand.name}}/{{brand.signature}}</div>'` et l'assertion par `expect(out).toContain('<div>Acme/ACME.IO</div>');`.
- Test `interpole aussi dans le CSS` : remplacer la propriété `css` par `'body::after { content: "{{brand.name}}"; }'` et l'assertion par `expect(out).toContain('content: "Acme"');`.

`test/integration/brand-context.test.ts` :
- Test 1 : titre → `'mappe les réglages, signature vide → null, logo absent → chaîne vide'` (inchangé) ; assertion → `expect(brand).toEqual({ name: '', signature: null, logo: '' });`.
- Test 2 : titre → `'expose nom, signature et logo renseignés'` ; retirer `brandColor: '#112233',` de l'appel `updateSettings` ; assertion → `expect(brand).toEqual({ name: 'Acme', signature: 'ACME.IO', logo: 'https://cdn.example/logo.png' });`.
- Test 3 : assertion → `expect(brand).toEqual({ name: '', signature: null, logo: '' });`.

`test/integration/settings-action.test.ts` :
- Test `success ...` : titre → `'success : met à jour les champs et retourne success'` ; retirer `brand_color: '#112233',` du `fd` ; retirer `expect(settings?.brandColor).toBe('#112233');`.
- Supprimer entièrement le test `validation error : brand_color au mauvais format` (le bloc `test(... )` complet).
- Test `validation error : brand_name trop long` : retirer `brand_color: '#000000',` du `fd`.

`test/e2e/settings-brand.spec.ts` :
- Supprimer la ligne `await page.fill('input[name="brand_color"]', '#ff0066');`.
- Supprimer la ligne `await expect(page.locator('input[name="brand_color"]')).toHaveValue('#ff0066');`.

Run : `npm run test:unit -- visual-templates-compile`
Expected : à ce stade les tests unit échouent encore (TypeScript : `BRAND` n'a plus `color` mais `Brand` l'exige encore) — on corrige la source aux steps suivants.

- [ ] **Step 2 : Retirer la couleur du type `Brand`**

`src/lib/visual-templates/brand.ts` :
- Type `Brand` : supprimer la ligne `color: string;`.
- `EMPTY_BRAND` : supprimer `color: '#000000',`.
- `buildBrandContext` : supprimer `color: settings.brandColor,`.

- [ ] **Step 3 : Retirer la colonne du schéma + repository settings**

`src/lib/db/schemas/settings.ts` : supprimer la ligne `brandColor: text('brand_color').notNull().default('#000000'),`.

`src/lib/db/repositories/settings.ts` : dans le `Pick` de `SettingsPatch`, retirer `'brandColor'` →
```ts
type SettingsPatch = Partial<Pick<Settings, 'brandName' | 'brandSignature' | 'brandLogoUrl'>>;
```

- [ ] **Step 4 : Retirer la couleur du formulaire de marque**

`src/app/(settings)/settings/brand/actions-core.ts` :
- `brandSchema` : supprimer `brand_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),`.
- `raw` : supprimer `brand_color: String(formData.get('brand_color') ?? ''),`.
- appel `updateSettings` : supprimer `brandColor: parsed.data.brand_color,`.

`src/app/(settings)/settings/brand/brand-form.tsx` :
- Type `Initial` : supprimer `brandColor: string;`.
- Supprimer le bloc complet du champ couleur (le `<div className="space-y-2">` contenant le `Label htmlFor="brand_color"` et son `Input` + le message d'erreur `brand_color`).

`src/app/(settings)/settings/brand/page.tsx` :
- dans `initialValues`, supprimer `brandColor: settings.brandColor,`.

- [ ] **Step 5 : Retirer `{{brand.color}}` de la doc du template form**

`src/app/(settings)/settings/visual-templates/visual-template-form.tsx` :
- Supprimer le `<li>` documentant `{{brand.color}}` (le bloc `<li> ... {{brand.color}} ... couleur principale (hex) </li>`).

- [ ] **Step 6 : Générer et appliquer la migration (DROP COLUMN)**

Run : `npm run db:generate && npm run db:test:prepare`
Expected : migration `drizzle/NNNN_*.sql` contenant `ALTER TABLE "settings" DROP COLUMN "brand_color";`, puis `migrations OK`.

- [ ] **Step 7 : Vérifier compilation + suite**

Run : `npx tsc --noEmit`
Expected : aucune erreur (plus aucune référence à `brandColor`/`brand.color`).
Run : `npm run test:unit -- visual-templates-compile && npm run test:integration -- brand-context settings-action`
Expected : PASS.

- [ ] **Step 8 : Commit**

```bash
npm run format && npm run lint
git add src/lib/db/schemas/settings.ts src/lib/db/repositories/settings.ts src/lib/visual-templates/brand.ts "src/app/(settings)/settings/brand" src/app/\(settings\)/settings/visual-templates/visual-template-form.tsx test/integration/brand-context.test.ts test/integration/settings-action.test.ts test/unit/visual-templates-compile.test.ts test/e2e/settings-brand.spec.ts drizzle/
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): retire la couleur dynamique de la marque (couleurs portées par les style guides)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Câblage dans le skill `content-os-redaction`

**Files:**
- Modify: `skills/content-os-redaction/SKILL.md`
- Modify: `skills/content-os-redaction/visuel/choisir-template-et-remplir.md`

Note : édits de documentation (pas de test unitaire). Suivre la règle « instantané, pas historique » : décrire l'état cible, sans cadrage par contraste.

- [ ] **Step 1 : Ajouter les tools style guides aux prérequis**

Dans `skills/content-os-redaction/SKILL.md`, section « Prérequis : le connecteur ContentOS », dans la phrase listant les tools visuels, ajouter `list_style_guides`, `get_style_guide`. La phrase devient :
```
Pour le visuel d'accompagnement, il utilise aussi `list_visual_templates`, `get_visual_template`, `list_visual_styles`, `list_style_guides`, `get_style_guide`, `generate_image`, `list_gallery_images`, `render_visual`, `attach_media_to_post` (et `edit_image`, `detach_media` au besoin).
```

- [ ] **Step 2 : Mentionner le style guide en phase 4**

Dans `SKILL.md`, phase 4, l'étape 2 décrit le cas « template + image ». Remplacer la puce 2 par :
```
2. Pour une carte de marque ou un template + image : `visuel/choisir-template-et-remplir.md`. Si aucun template existant ne convient et qu'il faut en créer un, lire d'abord le style guide pertinent (`list_style_guides` → `get_style_guide`) pour en respecter la palette, les typos et les conventions.
```

- [ ] **Step 3 : Décrire la création depuis un style guide dans la brique**

Dans `skills/content-os-redaction/visuel/choisir-template-et-remplir.md`, ajouter une section avant « ## Règle de frontière » :
```markdown
## Créer un template depuis le style guide

Quand aucun template ne convient à l'intention validée :

1. `list_style_guides` → repérer le style guide qui porte la langue visuelle voulue ; `get_style_guide(id)` pour lire ses recommandations (palette, typos avec leurs URLs/`@font-face`, conventions) et la liste de ses templates rattachés.
2. Lire un ou deux templates rattachés via `get_visual_template(id)` : ce sont des exemples concrets de la langue visuelle appliquée en HTML/CSS.
3. Écrire le nouveau template en reprenant couleurs et polices du style guide directement dans le CSS, puis le créer avec `create_visual_template` en renseignant `styleGuideId` pour le rattacher au guide.
```

- [ ] **Step 4 : Vérifier que la suite unit reste verte**

Run : `npm run test:unit`
Expected : PASS (les édits de skill n'impactent pas les tests ; le zip du skill se régénère au build).

- [ ] **Step 5 : Commit**

```bash
git add skills/content-os-redaction/SKILL.md skills/content-os-redaction/visuel/choisir-template-et-remplir.md
git commit -m "$(cat <<'EOF'
🤖 feat(spec-27): le skill lit le style guide avant de créer un template visuel

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Couverture de la spec :**
- Entité `style_guides` (id, userId, name, content) → Task 1. ✓
- FK `styleGuideId` (nullable, set null) → Task 2. ✓
- Retrait `brandColor` / `{{brand.color}}` + marque = name/signature/logo → Task 5. ✓
- 5 tools MCP + `get_style_guide` renvoie markdown + refs légères ; `create_visual_template` accepte `styleGuideId` → Task 3. ✓
- Back-office `/settings/style-guides` (liste, créer, éditer, aperçu markdown rendu, supprimer) + templates rattachés sur la page du guide → Task 4. ✓
- Câblage skill (prérequis + phase 4 + brique) → Task 6. ✓
- Migration de données `{{brand.color}}` : aucune occurrence dans seeds/code (vérifié) ; le retrait au Task 5 casse au rendu tout template stocké qui y référerait — à vérifier en base avant déploiement (note d'exploitation, pas de code).

**Cohérence des types :** `styleGuideId` typé `string | null` partout (schéma → `CreateVisualTemplateInput`/`UpdateVisualTemplatePatch` → `TemplateInput` MCP → zod `z.string().nullable().optional()`). `StyleGuideActionState`, `createStyleGuideCore`/`updateStyleGuideCore`/`deleteStyleGuideCore`, `styleGuideImpl.{list,get,create,update,delete}` cohérents entre tasks. `renderMarkdown` défini Task 4 avant son usage page édition.

**Placeholders :** aucun TODO/TBD ; chaque step de code montre le code, chaque commande son résultat attendu.

**Portée :** un seul sous-système cohérent (entité + MCP + back-office + câblage skill). Pas de découpage supplémentaire nécessaire.
