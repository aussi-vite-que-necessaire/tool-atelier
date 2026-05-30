# Spec 5 (Visual Templates) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permettre à un user d'ajouter à un post un visuel généré depuis un template HTML+CSS+variables stocké en DB, rendu en PNG via Puppeteer dans le worker BullMQ.

**Architecture:** Nouvelle table `visual_templates` (Drizzle) scopée user. DSL maison pour les variables stocké en jsonb, converti en Zod runtime. Compilation Handlebars + rendu Puppeteer dans une nouvelle queue BullMQ `render-visual`. Back-office CRUD à `/settings/visual-templates`. Picker média via dialog sur `/posts/[id]`.

**Tech Stack:** Drizzle ORM + Postgres, BullMQ + Redis (Spec 1), Cloudflare R2 (`@aws-sdk/client-s3`) + InMemory fallback, Puppeteer 22.x, Handlebars 4.x, Zod 4.x, Next.js 16 App Router + React 19 (Server Actions + `useActionState`), shadcn/ui, Vitest (unit/integration/worker projects), Playwright (E2E).

**Référence spec :** `docs/superpowers/specs/2026-05-23-spec-5-visual-templates-design.md`

---

## File Structure

**Nouveaux fichiers source :**
- `src/lib/db/schemas/visual-templates.ts` — schéma Drizzle.
- `src/lib/db/repositories/visual-templates.ts` — CRUD scopé user.
- `src/lib/visual-templates/dsl.ts` — DSL `VariableSpec[]` + parse + `variablesSchemaToZod`.
- `src/lib/visual-templates/compile.ts` — compileur Handlebars + helpers + cache LRU.
- `src/lib/visual-templates/render.ts` — Puppeteer singleton + `renderHtmlToPng` + stub.
- `src/lib/visual-templates/base.css` — fonts AVQN + reset.
- `src/lib/visual-templates/seeds/linkedin-big-number.ts` — données seed.
- `src/lib/visual-templates/seeds/linkedin-manifesto.ts` — données seed.
- `src/lib/visual-templates/seeds/index.ts` — barrel.
- `src/worker/queues/render-visual.ts` — worker BullMQ.
- `scripts/seed-visual-templates.ts` — script manuel idempotent.
- `src/app/(app)/settings/visual-templates/page.tsx` — liste.
- `src/app/(app)/settings/visual-templates/visual-template-form.tsx` — form partagé create/edit.
- `src/app/(app)/settings/visual-templates/variables-schema-editor.tsx` — repeater variables.
- `src/app/(app)/settings/visual-templates/preview-panel.tsx` — bouton preview + img.
- `src/app/(app)/settings/visual-templates/new/{page,actions,actions-core}.tsx/.ts`.
- `src/app/(app)/settings/visual-templates/[id]/{page,actions,actions-core,danger-zone,preview-actions}.tsx/.ts`.
- `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx`.
- `src/app/(app)/posts/[id]/_components/variables-form.tsx`.
- `src/app/(app)/posts/[id]/_components/visual-display.tsx`.
- `src/app/(app)/posts/[id]/media-actions.ts`.

**Nouveaux tests :**
- `test/unit/visual-templates-dsl.test.ts`.
- `test/unit/visual-templates-compile.test.ts`.
- `test/integration/visual-templates-repository.test.ts`.
- `test/integration/visual-template-create-action.test.ts`.
- `test/integration/visual-template-edit-action.test.ts`.
- `test/worker/render-visual.test.ts`.
- `test/e2e/visual-templates.spec.ts`.
- `test/e2e/post-visual.spec.ts`.

**Fichiers modifiés :**
- `src/lib/db/schema.ts` — barrel : ajouter `export * from './schemas/visual-templates'`.
- `src/lib/db/repositories/media.ts` — `createMedia` accepte un `id?` optionnel.
- `src/lib/queue/client.ts` — types + queue `render-visual`.
- `src/lib/queue/enqueue.ts` — `enqueueRenderVisual`.
- `src/lib/queue/registry.ts` — register `render-visual`.
- `src/worker/index.ts` — register Worker + cleanup Puppeteer.
- `src/lib/env.ts` — `CONTENT_OS_PUPPETEER_STUB`.
- `src/app/(app)/posts/[id]/_components/post-editor.tsx` — remplace pastille par bouton + display.
- `src/components/layout/*` — ajouter lien sidebar.
- `test/integration/tenant-isolation.test.ts` — étendre la sentinelle.
- `package.json` — deps `puppeteer`, `handlebars`.
- `.env.example` — `CONTENT_OS_PUPPETEER_STUB=`.
- `README.md` — note Puppeteer + seed script.

---

## Task 1: Setup — deps, schema DB, migration, repository

**Files:**
- Modify: `package.json`
- Create: `src/lib/db/schemas/visual-templates.ts`
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/db/repositories/visual-templates.ts`
- Create: `test/integration/visual-templates-repository.test.ts`

- [ ] **Step 1: Install deps**

```bash
npm install handlebars puppeteer
```

Expected: Puppeteer télécharge Chromium (~200MB), peut prendre 1-2 min.

- [ ] **Step 2: Créer le schéma Drizzle**

Créer `src/lib/db/schemas/visual-templates.ts` :

```ts
import { index, integer, jsonb, pgTable, text, timestamp, unique } from 'drizzle-orm/pg-core';
import { user } from './auth';

export const visualTemplates = pgTable(
  'visual_templates',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    label: text('label').notNull(),
    platform: text('platform').notNull().default('linkedin'),
    width: integer('width').notNull(),
    height: integer('height').notNull(),
    bodyHtml: text('body_html').notNull(),
    css: text('css').notNull(),
    variablesSchema: jsonb('variables_schema').notNull(),
    sampleVars: jsonb('sample_vars').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('visual_templates_user_id_idx').on(table.userId),
    unique('visual_templates_user_id_slug_unique').on(table.userId, table.slug),
  ],
);

export type VisualTemplate = typeof visualTemplates.$inferSelect;
```

- [ ] **Step 3: Enregistrer le schéma dans le barrel**

Modifier `src/lib/db/schema.ts` : ajouter en dernière ligne (avant la newline finale) :

```ts
export * from './schemas/visual-templates';
```

- [ ] **Step 4: Générer la migration Drizzle**

```bash
npm run db:generate
```

Expected: nouveau fichier `drizzle/<N>_xxx.sql` contenant `CREATE TABLE "visual_templates" ...`.

- [ ] **Step 5: Appliquer la migration**

```bash
npm run db:migrate
```

Expected: la table `visual_templates` existe en DB locale.

- [ ] **Step 6: Écrire les tests du repository (TDD)**

Créer `test/integration/visual-templates-repository.test.ts`. S'inspirer de `test/integration/writing-templates-repository.test.ts` pour la structure.

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createVisualTemplate,
  deleteVisualTemplate,
  getVisualTemplate,
  getVisualTemplateBySlug,
  listVisualTemplates,
  updateVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { createTestUser, resetDb } from './helpers/db';

const SAMPLE = {
  slug: 'test-card',
  label: 'Test card',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { font-size: 80px; }',
  variablesSchema: [
    { name: 'title', label: 'Titre', type: 'string', max: 50 },
  ],
  sampleVars: { title: 'Hello' },
};

describe('visual-templates repository', () => {
  beforeEach(async () => { await resetDb(); });

  it('createVisualTemplate inserts and returns row', async () => {
    const userId = await createTestUser();
    const row = await createVisualTemplate(userId, SAMPLE);
    expect(row).toBeDefined();
    expect(row?.slug).toBe('test-card');
    expect(row?.userId).toBe(userId);
  });

  it('createVisualTemplate returns undefined on duplicate (user, slug)', async () => {
    const userId = await createTestUser();
    await createVisualTemplate(userId, SAMPLE);
    const second = await createVisualTemplate(userId, SAMPLE);
    expect(second).toBeUndefined();
  });

  it('listVisualTemplates scopes by userId', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    await createVisualTemplate(a, SAMPLE);
    expect((await listVisualTemplates(a))).toHaveLength(1);
    expect((await listVisualTemplates(b))).toHaveLength(0);
  });

  it('getVisualTemplate enforces tenant isolation', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const created = await createVisualTemplate(a, SAMPLE);
    expect(await getVisualTemplate(a, created!.id)).toBeDefined();
    expect(await getVisualTemplate(b, created!.id)).toBeUndefined();
  });

  it('getVisualTemplateBySlug returns the right row', async () => {
    const userId = await createTestUser();
    await createVisualTemplate(userId, SAMPLE);
    const row = await getVisualTemplateBySlug(userId, 'test-card');
    expect(row?.label).toBe('Test card');
  });

  it('updateVisualTemplate patches only the given user', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const t = await createVisualTemplate(a, SAMPLE);
    expect(await updateVisualTemplate(b, t!.id, { label: 'Hijack' })).toBeUndefined();
    const refreshed = await getVisualTemplate(a, t!.id);
    expect(refreshed?.label).toBe('Test card');
  });

  it('deleteVisualTemplate is scoped', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const t = await createVisualTemplate(a, SAMPLE);
    await deleteVisualTemplate(b, t!.id);
    expect(await getVisualTemplate(a, t!.id)).toBeDefined();
    await deleteVisualTemplate(a, t!.id);
    expect(await getVisualTemplate(a, t!.id)).toBeUndefined();
  });
});
```

- [ ] **Step 7: Run tests (expected FAIL — repository missing)**

```bash
npm run test:integration -- visual-templates-repository
```

Expected: ÉCHEC avec "Cannot find module" ou similaire.

- [ ] **Step 8: Implémenter le repository**

Créer `src/lib/db/repositories/visual-templates.ts` :

```ts
import { and, eq } from 'drizzle-orm';
import { db } from '../client';
import { createId } from '../id';
import { type VisualTemplate, visualTemplates } from '../schema';

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
}>;

export async function createVisualTemplate(
  userId: string,
  data: CreateVisualTemplateInput,
): Promise<VisualTemplate | undefined> {
  const id = createId();
  const [row] = await db
    .insert(visualTemplates)
    .values({ id, userId, ...data })
    .onConflictDoNothing({ target: [visualTemplates.userId, visualTemplates.slug] })
    .returning();
  return row;
}

export async function getVisualTemplate(
  userId: string,
  id: string,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .select()
    .from(visualTemplates)
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function getVisualTemplateBySlug(
  userId: string,
  slug: string,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .select()
    .from(visualTemplates)
    .where(and(eq(visualTemplates.slug, slug), eq(visualTemplates.userId, userId)))
    .limit(1);
  return rows[0];
}

export async function listVisualTemplates(userId: string): Promise<VisualTemplate[]> {
  return db.select().from(visualTemplates).where(eq(visualTemplates.userId, userId));
}

export async function updateVisualTemplate(
  userId: string,
  id: string,
  patch: UpdateVisualTemplatePatch,
): Promise<VisualTemplate | undefined> {
  const rows = await db
    .update(visualTemplates)
    .set({ ...patch, updatedAt: new Date() })
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)))
    .returning();
  return rows[0];
}

export async function deleteVisualTemplate(userId: string, id: string): Promise<void> {
  await db
    .delete(visualTemplates)
    .where(and(eq(visualTemplates.id, id), eq(visualTemplates.userId, userId)));
}
```

- [ ] **Step 9: Run tests (expected PASS)**

```bash
npm run test:integration -- visual-templates-repository
```

Expected: tous les tests verts.

- [ ] **Step 10: Étendre la sentinelle tenant-isolation**

Modifier `test/integration/tenant-isolation.test.ts` : ajouter un bloc `describe('visual_templates', ...)` qui crée un template pour user A et vérifie que user B ne peut pas le `get`/`update`/`delete`.

Run:
```bash
npm run test:integration -- tenant-isolation
```

Expected: tests verts.

- [ ] **Step 11: Commit**

```bash
git add package.json package-lock.json src/lib/db/schemas/visual-templates.ts \
  src/lib/db/schema.ts src/lib/db/repositories/visual-templates.ts \
  drizzle/ test/integration/visual-templates-repository.test.ts \
  test/integration/tenant-isolation.test.ts

git commit -m "$(cat <<'EOF'
🤖 feat(spec-5): table visual_templates + repository + deps puppeteer/handlebars

Migration additive Drizzle pour la table visual_templates (scopée
user_id, unique (user_id, slug)). Repository CRUD avec tests +
extension de la sentinelle tenant-isolation. Installation des
deps puppeteer et handlebars.
EOF
)"
```

---

## Task 2: DSL des variables (parse + Zod converter)

**Files:**
- Create: `src/lib/visual-templates/dsl.ts`
- Create: `test/unit/visual-templates-dsl.test.ts`

- [ ] **Step 1: Écrire les tests unit (TDD)**

Créer `test/unit/visual-templates-dsl.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { parseVariablesSchema, variablesSchemaToZod, type VariablesSchema } from '@/lib/visual-templates/dsl';

describe('parseVariablesSchema', () => {
  it('accepts a valid string schema', () => {
    const raw = [{ name: 'title', label: 'Titre', type: 'string', max: 50 }];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  it('accepts string with min, description, optional', () => {
    const raw = [
      { name: 'a', label: 'A', type: 'string', min: 5, max: 50, optional: true, description: 'help' },
    ];
    expect(parseVariablesSchema(raw)).toEqual(raw);
  });

  it('rejects string without max', () => {
    expect(() => parseVariablesSchema([{ name: 'a', label: 'A', type: 'string' }])).toThrow();
  });

  it('rejects unknown type', () => {
    expect(() => parseVariablesSchema([{ name: 'a', label: 'A', type: 'number', max: 5 }])).toThrow();
  });

  it('rejects duplicate names', () => {
    const raw = [
      { name: 'a', label: 'A', type: 'string', max: 5 },
      { name: 'a', label: 'A2', type: 'string', max: 5 },
    ];
    expect(() => parseVariablesSchema(raw)).toThrow(/duplicate/i);
  });

  it('rejects non-array input', () => {
    expect(() => parseVariablesSchema({})).toThrow();
    expect(() => parseVariablesSchema(null)).toThrow();
  });
});

describe('variablesSchemaToZod', () => {
  const schema: VariablesSchema = [
    { name: 'title', label: 'Titre', type: 'string', min: 1, max: 50 },
    { name: 'subtitle', label: 'Sous', type: 'string', max: 140, optional: true },
  ];
  const zod = variablesSchemaToZod(schema);

  it('accepts valid values', () => {
    expect(zod.parse({ title: 'Hello', subtitle: 'World' })).toEqual({
      title: 'Hello',
      subtitle: 'World',
    });
  });

  it('accepts missing optional', () => {
    expect(zod.parse({ title: 'Hello' })).toEqual({ title: 'Hello' });
  });

  it('rejects missing required', () => {
    expect(() => zod.parse({ subtitle: 'World' })).toThrow();
  });

  it('rejects too short', () => {
    expect(() => zod.parse({ title: '' })).toThrow();
  });

  it('rejects too long', () => {
    expect(() => zod.parse({ title: 'x'.repeat(51) })).toThrow();
  });

  it('trims whitespace', () => {
    expect(zod.parse({ title: '  Hello  ' })).toEqual({ title: 'Hello' });
  });
});
```

- [ ] **Step 2: Run tests (expected FAIL — module missing)**

```bash
npm run test:unit -- visual-templates-dsl
```

Expected: ÉCHEC.

- [ ] **Step 3: Implémenter le DSL**

Créer `src/lib/visual-templates/dsl.ts` :

```ts
import { z, type ZodObject, type ZodTypeAny } from 'zod';

// MVP : type 'string' uniquement. Extensible plus tard (color, image, toggle, list...).
const variableSpecSchema = z.object({
  name: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, 'invalid identifier'),
  label: z.string().min(1),
  description: z.string().optional(),
  type: z.literal('string'),
  min: z.number().int().nonnegative().optional(),
  max: z.number().int().positive(),
  optional: z.boolean().optional(),
});

export type VariableSpec = z.infer<typeof variableSpecSchema>;
export type VariablesSchema = VariableSpec[];

const variablesSchemaMeta = z.array(variableSpecSchema).superRefine((arr, ctx) => {
  const seen = new Set<string>();
  for (const v of arr) {
    if (seen.has(v.name)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `duplicate variable name: ${v.name}`,
      });
    }
    seen.add(v.name);
  }
});

export function parseVariablesSchema(raw: unknown): VariablesSchema {
  return variablesSchemaMeta.parse(raw);
}

export function variablesSchemaToZod(schema: VariablesSchema): ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {};
  for (const v of schema) {
    let s: ZodTypeAny = z.string().trim();
    if (v.min !== undefined) s = (s as z.ZodString).min(v.min);
    s = (s as z.ZodString).max(v.max);
    if (v.optional) s = s.optional();
    shape[v.name] = s;
  }
  return z.object(shape);
}
```

- [ ] **Step 4: Run tests (expected PASS)**

```bash
npm run test:unit -- visual-templates-dsl
```

Expected: tous verts.

- [ ] **Step 5: Commit**

```bash
git add src/lib/visual-templates/dsl.ts test/unit/visual-templates-dsl.test.ts
git commit -m "🤖 feat(spec-5): DSL variables (string seul MVP) + converter Zod"
```

---

## Task 3: Handlebars compile + base CSS

**Files:**
- Create: `src/lib/visual-templates/base.css`
- Create: `src/lib/visual-templates/compile.ts`
- Create: `test/unit/visual-templates-compile.test.ts`

- [ ] **Step 1: Créer la base CSS**

Créer `src/lib/visual-templates/base.css` :

```css
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Regular.woff2") format("woff2"); font-weight: 400; font-display: block; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Medium.woff2") format("woff2"); font-weight: 500; font-display: block; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Semibold.woff2") format("woff2"); font-weight: 600; font-display: block; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Bold.woff2") format("woff2"); font-weight: 700; font-display: block; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Semibold.woff2") format("woff2"); font-weight: 600; font-display: block; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Bold.woff2") format("woff2"); font-weight: 700; font-display: block; font-style: normal; }

* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { background: #fff; color: #000; font-family: "General Sans", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif; }
```

- [ ] **Step 2: Écrire les tests compile (TDD)**

Créer `test/unit/visual-templates-compile.test.ts` :

```ts
import { describe, expect, it } from 'vitest';
import { compileTemplate } from '@/lib/visual-templates/compile';
import type { VisualTemplate } from '@/lib/db/schema';

function makeTemplate(overrides: Partial<VisualTemplate> = {}): VisualTemplate {
  return {
    id: 't1',
    userId: 'u1',
    slug: 'test',
    label: 'Test',
    platform: 'linkedin',
    width: 1080,
    height: 1080,
    bodyHtml: '<h1>{{title}}</h1>',
    css: 'h1 { color: red; }',
    variablesSchema: [],
    sampleVars: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

const BRAND = { name: 'Acme', color: '#123456', signature: 'ACME.IO' };

describe('compileTemplate', () => {
  it('interpolates a string variable', () => {
    const out = compileTemplate({ template: makeTemplate(), vars: { title: 'Hello' }, brand: BRAND });
    expect(out).toContain('<h1>Hello</h1>');
  });

  it('escapes HTML in user input', () => {
    const out = compileTemplate({
      template: makeTemplate(),
      vars: { title: '<script>x</script>' },
      brand: BRAND,
    });
    expect(out).toContain('&lt;script&gt;');
    expect(out).not.toContain('<script>x</script>');
  });

  it('exposes brand context', () => {
    const out = compileTemplate({
      template: makeTemplate({ bodyHtml: '<div>{{brand.name}}/{{brand.color}}</div>' }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('<div>Acme/#123456</div>');
  });

  it('interpolates css too', () => {
    const out = compileTemplate({
      template: makeTemplate({ css: 'body { background: {{brand.color}}; }' }),
      vars: {},
      brand: BRAND,
    });
    expect(out).toContain('background: #123456');
  });

  it('embeds base css + width/height', () => {
    const out = compileTemplate({ template: makeTemplate({ width: 800, height: 600 }), vars: { title: '' }, brand: BRAND });
    expect(out).toContain('@font-face');
    expect(out).toContain('width:800px');
    expect(out).toContain('height:600px');
  });

  it('throws on missing variable in strict mode', () => {
    expect(() =>
      compileTemplate({
        template: makeTemplate({ bodyHtml: '<p>{{missing}}</p>' }),
        vars: {},
        brand: BRAND,
      }),
    ).toThrow();
  });

  it('supports ifNotEmpty helper', () => {
    const t = makeTemplate({ bodyHtml: '{{#ifNotEmpty subtitle}}<p>{{subtitle}}</p>{{/ifNotEmpty}}' });
    const a = compileTemplate({ template: t, vars: { subtitle: '' }, brand: BRAND });
    const b = compileTemplate({ template: t, vars: { subtitle: 'X' }, brand: BRAND });
    expect(a).not.toContain('<p>');
    expect(b).toContain('<p>X</p>');
  });
});
```

- [ ] **Step 3: Run tests (expected FAIL)**

```bash
npm run test:unit -- visual-templates-compile
```

- [ ] **Step 4: Implémenter le compileur**

Créer `src/lib/visual-templates/compile.ts` :

```ts
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Handlebars from 'handlebars';
import type { VisualTemplate } from '@/lib/db/schema';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lecture une fois au boot. Si fichier modifié, redémarrer le worker.
const BASE_CSS = readFileSync(join(__dirname, 'base.css'), 'utf-8');

// Helpers (registrés une seule fois côté module).
Handlebars.registerHelper('escape', (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' : c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '"' ? '&quot;' : '&#39;',
  ),
);
Handlebars.registerHelper('trim', (v: unknown) => String(v ?? '').trim());
Handlebars.registerHelper('ifNotEmpty', function (this: unknown, v: unknown, opts: Handlebars.HelperOptions) {
  const s = String(v ?? '').trim();
  return s.length > 0 ? opts.fn(this) : opts.inverse(this);
});

// Cache LRU simple par (templateId, updatedAtMs, body|css) — 100 entrées max.
type CompiledTemplate = Handlebars.TemplateDelegate;
const compileCache = new Map<string, CompiledTemplate>();
const MAX_CACHE = 100;

function getCompiled(source: string, key: string): CompiledTemplate {
  const cached = compileCache.get(key);
  if (cached) return cached;
  const compiled = Handlebars.compile(source, { strict: true, noEscape: false });
  if (compileCache.size >= MAX_CACHE) {
    const firstKey = compileCache.keys().next().value;
    if (firstKey) compileCache.delete(firstKey);
  }
  compileCache.set(key, compiled);
  return compiled;
}

export type CompileInput = {
  template: VisualTemplate;
  vars: Record<string, unknown>;
  brand: { name: string; color: string; signature: string | null };
};

export function compileTemplate(input: CompileInput): string {
  const ctx = { ...input.vars, brand: input.brand };
  const updatedMs = input.template.updatedAt.getTime();
  const bodyTpl = getCompiled(input.template.bodyHtml, `${input.template.id}:${updatedMs}:body`);
  const cssTpl = getCompiled(input.template.css, `${input.template.id}:${updatedMs}:css`);
  const body = bodyTpl(ctx);
  const css = cssTpl(ctx);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>${BASE_CSS}\n${css}</style>
</head>
<body style="width:${input.template.width}px;height:${input.template.height}px">${body}</body>
</html>`;
}
```

- [ ] **Step 5: Run tests (expected PASS)**

```bash
npm run test:unit -- visual-templates-compile
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/visual-templates/base.css src/lib/visual-templates/compile.ts \
  test/unit/visual-templates-compile.test.ts
git commit -m "🤖 feat(spec-5): compileur Handlebars + base CSS + helpers"
```

---

## Task 4: Renderer Puppeteer + env stub

**Files:**
- Create: `src/lib/visual-templates/render.ts`
- Modify: `src/lib/env.ts`
- Modify: `.env.example`

- [ ] **Step 1: Étendre l'env**

Modifier `src/lib/env.ts` : ajouter dans `envSchema`, en dessous de `CONTENT_OS_AI_STUB` :

```ts
  CONTENT_OS_PUPPETEER_STUB: z.enum(['0', '1']).default('0'),
```

- [ ] **Step 2: Étendre `.env.example`**

Ajouter à la fin :

```
# Renderer
CONTENT_OS_PUPPETEER_STUB=0
```

- [ ] **Step 3: Implémenter le renderer**

Créer `src/lib/visual-templates/render.ts` :

```ts
import puppeteer, { type Browser, type Page } from 'puppeteer';
import { env } from '@/lib/env';

let browser: Browser | undefined;
let page: Page | undefined;

async function getPage(): Promise<Page> {
  if (!browser) {
    browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });
  }
  if (!page) page = await browser.newPage();
  return page;
}

export type RenderInput = {
  html: string;
  width: number;
  height: number;
};

// 1x1 transparent PNG (sentinel pour tests/CI sans Chromium).
const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

export async function renderHtmlToPng(opts: RenderInput): Promise<Buffer> {
  if (env.CONTENT_OS_PUPPETEER_STUB === '1') return STUB_PNG;

  const p = await getPage();
  await p.setViewport({ width: opts.width, height: opts.height, deviceScaleFactor: 1 });
  await p.setContent(opts.html, { waitUntil: 'networkidle0', timeout: 15_000 });
  await p.evaluate(() => (document as { fonts: FontFaceSet }).fonts.ready);
  return (await p.screenshot({
    type: 'png',
    omitBackground: false,
    clip: { x: 0, y: 0, width: opts.width, height: opts.height },
  })) as Buffer;
}

export async function closeRenderer(): Promise<void> {
  if (page) {
    try { await page.close(); } catch {}
    page = undefined;
  }
  if (browser) {
    try { await browser.close(); } catch {}
    browser = undefined;
  }
}
```

- [ ] **Step 4: Smoke test manuel**

Ajouter temporairement dans `scripts/smoke-render.ts` (ne pas commiter) :

```ts
import { writeFileSync } from 'node:fs';
import { renderHtmlToPng, closeRenderer } from '../src/lib/visual-templates/render';

async function main() {
  const html = `<!doctype html><html><body style="background:#fa0;width:200px;height:200px"></body></html>`;
  const png = await renderHtmlToPng({ html, width: 200, height: 200 });
  writeFileSync('/tmp/smoke.png', png);
  console.log('OK', png.length, 'bytes');
  await closeRenderer();
}
main();
```

Run:
```bash
tsx scripts/smoke-render.ts
```

Expected: `OK NNNN bytes`, `/tmp/smoke.png` est un carré orange 200×200. Si OK, supprimer le fichier `scripts/smoke-render.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/env.ts src/lib/visual-templates/render.ts .env.example
git commit -m "🤖 feat(spec-5): renderer Puppeteer + stub CONTENT_OS_PUPPETEER_STUB"
```

---

## Task 5: BullMQ queue + worker render-visual

**Files:**
- Modify: `src/lib/queue/client.ts`
- Modify: `src/lib/queue/enqueue.ts`
- Modify: `src/lib/queue/registry.ts`
- Modify: `src/lib/db/repositories/media.ts`
- Create: `src/worker/queues/render-visual.ts`
- Modify: `src/worker/index.ts`
- Create: `test/worker/render-visual.test.ts`

- [ ] **Step 1: Étendre le client de queue**

Modifier `src/lib/queue/client.ts` : ajouter en bas de fichier :

```ts
export type RenderVisualJob = {
  userId: string;
  templateId: string;
  vars: Record<string, unknown>;
  mode: 'preview' | 'final';
  postId?: string;
  jobKey: string;
};

export type RenderVisualResult =
  | { mode: 'preview'; previewKey: string; signedUrl: string; width: number; height: number }
  | { mode: 'final'; mediaId: string; signedUrl: string; width: number; height: number };

export const renderVisualQueue = new Queue<RenderVisualJob, RenderVisualResult>('render-visual', {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: 'fixed', delay: 5_000 },
    removeOnComplete: { age: 24 * 3600, count: 1000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});
```

- [ ] **Step 2: Étendre l'enqueue**

Modifier `src/lib/queue/enqueue.ts` :

```ts
import {
  dummyQueue,
  type GeneratePostJob,
  generatePostQueue,
  type RenderVisualJob,
  renderVisualQueue,
} from './client';

// ... (garder les exports existants enqueueDummy, enqueueGeneratePost)

export async function enqueueRenderVisual(payload: RenderVisualJob): Promise<string> {
  const job = await renderVisualQueue.add('render', payload, { jobId: payload.jobKey });
  return job.id!;
}
```

- [ ] **Step 3: Enregistrer dans le registry**

Modifier `src/lib/queue/registry.ts` :

```ts
import type { Queue } from 'bullmq';
import { dummyQueue, generatePostQueue, renderVisualQueue } from './client';

export const queueRegistry: Record<string, Queue> = {
  dummy: dummyQueue,
  'generate-post': generatePostQueue,
  'render-visual': renderVisualQueue,
};

export type QueueName = keyof typeof queueRegistry;
```

- [ ] **Step 4: Modifier `createMedia` pour accepter un id optionnel**

Dans `src/lib/db/repositories/media.ts`, remplacer la signature de `createMedia` :

```ts
export async function createMedia(
  userId: string,
  data: CreateMediaInput,
  id?: string,
): Promise<Media> {
  const finalId = id ?? createId();
  const [row] = await db
    .insert(media)
    .values({ id: finalId, userId, ...data })
    .returning();
  return row!;
}
```

(Garde-fou : changement non-breaking, les call-sites existants restent valides.)

- [ ] **Step 5: Écrire les tests du worker (TDD)**

Créer `test/worker/render-visual.test.ts` :

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Job } from 'bullmq';
import { makeProcessRenderVisual } from '@/worker/queues/render-visual';
import type { RenderVisualJob } from '@/lib/queue/client';
import { InMemoryStorage } from '@/lib/storage/in-memory';
import { createVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { createIdea } from '@/lib/db/repositories/ideas';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { upsertSettings } from '@/lib/db/repositories/settings';
import { listMedia } from '@/lib/db/repositories/media';
import { getImageAsset } from '@/lib/db/repositories/image-assets';
import { createTestUser, resetDb } from '../integration/helpers/db';

function makeJob(data: RenderVisualJob): Job<RenderVisualJob> {
  return { data } as unknown as Job<RenderVisualJob>;
}

const TEMPLATE = {
  slug: 'card',
  label: 'Card',
  platform: 'linkedin',
  width: 800,
  height: 600,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1{font-size:80px}',
  variablesSchema: [{ name: 'title', label: 'T', type: 'string', max: 50 }],
  sampleVars: { title: 'Hello' },
};

describe('processRenderVisual', () => {
  beforeEach(async () => { await resetDb(); });

  it('mode=preview: uploads to storage, returns signedUrl, no DB writes', async () => {
    const userId = await createTestUser();
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);

    const storage = new InMemoryStorage();
    const fakePng = Buffer.from('FAKE');
    const renderFn = vi.fn().mockResolvedValue(fakePng);
    const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

    const res = await handler(makeJob({
      userId,
      templateId: tmpl!.id,
      vars: { title: 'X' },
      mode: 'preview',
      jobKey: 'k1',
    }));

    expect(res.mode).toBe('preview');
    if (res.mode !== 'preview') throw new Error('narrowing');
    expect(res.previewKey).toBe(`visual-previews/${userId}/k1.png`);
    expect(await storage.exists(res.previewKey)).toBe(true);
    expect(res.signedUrl).toMatch(/^http/);
    expect((await listMedia(userId)).length).toBe(0);
  });

  it('mode=final: creates media + image_asset + updates post.mediaId', async () => {
    const userId = await createTestUser();
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);
    const idea = await createIdea(userId, { idea: 'I', brief: 'B' });
    const post = await createPost(userId, { ideaId: idea!.id, content: 'C' });

    const storage = new InMemoryStorage();
    const renderFn = vi.fn().mockResolvedValue(Buffer.from('PNG'));
    const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

    const res = await handler(makeJob({
      userId,
      templateId: tmpl!.id,
      vars: { title: 'X' },
      mode: 'final',
      postId: post.id,
      jobKey: 'k2',
    }));

    expect(res.mode).toBe('final');
    if (res.mode !== 'final') throw new Error('narrowing');
    const medias = await listMedia(userId);
    expect(medias.length).toBe(1);
    expect(medias[0].kind).toBe('image');
    expect(medias[0].width).toBe(800);
    expect(medias[0].height).toBe(600);
    const asset = await getImageAsset(userId, medias[0].id);
    expect(asset?.source).toBe('template');
    expect(asset?.templateSlug).toBe('card');
    expect(asset?.vars).toEqual({ title: 'X' });
    const refreshed = await getPost(userId, post.id);
    expect(refreshed?.mediaId).toBe(medias[0].id);
  });

  it('throws if template missing', async () => {
    const userId = await createTestUser();
    await upsertSettings(userId);
    const storage = new InMemoryStorage();
    const renderFn = vi.fn();
    const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

    await expect(
      handler(makeJob({
        userId,
        templateId: 'nope',
        vars: {},
        mode: 'preview',
        jobKey: 'k3',
      })),
    ).rejects.toThrow(/not found/);
    expect(renderFn).not.toHaveBeenCalled();
  });

  it('throws if vars invalid before any upload', async () => {
    const userId = await createTestUser();
    await upsertSettings(userId);
    const tmpl = await createVisualTemplate(userId, TEMPLATE);
    const storage = new InMemoryStorage();
    const renderFn = vi.fn();
    const handler = makeProcessRenderVisual({ storage, renderHtmlToPng: renderFn });

    await expect(
      handler(makeJob({
        userId,
        templateId: tmpl!.id,
        vars: { title: 'x'.repeat(100) }, // > max
        mode: 'preview',
        jobKey: 'k4',
      })),
    ).rejects.toThrow();
    expect(renderFn).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run tests (expected FAIL)**

```bash
npm run test:worker -- render-visual
```

- [ ] **Step 7: Implémenter le worker**

Créer `src/worker/queues/render-visual.ts` :

```ts
import type { Job } from 'bullmq';
import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getSettings } from '@/lib/db/repositories/settings';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import type { RenderVisualJob, RenderVisualResult } from '@/lib/queue/client';
import type { Storage } from '@/lib/storage';
import { compileTemplate } from '@/lib/visual-templates/compile';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

type Deps = {
  storage: Storage;
  renderHtmlToPng: (opts: { html: string; width: number; height: number }) => Promise<Buffer>;
};

export function makeProcessRenderVisual(deps: Deps) {
  return async function processRenderVisual(
    job: Job<RenderVisualJob>,
  ): Promise<RenderVisualResult> {
    const { userId, templateId, vars, mode, postId, jobKey } = job.data;

    const template = await getVisualTemplate(userId, templateId);
    if (!template) {
      throw new Error(`VisualTemplate ${templateId} not found for user ${userId}`);
    }

    const settings = await getSettings(userId);
    const brand = {
      name: settings?.brandName ?? '',
      color: settings?.brandColor ?? '#000000',
      signature: settings?.brandSignature && settings.brandSignature.length > 0
        ? settings.brandSignature
        : null,
    };

    const schema = parseVariablesSchema(template.variablesSchema);
    const validated = variablesSchemaToZod(schema).parse(vars) as Record<string, unknown>;

    const html = compileTemplate({ template, vars: validated, brand });
    const png = await deps.renderHtmlToPng({
      html,
      width: template.width,
      height: template.height,
    });

    if (mode === 'preview') {
      const key = `visual-previews/${userId}/${jobKey}.png`;
      await deps.storage.upload({ key, body: png, contentType: 'image/png' });
      const signedUrl = await deps.storage.signedUrl({ key, expiresInSeconds: 3600 });
      return {
        mode: 'preview',
        previewKey: key,
        signedUrl,
        width: template.width,
        height: template.height,
      };
    }

    // mode === 'final'
    if (!postId) throw new Error('postId required for mode=final');
    const post = await getPost(userId, postId);
    if (!post) throw new Error(`Post ${postId} not found for user ${userId}`);

    const mediaId = createId();
    const assetKey = `media/${userId}/${mediaId}.png`;
    await deps.storage.upload({ key: assetKey, body: png, contentType: 'image/png' });

    await createMedia(
      userId,
      {
        kind: 'image',
        assetKey,
        previewKey: assetKey,
        width: template.width,
        height: template.height,
      },
      mediaId,
    );
    await createImageAsset(userId, {
      mediaId,
      source: 'template',
      templateSlug: template.slug,
      vars: validated,
    });
    await updatePost(userId, postId, { mediaId });

    const signedUrl = await deps.storage.signedUrl({ key: assetKey, expiresInSeconds: 3600 });
    return {
      mode: 'final',
      mediaId,
      signedUrl,
      width: template.width,
      height: template.height,
    };
  };
}
```

- [ ] **Step 8: Run tests (expected PASS)**

```bash
npm run test:worker -- render-visual
```

- [ ] **Step 9: Enregistrer le worker dans `src/worker/index.ts`**

Modifier `src/worker/index.ts` :

```ts
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { generate, generateStub } from '@/lib/ai/generate-post';
import { env } from '@/lib/env';
import { getStorage } from '@/lib/storage';
import { closeRenderer, renderHtmlToPng } from '@/lib/visual-templates/render';
import { processDummy } from './queues/dummy';
import { makeProcessGeneratePost } from './queues/generate-post';
import { makeProcessRenderVisual } from './queues/render-visual';

const connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });

const generateFn = env.CONTENT_OS_AI_STUB === '1' ? generateStub : generate;
if (env.CONTENT_OS_AI_STUB === '1') {
  console.log('[worker] CONTENT_OS_AI_STUB=1 active : Claude NOT called.');
}

const workers = [
  new Worker('dummy', processDummy, { connection, concurrency: 4 }),
  new Worker('generate-post', makeProcessGeneratePost({ generate: generateFn }), {
    connection,
    concurrency: 4,
  }),
  new Worker(
    'render-visual',
    makeProcessRenderVisual({ storage: getStorage(), renderHtmlToPng }),
    { connection, concurrency: 2 },
  ),
];

console.log(`[worker] ${workers.length} consumer(s) ready`);

async function shutdown(signal: string): Promise<void> {
  console.log(`[worker] ${signal} received, closing...`);
  await Promise.all(workers.map((w) => w.close()));
  await closeRenderer();
  await connection.quit();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
```

- [ ] **Step 10: Commit**

```bash
git add src/lib/queue/client.ts src/lib/queue/enqueue.ts src/lib/queue/registry.ts \
  src/lib/db/repositories/media.ts src/worker/queues/render-visual.ts \
  src/worker/index.ts test/worker/render-visual.test.ts

git commit -m "🤖 feat(spec-5): queue render-visual + worker (modes preview/final)"
```

---

## Task 6: Back-office CRUD — pages list, new, edit

**Files:**
- Create: `src/app/(app)/settings/visual-templates/page.tsx`
- Create: `src/app/(app)/settings/visual-templates/visual-template-form.tsx`
- Create: `src/app/(app)/settings/visual-templates/variables-schema-editor.tsx`
- Create: `src/app/(app)/settings/visual-templates/new/{page.tsx,actions.ts,actions-core.ts}`
- Create: `src/app/(app)/settings/visual-templates/[id]/{page.tsx,actions.ts,actions-core.ts,danger-zone.tsx}`
- Create: `test/integration/visual-template-create-action.test.ts`
- Create: `test/integration/visual-template-edit-action.test.ts`

- [ ] **Step 1: VariablesSchemaEditor (Client Component)**

Créer `src/app/(app)/settings/visual-templates/variables-schema-editor.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

type Props = {
  /** Nom du hidden input qui sera POSTé avec la valeur JSON. */
  name: string;
  initial?: VariableSpec[];
};

const EMPTY: VariableSpec = { name: '', label: '', type: 'string', max: 100 };

export function VariablesSchemaEditor({ name, initial }: Props) {
  const [items, setItems] = useState<VariableSpec[]>(initial ?? []);

  const update = (i: number, patch: Partial<VariableSpec>) => {
    setItems((arr) => arr.map((v, idx) => (idx === i ? { ...v, ...patch } : v)));
  };
  const remove = (i: number) => setItems((arr) => arr.filter((_, idx) => idx !== i));
  const add = () => setItems((arr) => [...arr, { ...EMPTY }]);

  return (
    <div className="space-y-3">
      <input type="hidden" name={name} value={JSON.stringify(items)} />
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Aucune variable. Clique sur + pour ajouter.</p>
      )}
      {items.map((v, i) => (
        <div key={i} className="border rounded p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Name (identifiant Handlebars)</Label>
              <Input
                value={v.name}
                onChange={(e) => update(i, { name: e.target.value })}
                pattern="^[a-zA-Z_][a-zA-Z0-9_]*$"
              />
            </div>
            <div>
              <Label>Label (UI)</Label>
              <Input value={v.label} onChange={(e) => update(i, { label: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Description (optionnel)</Label>
            <Textarea
              value={v.description ?? ''}
              onChange={(e) => update(i, { description: e.target.value || undefined })}
              rows={2}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Min</Label>
              <Input
                type="number"
                value={v.min ?? ''}
                onChange={(e) =>
                  update(i, { min: e.target.value === '' ? undefined : Number(e.target.value) })
                }
              />
            </div>
            <div>
              <Label>Max</Label>
              <Input
                type="number"
                value={v.max}
                onChange={(e) => update(i, { max: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2">
              <label className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={v.optional ?? false}
                  onChange={(e) => update(i, { optional: e.target.checked })}
                />
                optional
              </label>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(i)}>
              Supprimer
            </Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={add}>
        + Ajouter une variable
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: VisualTemplateForm (Client Component partagé)**

Créer `src/app/(app)/settings/visual-templates/visual-template-form.tsx` :

```tsx
'use client';

import { useActionState, useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { VariablesSchemaEditor } from './variables-schema-editor';

export type VisualTemplateActionState =
  | { status: 'idle' }
  | { status: 'success' }
  | { status: 'error'; message: string; fieldErrors?: Record<string, string> };

type Initial = {
  label: string;
  slug: string;
  platform: string;
  width: number;
  height: number;
  bodyHtml: string;
  css: string;
  variablesSchema: VariableSpec[];
  sampleVars: string; // JSON brut
};

const EMPTY_INITIAL: Initial = {
  label: '',
  slug: '',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { font-size: 80px; }',
  variablesSchema: [],
  sampleVars: '{}',
};

function SubmitButton({ mode }: { mode: 'create' | 'edit' }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? 'Enregistrement…' : mode === 'create' ? 'Créer' : 'Enregistrer'}
    </Button>
  );
}

export function VisualTemplateForm({
  mode,
  initial,
  action,
  successMessage,
}: {
  mode: 'create' | 'edit';
  initial?: Initial;
  action: (
    prev: VisualTemplateActionState,
    formData: FormData,
  ) => Promise<VisualTemplateActionState>;
  successMessage: string;
}) {
  const values = initial ?? EMPTY_INITIAL;
  const [state, formAction] = useActionState<VisualTemplateActionState, FormData>(action, {
    status: 'idle',
  });

  useEffect(() => {
    if (state.status === 'success') toast.success(successMessage);
    else if (state.status === 'error') {
      if (state.message === 'duplicate-slug') toast.error('Slug déjà utilisé');
      else if (state.message === 'validation') toast.error('Champs invalides');
      else toast.error(state.message);
    }
  }, [state, successMessage]);

  const fieldErrors = state.status === 'error' ? state.fieldErrors : undefined;

  return (
    <form key={JSON.stringify(values)} action={formAction} className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="label">Nom</Label>
          <Input id="label" name="label" defaultValue={values.label} maxLength={100} />
          {fieldErrors?.label && <p className="text-sm text-red-600">{fieldErrors.label}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="slug">Slug</Label>
          <Input
            id="slug"
            name="slug"
            defaultValue={values.slug}
            maxLength={60}
            pattern="^[a-z0-9-]+$"
          />
          {fieldErrors?.slug && <p className="text-sm text-red-600">{fieldErrors.slug}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="platform">Plateforme</Label>
          <Input id="platform" name="platform" defaultValue={values.platform} readOnly />
        </div>
        <div className="space-y-2">
          <Label htmlFor="width">Width (px)</Label>
          <Input id="width" name="width" type="number" min={1} max={10000} defaultValue={values.width} />
          {fieldErrors?.width && <p className="text-sm text-red-600">{fieldErrors.width}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Height (px)</Label>
          <Input id="height" name="height" type="number" min={1} max={10000} defaultValue={values.height} />
          {fieldErrors?.height && <p className="text-sm text-red-600">{fieldErrors.height}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="bodyHtml">HTML (Handlebars)</Label>
        <Textarea
          id="bodyHtml"
          name="bodyHtml"
          defaultValue={values.bodyHtml}
          rows={10}
          className="font-mono text-sm"
        />
        {fieldErrors?.bodyHtml && <p className="text-sm text-red-600">{fieldErrors.bodyHtml}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="css">CSS</Label>
        <Textarea
          id="css"
          name="css"
          defaultValue={values.css}
          rows={10}
          className="font-mono text-sm"
        />
        {fieldErrors?.css && <p className="text-sm text-red-600">{fieldErrors.css}</p>}
      </div>

      <div className="space-y-2">
        <Label>Variables</Label>
        <VariablesSchemaEditor name="variablesSchema" initial={values.variablesSchema} />
        {fieldErrors?.variablesSchema && (
          <p className="text-sm text-red-600">{fieldErrors.variablesSchema}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="sampleVars">Sample vars (JSON, sert au preview)</Label>
        <Textarea
          id="sampleVars"
          name="sampleVars"
          defaultValue={values.sampleVars}
          rows={5}
          className="font-mono text-sm"
        />
        {fieldErrors?.sampleVars && <p className="text-sm text-red-600">{fieldErrors.sampleVars}</p>}
      </div>

      <SubmitButton mode={mode} />
    </form>
  );
}
```

- [ ] **Step 3: Page liste**

Créer `src/app/(app)/settings/visual-templates/page.tsx` :

```tsx
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { requireUserId } from '@/lib/auth/session';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';

export default async function VisualTemplatesListPage() {
  const userId = await requireUserId();
  const templates = await listVisualTemplates(userId);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Templates visuels</h2>
          <p className="text-sm text-neutral-600">HTML+CSS+variables pour générer des visuels.</p>
        </div>
        <Button nativeButton={false} render={<Link href="/settings/visual-templates/new" />}>
          + Nouveau
        </Button>
      </header>

      {templates.length === 0 ? (
        <p className="text-sm text-neutral-600">Aucun template pour le moment.</p>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/settings/visual-templates/${t.id}`} className="block">
                <Card className="p-4 hover:bg-neutral-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.label}</p>
                      <p className="text-xs text-neutral-500">
                        {t.platform} · {t.slug} · {t.width}×{t.height}
                      </p>
                    </div>
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 4: actions-core (create)**

Créer `src/app/(app)/settings/visual-templates/new/actions-core.ts` :

```ts
import Handlebars from 'handlebars';
import { z } from 'zod';
import { createVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';
import type { VisualTemplateActionState } from '../visual-template-form';

const baseSchema = z.object({
  label: z.string().trim().min(1).max(100),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  width: z.coerce.number().int().min(1).max(10_000),
  height: z.coerce.number().int().min(1).max(10_000),
  bodyHtml: z.string().min(1).max(50_000),
  css: z.string().max(50_000),
  variablesSchemaRaw: z.string(),
  sampleVarsRaw: z.string(),
});

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(raw) }; } catch { return { ok: false }; }
}

export async function createVisualTemplateCore(
  userId: string,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const raw = {
    label: String(formData.get('label') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    width: String(formData.get('width') ?? ''),
    height: String(formData.get('height') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
    css: String(formData.get('css') ?? ''),
    variablesSchemaRaw: String(formData.get('variablesSchema') ?? '[]'),
    sampleVarsRaw: String(formData.get('sampleVars') ?? '{}'),
  };

  const base = baseSchema.safeParse(raw);
  if (!base.success) {
    const fe: Record<string, string> = {};
    for (const issue of base.error.issues) {
      const k = String(issue.path[0] ?? '');
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors: fe };
  }

  if (raw.css.includes('<') || raw.css.toLowerCase().includes('</style>')) {
    return {
      status: 'error',
      message: 'validation',
      fieldErrors: { css: 'Le CSS ne doit pas contenir < ni </style>.' },
    };
  }

  const parsedSchema = tryParseJson(base.data.variablesSchemaRaw);
  if (!parsedSchema.ok) {
    return { status: 'error', message: 'validation', fieldErrors: { variablesSchema: 'JSON invalide.' } };
  }
  let schema;
  try {
    schema = parseVariablesSchema(parsedSchema.value);
  } catch (e) {
    return {
      status: 'error',
      message: 'validation',
      fieldErrors: { variablesSchema: (e as Error).message },
    };
  }

  const parsedSample = tryParseJson(base.data.sampleVarsRaw);
  if (!parsedSample.ok) {
    return { status: 'error', message: 'validation', fieldErrors: { sampleVars: 'JSON invalide.' } };
  }
  try {
    variablesSchemaToZod(schema).parse(parsedSample.value);
  } catch (e) {
    return {
      status: 'error',
      message: 'validation',
      fieldErrors: { sampleVars: 'Ne respecte pas le schéma : ' + (e as Error).message },
    };
  }

  try {
    Handlebars.compile(base.data.bodyHtml, { strict: true });
  } catch (e) {
    return { status: 'error', message: 'validation', fieldErrors: { bodyHtml: (e as Error).message } };
  }
  try {
    Handlebars.compile(base.data.css, { strict: true });
  } catch (e) {
    return { status: 'error', message: 'validation', fieldErrors: { css: (e as Error).message } };
  }

  const created = await createVisualTemplate(userId, {
    slug: base.data.slug,
    label: base.data.label,
    platform: base.data.platform,
    width: base.data.width,
    height: base.data.height,
    bodyHtml: base.data.bodyHtml,
    css: base.data.css,
    variablesSchema: schema,
    sampleVars: parsedSample.value,
  });

  if (!created) {
    return { status: 'error', message: 'duplicate-slug', fieldErrors: { slug: 'Slug déjà utilisé.' } };
  }
  return { status: 'success' };
}
```

- [ ] **Step 5: actions wrapper (create)**

Créer `src/app/(app)/settings/visual-templates/new/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import type { VisualTemplateActionState } from '../visual-template-form';
import { createVisualTemplateCore } from './actions-core';

export async function createVisualTemplateAction(
  _prev: VisualTemplateActionState,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const userId = await requireUserId();
  const result = await createVisualTemplateCore(userId, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-templates');
    redirect('/settings/visual-templates');
  }
  return result;
}
```

- [ ] **Step 6: Page new**

Créer `src/app/(app)/settings/visual-templates/new/page.tsx` :

```tsx
import { requireUserId } from '@/lib/auth/session';
import { VisualTemplateForm } from '../visual-template-form';
import { createVisualTemplateAction } from './actions';

export default async function NewVisualTemplatePage() {
  await requireUserId();
  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-semibold">Nouveau template visuel</h2>
      </header>
      <VisualTemplateForm
        mode="create"
        action={createVisualTemplateAction}
        successMessage="Template créé"
      />
    </div>
  );
}
```

- [ ] **Step 7: actions-core (edit + delete)**

Créer `src/app/(app)/settings/visual-templates/[id]/actions-core.ts` :

```ts
import Handlebars from 'handlebars';
import { z } from 'zod';
import { db } from '@/lib/db/client';
import { eq } from 'drizzle-orm';
import { imageAssets } from '@/lib/db/schema';
import {
  deleteVisualTemplate,
  getVisualTemplate,
  updateVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';
import type { VisualTemplateActionState } from '../visual-template-form';

// Réutilise la même validation que la création (DRY : extract un helper plus tard).
const baseSchema = z.object({
  label: z.string().trim().min(1).max(100),
  slug: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/),
  platform: z.enum(['linkedin']),
  width: z.coerce.number().int().min(1).max(10_000),
  height: z.coerce.number().int().min(1).max(10_000),
  bodyHtml: z.string().min(1).max(50_000),
  css: z.string().max(50_000),
  variablesSchemaRaw: z.string(),
  sampleVarsRaw: z.string(),
});

function tryParseJson(raw: string): { ok: true; value: unknown } | { ok: false } {
  try { return { ok: true, value: JSON.parse(raw) }; } catch { return { ok: false }; }
}

export async function updateVisualTemplateCore(
  userId: string,
  id: string,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const existing = await getVisualTemplate(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  const raw = {
    label: String(formData.get('label') ?? ''),
    slug: String(formData.get('slug') ?? ''),
    platform: String(formData.get('platform') ?? ''),
    width: String(formData.get('width') ?? ''),
    height: String(formData.get('height') ?? ''),
    bodyHtml: String(formData.get('bodyHtml') ?? ''),
    css: String(formData.get('css') ?? ''),
    variablesSchemaRaw: String(formData.get('variablesSchema') ?? '[]'),
    sampleVarsRaw: String(formData.get('sampleVars') ?? '{}'),
  };

  const base = baseSchema.safeParse(raw);
  if (!base.success) {
    const fe: Record<string, string> = {};
    for (const issue of base.error.issues) {
      const k = String(issue.path[0] ?? '');
      if (k && !fe[k]) fe[k] = issue.message;
    }
    return { status: 'error', message: 'validation', fieldErrors: fe };
  }

  if (raw.css.includes('<') || raw.css.toLowerCase().includes('</style>')) {
    return { status: 'error', message: 'validation', fieldErrors: { css: 'CSS contient < ou </style>.' } };
  }

  const parsedSchema = tryParseJson(base.data.variablesSchemaRaw);
  if (!parsedSchema.ok) {
    return { status: 'error', message: 'validation', fieldErrors: { variablesSchema: 'JSON invalide.' } };
  }
  let schema;
  try { schema = parseVariablesSchema(parsedSchema.value); }
  catch (e) {
    return { status: 'error', message: 'validation', fieldErrors: { variablesSchema: (e as Error).message } };
  }

  const parsedSample = tryParseJson(base.data.sampleVarsRaw);
  if (!parsedSample.ok) {
    return { status: 'error', message: 'validation', fieldErrors: { sampleVars: 'JSON invalide.' } };
  }
  try { variablesSchemaToZod(schema).parse(parsedSample.value); }
  catch (e) {
    return { status: 'error', message: 'validation', fieldErrors: { sampleVars: (e as Error).message } };
  }

  try { Handlebars.compile(base.data.bodyHtml, { strict: true }); }
  catch (e) { return { status: 'error', message: 'validation', fieldErrors: { bodyHtml: (e as Error).message } }; }
  try { Handlebars.compile(base.data.css, { strict: true }); }
  catch (e) { return { status: 'error', message: 'validation', fieldErrors: { css: (e as Error).message } }; }

  const updated = await updateVisualTemplate(userId, id, {
    slug: base.data.slug,
    label: base.data.label,
    platform: base.data.platform,
    width: base.data.width,
    height: base.data.height,
    bodyHtml: base.data.bodyHtml,
    css: base.data.css,
    variablesSchema: schema,
    sampleVars: parsedSample.value,
  });

  if (!updated) return { status: 'error', message: 'not-found' };
  return { status: 'success' };
}

export async function deleteVisualTemplateCore(
  userId: string,
  id: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string; refCount?: number }> {
  const existing = await getVisualTemplate(userId, id);
  if (!existing) return { status: 'error', message: 'not-found' };

  // Bloquer si image_assets référence ce slug.
  const refs = await db
    .select({ slug: imageAssets.templateSlug })
    .from(imageAssets)
    .where(eq(imageAssets.templateSlug, existing.slug));
  if (refs.length > 0) {
    return {
      status: 'error',
      message: `${refs.length} visuels référencent ce template. Détache-les avant de supprimer.`,
      refCount: refs.length,
    };
  }

  await deleteVisualTemplate(userId, id);
  return { status: 'success' };
}
```

- [ ] **Step 8: actions wrappers (edit + delete)**

Créer `src/app/(app)/settings/visual-templates/[id]/actions.ts` :

```ts
'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import type { VisualTemplateActionState } from '../visual-template-form';
import { deleteVisualTemplateCore, updateVisualTemplateCore } from './actions-core';

export async function updateVisualTemplateAction(
  id: string,
  _prev: VisualTemplateActionState,
  formData: FormData,
): Promise<VisualTemplateActionState> {
  const userId = await requireUserId();
  const result = await updateVisualTemplateCore(userId, id, formData);
  if (result.status === 'success') {
    revalidatePath('/settings/visual-templates');
    revalidatePath(`/settings/visual-templates/${id}`);
  }
  return result;
}

export async function deleteVisualTemplateAction(id: string): Promise<void> {
  const userId = await requireUserId();
  const result = await deleteVisualTemplateCore(userId, id);
  if (result.status === 'error') throw new Error(result.message);
  revalidatePath('/settings/visual-templates');
  redirect('/settings/visual-templates');
}
```

- [ ] **Step 9: danger-zone**

Créer `src/app/(app)/settings/visual-templates/[id]/danger-zone.tsx` :

```tsx
'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { deleteVisualTemplateAction } from './actions';

export function DangerZone({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const onConfirm = () => {
    start(async () => {
      try {
        await deleteVisualTemplateAction(id);
      } catch (e) {
        toast.error((e as Error).message);
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Supprimer ce template</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Supprimer "{label}" ?</DialogTitle>
          <DialogDescription>
            Cette action est irréversible. Les visuels déjà générés depuis ce template restent
            mais ne pourront plus être ré-édités depuis le template.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
            Annuler
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 10: Page edit**

Créer `src/app/(app)/settings/visual-templates/[id]/page.tsx` :

```tsx
import { notFound } from 'next/navigation';
import { requireUserId } from '@/lib/auth/session';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { VisualTemplateForm, type VisualTemplateActionState } from '../visual-template-form';
import { updateVisualTemplateAction } from './actions';
import { DangerZone } from './danger-zone';

export default async function EditVisualTemplatePage({
  params,
}: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, id);
  if (!t) notFound();

  const boundAction = async (
    prev: VisualTemplateActionState,
    formData: FormData,
  ): Promise<VisualTemplateActionState> => {
    'use server';
    return updateVisualTemplateAction(id, prev, formData);
  };

  return (
    <div className="space-y-8">
      <header>
        <h2 className="text-2xl font-semibold">{t.label}</h2>
        <p className="text-xs text-muted-foreground">
          {t.platform} · {t.slug} · {t.width}×{t.height}
        </p>
      </header>
      <VisualTemplateForm
        mode="edit"
        initial={{
          label: t.label,
          slug: t.slug,
          platform: t.platform,
          width: t.width,
          height: t.height,
          bodyHtml: t.bodyHtml,
          css: t.css,
          variablesSchema: t.variablesSchema as VariableSpec[],
          sampleVars: JSON.stringify(t.sampleVars, null, 2),
        }}
        action={boundAction}
        successMessage="Template enregistré"
      />
      <hr />
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Zone dangereuse</h3>
        <DangerZone id={t.id} label={t.label} />
      </div>
    </div>
  );
}
```

- [ ] **Step 11: Tests integration des actions**

Créer `test/integration/visual-template-create-action.test.ts` :

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createVisualTemplateCore } from '@/app/(app)/settings/visual-templates/new/actions-core';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';
import { createTestUser, resetDb } from './helpers/db';

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const VALID = {
  label: 'Card',
  slug: 'card',
  platform: 'linkedin',
  width: '800',
  height: '600',
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1 { color: red; }',
  variablesSchema: JSON.stringify([{ name: 'title', label: 'T', type: 'string', max: 50 }]),
  sampleVars: JSON.stringify({ title: 'Hello' }),
};

describe('createVisualTemplateCore', () => {
  beforeEach(async () => { await resetDb(); });

  it('creates a valid template', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r.status).toBe('success');
    expect((await listVisualTemplates(userId))).toHaveLength(1);
  });

  it('rejects invalid slug', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, slug: 'Bad Slug!' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.slug).toBeDefined();
  });

  it('rejects invalid JSON variablesSchema', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, variablesSchema: 'not json' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.variablesSchema).toBe('JSON invalide.');
  });

  it('rejects sample vars not matching schema', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm({
      ...VALID,
      sampleVars: JSON.stringify({ title: 'x'.repeat(100) }),
    }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.sampleVars).toBeDefined();
  });

  it('rejects broken Handlebars in bodyHtml', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm({
      ...VALID,
      bodyHtml: '<h1>{{ unclosed',
    }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.bodyHtml).toBeDefined();
  });

  it('rejects css with < or </style>', async () => {
    const userId = await createTestUser();
    const r = await createVisualTemplateCore(userId, makeForm({ ...VALID, css: 'a < b' }));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.fieldErrors?.css).toBeDefined();
  });

  it('rejects duplicate slug for same user', async () => {
    const userId = await createTestUser();
    const r1 = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r1.status).toBe('success');
    const r2 = await createVisualTemplateCore(userId, makeForm(VALID));
    expect(r2.status).toBe('error');
    if (r2.status !== 'error') throw new Error();
    expect(r2.message).toBe('duplicate-slug');
  });
});
```

Créer `test/integration/visual-template-edit-action.test.ts` :

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import {
  deleteVisualTemplateCore,
  updateVisualTemplateCore,
} from '@/app/(app)/settings/visual-templates/[id]/actions-core';
import {
  createVisualTemplate,
  getVisualTemplate,
} from '@/lib/db/repositories/visual-templates';
import { createMedia } from '@/lib/db/repositories/media';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createTestUser, resetDb } from './helpers/db';

const TEMPLATE = {
  slug: 'card',
  label: 'Card',
  platform: 'linkedin',
  width: 800,
  height: 600,
  bodyHtml: '<h1>{{title}}</h1>',
  css: 'h1{color:red}',
  variablesSchema: [{ name: 'title', label: 'T', type: 'string', max: 50 }],
  sampleVars: { title: 'Hello' },
};

function makeForm(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

const FORM = {
  label: 'Updated',
  slug: 'card',
  platform: 'linkedin',
  width: '900',
  height: '700',
  bodyHtml: '<h2>{{title}}</h2>',
  css: 'h2{color:blue}',
  variablesSchema: JSON.stringify(TEMPLATE.variablesSchema),
  sampleVars: JSON.stringify(TEMPLATE.sampleVars),
};

describe('updateVisualTemplateCore', () => {
  beforeEach(async () => { await resetDb(); });

  it('updates fields', async () => {
    const userId = await createTestUser();
    const t = await createVisualTemplate(userId, TEMPLATE);
    const r = await updateVisualTemplateCore(userId, t!.id, makeForm(FORM));
    expect(r.status).toBe('success');
    const refreshed = await getVisualTemplate(userId, t!.id);
    expect(refreshed?.label).toBe('Updated');
    expect(refreshed?.width).toBe(900);
  });

  it('returns not-found if id belongs to another user', async () => {
    const a = await createTestUser();
    const b = await createTestUser();
    const t = await createVisualTemplate(a, TEMPLATE);
    const r = await updateVisualTemplateCore(b, t!.id, makeForm(FORM));
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.message).toBe('not-found');
  });
});

describe('deleteVisualTemplateCore', () => {
  beforeEach(async () => { await resetDb(); });

  it('deletes when no references', async () => {
    const userId = await createTestUser();
    const t = await createVisualTemplate(userId, TEMPLATE);
    const r = await deleteVisualTemplateCore(userId, t!.id);
    expect(r.status).toBe('success');
    expect(await getVisualTemplate(userId, t!.id)).toBeUndefined();
  });

  it('refuses to delete when image_assets reference the slug', async () => {
    const userId = await createTestUser();
    const t = await createVisualTemplate(userId, TEMPLATE);
    const m = await createMedia(userId, {
      kind: 'image', assetKey: 'k', previewKey: 'k', width: 1, height: 1,
    });
    await createImageAsset(userId, {
      mediaId: m.id, source: 'template', templateSlug: t!.slug,
    });
    const r = await deleteVisualTemplateCore(userId, t!.id);
    expect(r.status).toBe('error');
    if (r.status !== 'error') throw new Error();
    expect(r.message).toMatch(/référencent/);
    expect(await getVisualTemplate(userId, t!.id)).toBeDefined();
  });
});
```

- [ ] **Step 12: Run integration tests**

```bash
npm run test:integration -- visual-template-create-action
npm run test:integration -- visual-template-edit-action
```

Expected: tous verts.

- [ ] **Step 13: Commit**

```bash
git add src/app/\(app\)/settings/visual-templates \
  test/integration/visual-template-create-action.test.ts \
  test/integration/visual-template-edit-action.test.ts

git commit -m "🤖 feat(spec-5): back-office CRUD /settings/visual-templates + tests"
```

---

## Task 7: Back-office — preview panel

**Files:**
- Create: `src/app/(app)/settings/visual-templates/[id]/preview-actions.ts`
- Create: `src/app/(app)/settings/visual-templates/preview-panel.tsx`
- Modify: `src/app/(app)/settings/visual-templates/[id]/page.tsx`

- [ ] **Step 1: Preview action**

Créer `src/app/(app)/settings/visual-templates/[id]/preview-actions.ts` :

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { requireUserId } from '@/lib/auth/session';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { enqueueRenderVisual } from '@/lib/queue/enqueue';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

export async function enqueuePreviewAction(input: {
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, input.templateId);
  if (!t) return { status: 'error', message: 'Template introuvable' };

  // Validation côté serveur en plus du client (defense in depth).
  try {
    const schema = parseVariablesSchema(t.variablesSchema);
    variablesSchemaToZod(schema).parse(input.vars);
  } catch (e) {
    return { status: 'error', message: 'Vars invalides : ' + (e as Error).message };
  }

  const jobKey = randomUUID();
  await enqueueRenderVisual({
    userId,
    templateId: t.id,
    vars: input.vars,
    mode: 'preview',
    jobKey,
  });
  return { status: 'success', jobKey };
}
```

- [ ] **Step 2: PreviewPanel component**

Créer `src/app/(app)/settings/visual-templates/preview-panel.tsx` :

```tsx
'use client';

import Image from 'next/image';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useJobPolling } from '@/hooks/use-job-polling';
import { enqueuePreviewAction } from './[id]/preview-actions';

type Props = {
  templateId: string;
  sampleVars: Record<string, unknown>;
  width: number;
  height: number;
};

export function PreviewPanel({ templateId, sampleVars, width, height }: Props) {
  const [jobKey, setJobKey] = useState<string | null>(null);
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [enqueuing, start] = useTransition();

  useJobPolling(jobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: (result) => {
      if (
        result && typeof result === 'object' && 'signedUrl' in result &&
        typeof (result as { signedUrl: unknown }).signedUrl === 'string'
      ) {
        setImgUrl((result as { signedUrl: string }).signedUrl);
      }
      setJobKey(null);
    },
  });

  const onPreview = () => {
    setImgUrl(null);
    start(async () => {
      const r = await enqueuePreviewAction({ templateId, vars: sampleVars });
      if (r.status === 'error') toast.error(r.message);
      else setJobKey(r.jobKey);
    });
  };

  const isLoading = enqueuing || jobKey !== null;

  return (
    <div className="space-y-3">
      <Button onClick={onPreview} disabled={isLoading} variant="outline">
        {isLoading ? 'Génération…' : 'Prévisualiser avec sample_vars'}
      </Button>
      {imgUrl && (
        <div className="border rounded p-2 bg-neutral-50">
          <Image
            src={imgUrl}
            alt="Preview"
            width={width}
            height={height}
            unoptimized
            className="w-full h-auto"
          />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire PreviewPanel dans la page edit**

Modifier `src/app/(app)/settings/visual-templates/[id]/page.tsx` : ajouter l'import et insérer `<PreviewPanel>` après le `<VisualTemplateForm>` (avant la danger zone) :

```tsx
import { PreviewPanel } from '../preview-panel';
// ... (rest of imports)

// après le VisualTemplateForm :
      <hr />
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Aperçu</h3>
        <PreviewPanel
          templateId={t.id}
          sampleVars={t.sampleVars as Record<string, unknown>}
          width={t.width}
          height={t.height}
        />
      </section>
      <hr />
      {/* DangerZone existant */}
```

- [ ] **Step 4: Smoke test manuel**

```bash
# Terminal 1
npm run dev
# Terminal 2
npm run worker
```

Ouvrir le navigateur, créer un template simple, l'éditer, cliquer "Prévisualiser". Vérifier qu'une image PNG apparaît après ~1-2s.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(app\)/settings/visual-templates/\[id\]/preview-actions.ts \
  src/app/\(app\)/settings/visual-templates/preview-panel.tsx \
  src/app/\(app\)/settings/visual-templates/\[id\]/page.tsx

git commit -m "🤖 feat(spec-5): preview panel back-office (queue render-visual mode=preview)"
```

---

## Task 8: Post media picker — dialog + attach

**Files:**
- Create: `src/app/(app)/posts/[id]/media-actions.ts`
- Create: `src/app/(app)/posts/[id]/_components/variables-form.tsx`
- Create: `src/app/(app)/posts/[id]/_components/visual-display.tsx`
- Create: `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx`
- Modify: `src/app/(app)/posts/[id]/_components/post-editor.tsx`
- Modify: `src/app/(app)/posts/[id]/page.tsx`

- [ ] **Step 1: media-actions (preview, final, detach)**

Créer `src/app/(app)/posts/[id]/media-actions.ts` :

```ts
'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { enqueueRenderVisual } from '@/lib/queue/enqueue';
import { getStorage } from '@/lib/storage';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';

export async function enqueuePostPreviewAction(input: {
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, input.templateId);
  if (!t) return { status: 'error', message: 'Template introuvable' };
  try {
    variablesSchemaToZod(parseVariablesSchema(t.variablesSchema)).parse(input.vars);
  } catch (e) {
    return { status: 'error', message: 'Vars invalides : ' + (e as Error).message };
  }
  const jobKey = randomUUID();
  await enqueueRenderVisual({
    userId, templateId: t.id, vars: input.vars, mode: 'preview', jobKey,
  });
  return { status: 'success', jobKey };
}

export async function enqueuePostFinalAction(input: {
  postId: string;
  templateId: string;
  vars: Record<string, unknown>;
}): Promise<{ status: 'success'; jobKey: string } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const t = await getVisualTemplate(userId, input.templateId);
  if (!t) return { status: 'error', message: 'Template introuvable' };
  const post = await getPost(userId, input.postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  try {
    variablesSchemaToZod(parseVariablesSchema(t.variablesSchema)).parse(input.vars);
  } catch (e) {
    return { status: 'error', message: 'Vars invalides : ' + (e as Error).message };
  }
  const jobKey = randomUUID();
  await enqueueRenderVisual({
    userId, templateId: t.id, vars: input.vars, mode: 'final', postId: post.id, jobKey,
  });
  return { status: 'success', jobKey };
}

export async function detachMediaAction(
  postId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const post = await getPost(userId, postId);
  if (!post) return { status: 'error', message: 'Post introuvable' };
  await updatePost(userId, postId, { mediaId: null });
  revalidatePath(`/posts/${postId}`);
  return { status: 'success' };
}

export async function getMediaSignedUrl(
  mediaId: string,
): Promise<{ url: string; width: number; height: number } | null> {
  const userId = await requireUserId();
  const m = await getMedia(userId, mediaId);
  if (!m) return null;
  const url = await getStorage().signedUrl({ key: m.assetKey, expiresInSeconds: 3600 });
  return { url, width: m.width, height: m.height };
}
```

- [ ] **Step 2: VariablesForm (auto-generated from DSL)**

Créer `src/app/(app)/posts/[id]/_components/variables-form.tsx` :

```tsx
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { VariableSpec } from '@/lib/visual-templates/dsl';

type Props = {
  schema: VariableSpec[];
  initial: Record<string, unknown>;
  onChange: (vars: Record<string, unknown>) => void;
};

export function VariablesForm({ schema, initial, onChange }: Props) {
  const [vars, setVars] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {};
    for (const v of schema) seed[v.name] = String(initial[v.name] ?? '');
    return seed;
  });

  const update = (name: string, value: string) => {
    const next = { ...vars, [name]: value };
    setVars(next);
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {schema.map((v) => {
        const isLong = v.max > 80;
        return (
          <div key={v.name} className="space-y-1">
            <Label htmlFor={`var-${v.name}`}>
              {v.label}{' '}
              <span className="text-xs text-muted-foreground">
                ({v.optional ? 'opt' : 'req'}, max {v.max})
              </span>
            </Label>
            {isLong ? (
              <Textarea
                id={`var-${v.name}`}
                value={vars[v.name] ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
                rows={3}
              />
            ) : (
              <Input
                id={`var-${v.name}`}
                value={vars[v.name] ?? ''}
                onChange={(e) => update(v.name, e.target.value)}
                maxLength={v.max}
              />
            )}
            {v.description && <p className="text-xs text-muted-foreground">{v.description}</p>}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: VisualDisplay**

Créer `src/app/(app)/posts/[id]/_components/visual-display.tsx` :

```tsx
'use client';

import Image from 'next/image';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { detachMediaAction } from '../media-actions';

type Props = {
  postId: string;
  signedUrl: string;
  width: number;
  height: number;
  onReplaceClick: () => void;
};

export function VisualDisplay({ postId, signedUrl, width, height, onReplaceClick }: Props) {
  const [pending, start] = useTransition();
  const detach = () => {
    start(async () => {
      const r = await detachMediaAction(postId);
      if (r.status === 'error') toast.error(r.message);
      else toast.success('Visuel détaché');
    });
  };
  return (
    <div className="space-y-2">
      <div className="border rounded p-2 bg-neutral-50 max-w-md">
        <Image
          src={signedUrl}
          alt="Visuel du post"
          width={width}
          height={height}
          unoptimized
          className="w-full h-auto"
        />
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onReplaceClick}>Remplacer</Button>
        <Button variant="ghost" size="sm" onClick={detach} disabled={pending}>
          {pending ? 'Détachement…' : 'Détacher'}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: AddVisualDialog**

Créer `src/app/(app)/posts/[id]/_components/add-visual-dialog.tsx` :

```tsx
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useJobPolling } from '@/hooks/use-job-polling';
import type { VisualTemplate } from '@/lib/db/schema';
import type { VariableSpec } from '@/lib/visual-templates/dsl';
import { enqueuePostFinalAction, enqueuePostPreviewAction } from '../media-actions';
import { VariablesForm } from './variables-form';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string;
  templates: VisualTemplate[];
};

export function AddVisualDialog({ open, onOpenChange, postId, templates }: Props) {
  const [selected, setSelected] = useState<VisualTemplate | null>(null);
  const [vars, setVars] = useState<Record<string, unknown>>({});
  const [previewJobKey, setPreviewJobKey] = useState<string | null>(null);
  const [finalJobKey, setFinalJobKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [enqueuing, start] = useTransition();

  useJobPolling(previewJobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: (result) => {
      if (
        result && typeof result === 'object' && 'signedUrl' in result &&
        typeof (result as { signedUrl: unknown }).signedUrl === 'string'
      ) {
        setPreviewUrl((result as { signedUrl: string }).signedUrl);
      }
      setPreviewJobKey(null);
    },
  });

  useJobPolling(finalJobKey, {
    queue: 'render-visual',
    defaultToast: false,
    onCompleted: () => {
      toast.success('Visuel ajouté au post');
      setFinalJobKey(null);
      onOpenChange(false);
      reset();
    },
  });

  const reset = () => {
    setSelected(null);
    setVars({});
    setPreviewUrl(null);
    setPreviewJobKey(null);
    setFinalJobKey(null);
  };

  const onSelect = (t: VisualTemplate) => {
    setSelected(t);
    setVars((t.sampleVars as Record<string, unknown>) ?? {});
    setPreviewUrl(null);
  };

  const onPreview = () => {
    if (!selected) return;
    setPreviewUrl(null);
    start(async () => {
      const r = await enqueuePostPreviewAction({ templateId: selected.id, vars });
      if (r.status === 'error') toast.error(r.message);
      else setPreviewJobKey(r.jobKey);
    });
  };

  const onValidate = () => {
    if (!selected) return;
    start(async () => {
      const r = await enqueuePostFinalAction({ postId, templateId: selected.id, vars });
      if (r.status === 'error') toast.error(r.message);
      else setFinalJobKey(r.jobKey);
    });
  };

  const isWorking = enqueuing || previewJobKey !== null || finalJobKey !== null;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Ajouter un visuel</DialogTitle>
          <DialogDescription>
            {selected ? `Template : ${selected.label}` : 'Choisis un template visuel.'}
          </DialogDescription>
        </DialogHeader>

        {!selected ? (
          templates.length === 0 ? (
            <div className="py-8 text-center space-y-2">
              <p className="text-sm text-muted-foreground">Aucun template disponible.</p>
              <Button asChild variant="outline">
                <Link href="/settings/visual-templates/new">Créer un template</Link>
              </Button>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3">
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(t)}
                    className="w-full text-left border rounded p-3 hover:bg-neutral-50"
                  >
                    <p className="font-medium">{t.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.platform} · {t.width}×{t.height}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <VariablesForm
                schema={selected.variablesSchema as VariableSpec[]}
                initial={(selected.sampleVars as Record<string, unknown>) ?? {}}
                onChange={setVars}
              />
            </div>
            <div className="border rounded p-2 bg-neutral-50 flex items-center justify-center">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt="Preview"
                  width={selected.width}
                  height={selected.height}
                  unoptimized
                  className="max-w-full h-auto"
                />
              ) : (
                <p className="text-xs text-muted-foreground">Clique "Aperçu" pour générer.</p>
              )}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          {selected && (
            <>
              <Button variant="ghost" onClick={reset} disabled={isWorking}>
                Changer de template
              </Button>
              <Button variant="outline" onClick={onPreview} disabled={isWorking}>
                {previewJobKey !== null ? 'Génération…' : 'Aperçu'}
              </Button>
              <Button onClick={onValidate} disabled={isWorking}>
                {finalJobKey !== null ? 'Attache…' : 'Valider et attacher'}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 5: Modifier `posts/[id]/page.tsx` pour charger templates + media url**

Modifier `src/app/(app)/posts/[id]/page.tsx` :

```tsx
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { requireUserId } from '@/lib/auth/session';
import { getIdea } from '@/lib/db/repositories/ideas';
import { getMedia } from '@/lib/db/repositories/media';
import { getPost } from '@/lib/db/repositories/posts';
import { listVisualTemplates } from '@/lib/db/repositories/visual-templates';
import { getStorage } from '@/lib/storage';
import { PostEditor } from './_components/post-editor';

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const post = await getPost(userId, id);
  if (!post) notFound();
  const idea = await getIdea(userId, post.ideaId);
  if (!idea) notFound();

  const templates = await listVisualTemplates(userId);

  let mediaInfo: { signedUrl: string; width: number; height: number } | null = null;
  if (post.mediaId) {
    const m = await getMedia(userId, post.mediaId);
    if (m) {
      const signedUrl = await getStorage().signedUrl({
        key: m.assetKey,
        expiresInSeconds: 3600,
      });
      mediaInfo = { signedUrl, width: m.width, height: m.height };
    }
  }

  return (
    <div className="space-y-4">
      <Link href="/posts" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
        ← Tous les posts
      </Link>
      <PostEditor post={post} idea={idea} templates={templates} mediaInfo={mediaInfo} />
    </div>
  );
}
```

- [ ] **Step 6: Modifier post-editor pour intégrer dialog + display**

Modifier `src/app/(app)/posts/[id]/_components/post-editor.tsx` (remplacement complet, basé sur l'existant) :

```tsx
'use client';

import { Image as ImageIcon, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Idea, Post, VisualTemplate } from '@/lib/db/schema';
import { updatePostAction } from '../../actions';
import { AddVisualDialog } from './add-visual-dialog';
import { DeletePostDialog } from './delete-post-dialog';
import { VisualDisplay } from './visual-display';

type Props = {
  post: Post;
  idea: Idea;
  templates: VisualTemplate[];
  mediaInfo: { signedUrl: string; width: number; height: number } | null;
};

export function PostEditor({ post, idea, templates, mediaInfo }: Props) {
  const [content, setContent] = useState(post.content);
  const [status, setStatus] = useState<'draft' | 'validated'>(post.status);
  const [saving, startSave] = useTransition();
  const [toggling, startToggle] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);

  const saveContent = () => {
    if (content.trim() === post.content.trim() || !content.trim()) return;
    startSave(async () => {
      const r = await updatePostAction({ id: post.id, content });
      if (r.status === 'error') toast.error(r.message);
    });
  };

  const toggleStatus = () => {
    const next: 'draft' | 'validated' = status === 'draft' ? 'validated' : 'draft';
    startToggle(async () => {
      const r = await updatePostAction({ id: post.id, status: next });
      if (r.status === 'success') {
        setStatus(next);
        toast.success(next === 'validated' ? 'Post validé' : 'Remis en draft');
      } else if (r.status === 'error') {
        toast.error(r.message);
      }
    });
  };

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold">{idea.idea}</h1>
          <Badge variant={status === 'validated' ? 'default' : 'secondary'}>{status}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Post #{post.id.slice(0, 8)} · créé le{' '}
          {new Date(post.createdAt).toLocaleDateString('fr-FR')}
        </p>
      </header>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">Visuel</h2>
        {mediaInfo ? (
          <VisualDisplay
            postId={post.id}
            signedUrl={mediaInfo.signedUrl}
            width={mediaInfo.width}
            height={mediaInfo.height}
            onReplaceClick={() => setDialogOpen(true)}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => setDialogOpen(true)}>
            <ImageIcon className="h-4 w-4 mr-2" />
            Ajouter un visuel
          </Button>
        )}
      </section>

      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onBlur={saveContent}
        rows={20}
        disabled={saving}
        className="font-mono"
      />

      <footer className="flex items-center justify-between gap-3">
        <Button onClick={toggleStatus} disabled={toggling}>
          {status === 'draft' ? 'Valider' : 'Remettre en draft'}
        </Button>
        <DeletePostDialog
          postId={post.id}
          trigger={
            <Button variant="ghost" size="icon" aria-label="Supprimer le post">
              <Trash2 className="h-4 w-4" />
            </Button>
          }
        />
      </footer>

      <AddVisualDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        postId={post.id}
        templates={templates}
      />
    </div>
  );
}
```

- [ ] **Step 7: Smoke test manuel**

```bash
# Terminal 1: npm run dev
# Terminal 2: npm run worker
```

1. Aller sur `/settings/visual-templates`, créer un template simple (slug `simple`, HTML `<h1>{{title}}</h1>`, vars `[{name:'title', label:'T', type:'string', max:50}]`, sample `{"title":"Demo"}`).
2. Aller sur `/posts/<id>` d'un post existant.
3. Cliquer "Ajouter un visuel" → sélectionner le template → modifier `title` → "Aperçu" → image apparaît → "Valider et attacher".
4. Recharger : l'image est affichée au-dessus du textarea.
5. Cliquer "Détacher" → l'image disparaît, bouton "Ajouter un visuel" revient.

- [ ] **Step 8: Commit**

```bash
git add src/app/\(app\)/posts/\[id\]
git commit -m "🤖 feat(spec-5): post media picker (dialog + preview + attach + detach)"
```

---

## Task 9: Seeds (linkedin-big-number + linkedin-manifesto) + script

**Files:**
- Create: `src/lib/visual-templates/seeds/linkedin-big-number.ts`
- Create: `src/lib/visual-templates/seeds/linkedin-manifesto.ts`
- Create: `src/lib/visual-templates/seeds/index.ts`
- Create: `scripts/seed-visual-templates.ts`
- Modify: `README.md` (note brève)

- [ ] **Step 1: Seed linkedin-big-number**

Créer `src/lib/visual-templates/seeds/linkedin-big-number.ts` :

```ts
import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-big-number/index.ts).
// Toutes les vars sont AI-driven, pas d'image IA.
export const linkedinBigNumber: CreateVisualTemplateInput = {
  slug: 'linkedin-big-number',
  label: 'LinkedIn — Big number (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="big-number">{{bigNumber}}</div>
  <div class="underline"></div>
  <div class="context">{{context}}</div>
  <div class="arrow-block">
    {{#ifNotEmpty subtitle}}
    <svg class="arrow" width="560" height="120" viewBox="0 0 560 120" fill="none" aria-hidden="true">
      <path d="M0 60h470M440 18l80 42-80 42" stroke="#000" stroke-width="22" stroke-linecap="square" stroke-linejoin="miter"/>
    </svg>
    {{/ifNotEmpty}}
  </div>
  {{#ifNotEmpty subtitle}}<div class="subtitle">{{subtitle}}</div>{{/ifNotEmpty}}
  {{#ifNotEmpty signature}}<div class="signature">{{signature}}</div>{{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  padding: 110px 96px 96px 96px;
  display: flex;
  flex-direction: column;
}
.big-number {
  font-family: "Clash Display", -apple-system, sans-serif;
  font-size: 168px;
  font-weight: 700;
  line-height: 0.94;
  letter-spacing: -0.035em;
  white-space: nowrap;
  overflow: hidden;
  max-width: 100%;
}
.underline {
  width: 480px;
  height: 14px;
  background: #000;
  margin-top: 40px;
  margin-bottom: 60px;
}
.context {
  font-family: "Clash Display", -apple-system, sans-serif;
  font-size: 64px;
  font-weight: 700;
  line-height: 1.08;
  letter-spacing: -0.01em;
  max-width: 820px;
  white-space: pre-line;
  max-height: 215px;
  overflow: hidden;
}
.arrow-block { margin-top: auto; margin-bottom: 56px; }
.arrow { display: block; }
.subtitle {
  font-family: "General Sans", -apple-system, sans-serif;
  font-size: 34px;
  font-weight: 500;
  line-height: 1.32;
  max-width: 820px;
  white-space: pre-line;
  max-height: 95px;
  overflow: hidden;
  margin-bottom: 28px;
}
.signature {
  font-family: "General Sans", -apple-system, sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #525252;
}`,
  variablesSchema: [
    {
      name: 'bigNumber',
      label: 'Statistique',
      type: 'string',
      min: 1,
      max: 8,
      description:
        "Court et frappant : un chiffre + son unité (+10h/sem, -80%, x3, 4 sem.). 8 chars max.",
    },
    {
      name: 'context',
      label: 'Contexte',
      type: 'string',
      min: 20,
      max: 90,
      description: "Phrase courte qui explique la stat, sans répéter le chiffre.",
    },
    {
      name: 'subtitle',
      label: 'Sous-titre (optionnel)',
      type: 'string',
      max: 140,
      optional: true,
    },
    {
      name: 'signature',
      label: 'Signature (optionnel)',
      type: 'string',
      max: 30,
      optional: true,
    },
  ],
  sampleVars: {
    bigNumber: '+10h/sem',
    context: 'Gagnées par client en automatisant le tri des emails.',
    subtitle: 'Méthode : agent Claude + règles Gmail. 4 semaines de cadrage.',
    signature: 'AVQN.CH',
  },
};
```

- [ ] **Step 2: Seed linkedin-manifesto**

Créer `src/lib/visual-templates/seeds/linkedin-manifesto.ts` :

```ts
import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';

// Porté depuis content-os v1 (src/visuals/linkedin-manifesto/index.ts). Text only.
export const linkedinManifesto: CreateVisualTemplateInput = {
  slug: 'linkedin-manifesto',
  label: 'LinkedIn — Manifesto / Quote (4:5)',
  platform: 'linkedin',
  width: 1080,
  height: 1350,
  bodyHtml: `<div class="container">
  <div class="quote-mark">&ldquo;</div>
  <div class="quote">{{quote}}</div>
  <div class="spacer"></div>
  {{#ifNotEmpty author}}
  <div class="attribution">
    <div class="author">{{author}}</div>
    {{#ifNotEmpty role}}<div class="role">{{role}}</div>{{/ifNotEmpty}}
  </div>
  {{/ifNotEmpty}}
</div>`,
  css: `.container {
  width: 100%;
  height: 100%;
  background: #fff;
  color: #000;
  padding: 96px 88px 0 88px;
  display: flex;
  flex-direction: column;
  position: relative;
}
.quote-mark {
  font-family: "Clash Display", -apple-system, sans-serif;
  font-size: 280px;
  font-weight: 700;
  color: #000;
  line-height: 0.7;
  margin-bottom: 16px;
  margin-left: -8px;
  height: 200px;
  overflow: hidden;
}
.quote {
  font-family: "Clash Display", -apple-system, sans-serif;
  font-size: 80px;
  font-weight: 700;
  line-height: 1.04;
  letter-spacing: -0.005em;
  max-width: 920px;
  white-space: pre-line;
  max-height: 510px;
  overflow: hidden;
}
.spacer { flex: 1; min-height: 40px; }
.attribution {
  background: #000;
  color: #fff;
  margin: 0 -88px;
  padding: 44px 88px 56px 88px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.author {
  font-family: "General Sans", -apple-system, sans-serif;
  font-size: 38px;
  font-weight: 700;
  line-height: 1.15;
  color: #fff;
}
.role {
  font-family: "General Sans", -apple-system, sans-serif;
  font-size: 24px;
  font-weight: 500;
  letter-spacing: 0.04em;
  line-height: 1.3;
  color: #a3a3a3;
  text-transform: uppercase;
}`,
  variablesSchema: [
    {
      name: 'quote',
      label: 'Citation',
      type: 'string',
      min: 30,
      max: 220,
      description: 'Affirmation tranchée, sentence case, sans guillemets (le visuel les ajoute).',
    },
    {
      name: 'author',
      label: 'Auteur (optionnel)',
      type: 'string',
      max: 50,
      optional: true,
    },
    {
      name: 'role',
      label: 'Rôle (optionnel)',
      type: 'string',
      max: 60,
      optional: true,
    },
  ],
  sampleVars: {
    quote: 'On ne livre pas une feature, on livre un effet sur la vie du user.',
    author: 'Manu AVQN',
    role: 'AUTOMATISATION IA — AVQN',
  },
};
```

- [ ] **Step 3: Barrel des seeds**

Créer `src/lib/visual-templates/seeds/index.ts` :

```ts
import type { CreateVisualTemplateInput } from '@/lib/db/repositories/visual-templates';
import { linkedinBigNumber } from './linkedin-big-number';
import { linkedinManifesto } from './linkedin-manifesto';

export const VISUAL_TEMPLATE_SEEDS: CreateVisualTemplateInput[] = [
  linkedinBigNumber,
  linkedinManifesto,
];
```

- [ ] **Step 4: Script seed**

Créer `scripts/seed-visual-templates.ts` :

```ts
#!/usr/bin/env tsx
import {
  createVisualTemplate,
  getVisualTemplateBySlug,
} from '@/lib/db/repositories/visual-templates';
import { VISUAL_TEMPLATE_SEEDS } from '@/lib/visual-templates/seeds';

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Usage: tsx scripts/seed-visual-templates.ts <userId>');
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  for (const seed of VISUAL_TEMPLATE_SEEDS) {
    const existing = await getVisualTemplateBySlug(userId, seed.slug);
    if (existing) {
      console.log(`  skip  ${seed.slug} (exists)`);
      skipped++;
      continue;
    }
    const row = await createVisualTemplate(userId, seed);
    if (row) {
      console.log(`  add   ${seed.slug} → ${row.id}`);
      created++;
    } else {
      console.log(`  fail  ${seed.slug} (conflict)`);
    }
  }
  console.log(`\nDone. created=${created} skipped=${skipped}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 5: README brève note**

Modifier `README.md` (ajouter une section après la doc du worker) :

```markdown
### Visual templates seeds

Pour pré-charger les 2 templates LinkedIn portés depuis v1 dans le compte d'un user :

```bash
tsx --env-file=.env scripts/seed-visual-templates.ts <USER_ID>
```

Idempotent : skip les slugs déjà présents.
```

- [ ] **Step 6: Smoke test du script**

```bash
# Récupère un userId existant via psql ou drizzle-studio
tsx --env-file=.env scripts/seed-visual-templates.ts <USER_ID>
```

Expected: deux lignes `add ...` puis `Done. created=2 skipped=0`. Vérifier dans `/settings/visual-templates` que les templates apparaissent.

- [ ] **Step 7: Commit**

```bash
git add src/lib/visual-templates/seeds scripts/seed-visual-templates.ts README.md
git commit -m "🤖 feat(spec-5): seeds linkedin-big-number + linkedin-manifesto + script"
```

---

## Task 10: Sidebar nav link

**Files:**
- Modify: sidebar component (chemin à confirmer via grep)

- [ ] **Step 1: Trouver le composant sidebar**

```bash
grep -r "writing-templates" src/components/ src/app 2>/dev/null | grep -i "sidebar\|nav" | head -5
```

Si pas trouvé via grep, chercher dans `src/app/(app)/layout.tsx` ou similaire.

- [ ] **Step 2: Ajouter le lien**

Repérer la liste de liens Settings et ajouter à côté de "Writing templates" :

```tsx
{ href: '/settings/visual-templates', label: 'Visual templates' },
```

(adapter à la convention exacte du composant — c'est probablement un array de `{href, label}` ou un mapping similaire).

- [ ] **Step 3: Smoke test manuel**

`npm run dev` → ouvrir `/settings/brand` → vérifier que le lien "Visual templates" apparaît dans la nav et y mène.

- [ ] **Step 4: Commit**

```bash
git add src/<path>
git commit -m "🤖 feat(spec-5): sidebar nav link vers /settings/visual-templates"
```

---

## Task 11: E2E + lint + format + typecheck + push + PR

**Files:**
- Create: `test/e2e/visual-templates.spec.ts`
- Create: `test/e2e/post-visual.spec.ts`

- [ ] **Step 1: E2E back-office**

Créer `test/e2e/visual-templates.spec.ts` :

```ts
import { expect, test } from '@playwright/test';
import { signupAndLogin } from './global-setup';

test('create + preview + delete a visual template', async ({ page }) => {
  await signupAndLogin(page);
  await page.goto('/settings/visual-templates');
  await expect(page.getByText('Aucun template')).toBeVisible();

  await page.getByRole('link', { name: '+ Nouveau' }).click();
  await page.getByLabel('Nom').fill('Simple');
  await page.getByLabel('Slug').fill('simple');
  await page.getByLabel('Width (px)').fill('600');
  await page.getByLabel('Height (px)').fill('400');
  await page.getByLabel('HTML (Handlebars)').fill('<h1>{{title}}</h1>');
  await page.getByLabel('CSS').fill('h1 { font-size: 80px; }');
  await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
  await page.getByLabel('Name (identifiant Handlebars)').first().fill('title');
  await page.getByLabel('Label (UI)').first().fill('Titre');
  await page.getByLabel('Max').first().fill('50');
  await page.getByLabel('Sample vars (JSON, sert au preview)').fill('{"title":"Hello"}');
  await page.getByRole('button', { name: 'Créer' }).click();

  await expect(page.getByText('Simple')).toBeVisible();
  await page.getByText('Simple').click();

  await page.getByRole('button', { name: /Prévisualiser/ }).click();
  // Attendre jusqu'à ce qu'une image apparaisse (timeout 30s pour Puppeteer ou stub).
  await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 30_000 });

  await page.getByRole('button', { name: /Supprimer ce template/ }).click();
  await page.getByRole('button', { name: /^Supprimer$/ }).click();
  await expect(page.getByText('Aucun template')).toBeVisible();
});
```

- [ ] **Step 2: E2E post visual**

Créer `test/e2e/post-visual.spec.ts` :

```ts
import { expect, test } from '@playwright/test';
import { signupAndLogin } from './global-setup';

test('add a template-based visual to a post', async ({ page }) => {
  await signupAndLogin(page);

  // 1. Créer un template
  await page.goto('/settings/visual-templates/new');
  await page.getByLabel('Nom').fill('PostT');
  await page.getByLabel('Slug').fill('postt');
  await page.getByLabel('Width (px)').fill('600');
  await page.getByLabel('Height (px)').fill('400');
  await page.getByLabel('HTML (Handlebars)').fill('<h1>{{title}}</h1>');
  await page.getByLabel('CSS').fill('h1 { font-size: 80px; }');
  await page.getByRole('button', { name: '+ Ajouter une variable' }).click();
  await page.getByLabel('Name (identifiant Handlebars)').first().fill('title');
  await page.getByLabel('Label (UI)').first().fill('Titre');
  await page.getByLabel('Max').first().fill('50');
  await page.getByLabel('Sample vars (JSON, sert au preview)').fill('{"title":"Hello"}');
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page.getByText('PostT')).toBeVisible();

  // 2. Créer une idée + post via UI
  await page.goto('/ideas');
  await page.getByPlaceholder(/Titre/i).fill('Test idea');
  await page.getByPlaceholder(/Brief/i).fill('Test brief content for visual.');
  await page.getByRole('button', { name: /Capturer|Ajouter/i }).click();
  await page.getByRole('button', { name: /Générer un post/i }).first().click();
  // CONTENT_OS_AI_STUB=1 garantit un post stub rapide.
  await expect(page.getByText('Post créé')).toBeVisible({ timeout: 30_000 });

  // 3. Ouvrir le post → ajouter un visuel
  await page.getByRole('link', { name: /Voir/i }).click();
  await page.getByRole('button', { name: /Ajouter un visuel/ }).click();
  await page.getByRole('button', { name: /PostT/ }).click();
  await page.getByRole('button', { name: /^Aperçu$/ }).click();
  await expect(page.locator('img[alt="Preview"]')).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Valider et attacher/ }).click();
  await expect(page.getByText(/Visuel ajouté/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('img[alt="Visuel du post"]')).toBeVisible();

  // 4. Détacher
  await page.getByRole('button', { name: /Détacher/ }).click();
  await expect(page.getByRole('button', { name: /Ajouter un visuel/ })).toBeVisible();
});
```

- [ ] **Step 3: Lancer E2E avec stubs**

```bash
CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_AI_STUB=1 npm run test:e2e
```

Expected: tous verts.

- [ ] **Step 4: Lint + format + typecheck**

```bash
npm run lint
npm run format
npx tsc --noEmit
```

Fix any errors. Recommit si format change quoi que ce soit.

- [ ] **Step 5: Full test suite**

```bash
npm test
```

Expected: unit + integration + worker tous verts.

- [ ] **Step 6: Commit final si nécessaire**

```bash
git add test/e2e
git commit -m "🤖 test(spec-5): e2e back-office + post media picker (Puppeteer stubbed)"
```

- [ ] **Step 7: Push + PR**

```bash
git push -u origin spec-5/visual-templates

gh pr create --title "spec 5: visual templates + post media picker" --body "$(cat <<'EOF'
## Summary
- Nouvelle table `visual_templates` (Drizzle, scopée user) + repository CRUD
- DSL maison pour les variables (type `string` seul MVP) → Zod runtime
- Compilateur Handlebars + base CSS (fonts AVQN) + helpers minimaux
- Renderer Puppeteer dans worker BullMQ (queue `render-visual`, modes preview/final)
- Back-office CRUD complet `/settings/visual-templates` avec preview asynchrone
- Picker média sur `/posts/[id]` (dialog → sélection template → form vars → aperçu → attach)
- Seeds : 2 templates LinkedIn portés depuis v1 (`linkedin-big-number`, `linkedin-manifesto`)
- Script idempotent `scripts/seed-visual-templates.ts <USER_ID>`
- Tests : unit (DSL, compile), integration (repository, actions create/edit), worker (preview/final happy paths), E2E (back-office + post picker)

Spec : `docs/superpowers/specs/2026-05-23-spec-5-visual-templates-design.md`
Plan : `docs/superpowers/plans/2026-05-23-spec-5-visual-templates.md`

## Test plan
- [ ] `npm test` → unit + integration + worker verts
- [ ] `CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_AI_STUB=1 npm run test:e2e` → E2E verts
- [ ] Smoke local : créer un template → preview → l'attacher à un post → détacher → re-attacher

## Hors-scope (cf. spec § Hors scope)
- Upload manuel, génération IA, médiathèque (Spec 6)
- Variables image/color/list/toggle (Spec 6+)
- Multi-images par post (Spec 6+)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Expected: PR créée, URL retournée.

- [ ] **Step 8: Marquer toutes les tasks comme completed**

Vérifier que rien n'est en `in_progress`. Reporter au user la PR URL.

---

## Critères de réussite globale

Cf. spec § Critères de réussite. Synthétiquement :

- Tous les tests verts (unit + integration + worker + E2E avec stubs).
- Lint + format + tsc clean.
- Un user peut : créer un template via back-office, prévisualiser, supprimer ; ajouter un visuel sur un post, prévisualiser, attacher, détacher.
- Tenant isolation : un user ne voit/édite/supprime jamais les templates d'un autre.
- Aucun appel sync à Puppeteer depuis le code `web` : tout passe par la queue.
- PR ouverte sur la branche `spec-5/visual-templates`, prête à reviewer/merger.
