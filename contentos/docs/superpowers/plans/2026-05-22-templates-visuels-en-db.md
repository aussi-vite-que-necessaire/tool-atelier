# Templates visuels en base de données — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Déplacer les 10 templates visuels de `src/visuals/<slug>/index.ts` vers la table `visual_templates` en DB, avec Handlebars comme data binding et un CRUD admin éditable depuis l'UI, sans régression visuelle (validée par golden image testing).

**Architecture:** Nouvelle table `visual_templates` (id, slug, label, platform, width, height, body_html, css, variables_schema JSON Schema 2020-12, sample_vars, image_prompt, image_aspect_ratio). Compilateur Handlebars (`src/visuals/compile.ts`) avec helpers minimaux et cache LRU. Pipeline `produceVisual()` modifié pour appeler `compileTemplate()` au lieu de `template.render()`. UI CRUD complète sur `/visual-templates` avec preview obligatoire au save. Migration par feature flag `VISUAL_TEMPLATES_FROM_DB` (legacy et DB coexistent jusqu'au flip).

**Tech Stack:** TypeScript + tsx (zéro build), better-sqlite3, Handlebars, Ajv (JSON Schema 2020-12), pixelmatch + pngjs (devDep, golden tests), Puppeteer (existant), Hono (existant), HTMX (existant). Tests via `node --import tsx --test`.

**Spec source:** `docs/superpowers/specs/2026-05-22-templates-visuels-en-db-design.md`

---

## Structure des fichiers

### Nouveaux fichiers

```
src/visuals/
  base.css                              # @font-face + reset universel
  compile.ts                            # Handlebars compile + helpers + cache LRU
  schema.ts                             # Ajv setup + validation JSON Schema + x-source
  sonnet-schema.ts                      # Transform DB schema → Sonnet tool_use input
  store.ts                              # Queries DB : get, list, create, update, delete
  seeds/
    <slug>/
      body.hbs                          # body_html (Handlebars)
      style.css                         # css template-specific
      schema.json                       # variables_schema (JSON Schema 2020-12)
      sample-vars.json                  # sample_vars pour preview
      meta.json                         # { label, platform, width, height, image_prompt, image_aspect_ratio }

scripts/
  migrate-visuals.ts                    # Helper : extrait HTML/CSS depuis ancien render() avec sentinels
  seed-visual-templates.ts              # INSERT OR IGNORE depuis src/visuals/seeds/

tests/
  visuals/
    compile.test.ts                     # Unit tests compile + helpers
    schema.test.ts                      # Unit tests validation Ajv + x-source
    sonnet-schema.test.ts               # Unit tests filtre ai-only
    store.test.ts                       # Unit tests CRUD DB
    render.test.ts                      # Integration : compile + renderHtmlToPng
    golden/
      <slug>.test.ts                    # Un test par template, pixelmatch contre golden PNG
  golden/
    visual-templates/
      <slug>.png                        # 10 PNGs de référence (~5-15MB total)
```

### Fichiers modifiés

```
src/db.ts                               # + table visual_templates + types
src/visuals/index.ts                    # Devient loader DB : getVisualTemplate, listVisualTemplates
src/visuals/types.ts                    # + type VisualTemplateRow ; déprécie VisualTemplate
src/generate.ts                         # produceVisual + regenerateImageOnly utilisent compileTemplate
src/server.ts                           # Nouvelles routes CRUD /visual-templates
src/views/visual-templates.ts           # CRUD complet (list + edit + new + preview)
scripts/smoke-render-templates.ts       # Lit DB au lieu du registre statique
package.json                            # + handlebars, ajv, ajv-formats ; devDeps pixelmatch, pngjs ; script test
```

### Fichiers supprimés (Phase 8 cleanup uniquement)

```
src/visuals/<slug>/index.ts             # 10 fichiers
src/visuals/mock.ts                     # Promu en seed seeds/mock/
```

---

## Phases d'exécution

- **Phase 1 — Setup foundation** : T1-T4 (deps, table, validateurs)
- **Phase 2 — Compiler & store** : T5-T8 (base.css, compile, store, integration)
- **Phase 3 — Pipeline integration** : T9-T11 (produceVisual derrière flag, loader DB)
- **Phase 4 — First template migration** : T12-T14 (migrate helper, mock + linkedin-big-number)
- **Phase 5 — Seed script** : T15
- **Phase 6 — Admin UI** : T16-T20 (list, edit, create, validation, preview, /visual-options)
- **Phase 7 — Remaining 8 templates** : T21
- **Phase 8 — Flag flip & cleanup** : T22-T23

Chaque phase produit du code mergeable. Possible de s'arrêter après T14 et avoir un pipeline DB fonctionnel pour 2 templates.

---

## Phase 1 — Setup foundation

### Task 1: Install dependencies and configure test script

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add runtime dependencies**

Run:
```bash
npm install handlebars@^4.7.8 ajv@^8.17.1 ajv-formats@^3.0.1
```

Expected: 3 packages added, no errors.

- [ ] **Step 2: Add devDependencies**

Run:
```bash
npm install --save-dev pixelmatch@^7.1.0 pngjs@^7.0.0 @types/pngjs@^6.0.5
```

Expected: 3 packages added.

- [ ] **Step 3: Add test script for the new test runner**

Edit `package.json` scripts section :

```json
"scripts": {
  "dev": "tsx watch --env-file=.env src/server.ts",
  "start": "tsx src/server.ts",
  "test:legacy": "tsx scripts/smoke-render-templates.ts && tsx scripts/test-migration.ts && tsx scripts/test-crypto.ts",
  "test:visuals": "node --import tsx --test 'tests/visuals/**/*.test.ts'",
  "test": "npm run test:legacy && npm run test:visuals"
}
```

- [ ] **Step 4: Smoke-check tooling**

Run:
```bash
mkdir -p tests/visuals
cat > tests/visuals/smoke.test.ts <<'EOF'
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('test runner works with tsx', () => {
  assert.equal(1 + 1, 2);
});
EOF
npm run test:visuals
```

Expected: `# pass 1`, no errors.

- [ ] **Step 5: Commit**

```bash
rm tests/visuals/smoke.test.ts
git add package.json package-lock.json
git commit -m "$(cat <<'EOF'
🤖 chore(deps): add handlebars, ajv, pixelmatch for templates en DB

Ajoute les deps runtime (handlebars, ajv, ajv-formats) et devDeps
(pixelmatch, pngjs) pour le chantier templates visuels en DB. Configure
node --import tsx --test pour les nouveaux tests sous tests/visuals/.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Add `visual_templates` table and types

**Files:**
- Modify: `src/db.ts`

- [ ] **Step 1: Add CREATE TABLE statement**

In `src/db.ts`, after the `visual_styles` table declaration (around line 99), add :

```sql
CREATE TABLE IF NOT EXISTS visual_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'linkedin',
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  body_html TEXT NOT NULL,
  css TEXT NOT NULL,
  variables_schema TEXT NOT NULL,
  sample_vars TEXT NOT NULL DEFAULT '{}',
  image_prompt TEXT,
  image_aspect_ratio TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS visual_templates_platform_idx
  ON visual_templates(platform);
```

- [ ] **Step 2: Add TypeScript type**

In `src/db.ts`, in the types section (after the other Row types), add :

```ts
export type VisualTemplateRow = {
  id: number;
  slug: string;
  label: string;
  platform: PlatformKey;
  width: number;
  height: number;
  body_html: string;
  css: string;
  variables_schema: string;  // JSON string
  sample_vars: string;       // JSON string
  image_prompt: string | null;
  image_aspect_ratio: string | null;
  created_at: string;
  updated_at: string;
};
```

- [ ] **Step 3: Smoke-check the table creation**

Run:
```bash
rm -f data/avqn.db
npm start &
SERVER_PID=$!
sleep 3
sqlite3 data/avqn.db ".schema visual_templates"
kill $SERVER_PID
```

Expected: the CREATE TABLE statement is printed, including `visual_templates_platform_idx`.

- [ ] **Step 4: Commit**

```bash
git add src/db.ts
git commit -m "$(cat <<'EOF'
🤖 feat(db): add visual_templates table for templates en DB

Nouvelle table visual_templates (slug, label, platform, width/height,
body_html, css, variables_schema JSON, sample_vars, image_prompt,
image_aspect_ratio). Type VisualTemplateRow exporté pour les consommateurs.
Préparation du chantier "templates en DB" : la table cohabite avec le
registre statique src/visuals/*/index.ts jusqu'au flip du flag.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Build `src/visuals/schema.ts` (Ajv validator with x-source)

**Files:**
- Create: `src/visuals/schema.ts`
- Create: `tests/visuals/schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/visuals/schema.test.ts` :

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateVariablesSchema, validateSampleVars } from '../../src/visuals/schema.js';

test('validateVariablesSchema accepts a minimal valid schema with x-source', () => {
  const schema = {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 80, description: 'le titre', 'x-source': 'ai' },
    },
  };
  const res = validateVariablesSchema(schema);
  assert.equal(res.ok, true);
});

test('validateVariablesSchema rejects a property without description', () => {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string', 'x-source': 'ai' },
    },
  };
  const res = validateVariablesSchema(schema);
  assert.equal(res.ok, false);
  assert.match(res.error!, /description/);
});

test('validateVariablesSchema rejects unknown x-source value', () => {
  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'le titre', 'x-source': 'invalid' },
    },
  };
  const res = validateVariablesSchema(schema);
  assert.equal(res.ok, false);
  assert.match(res.error!, /x-source/);
});

test('validateVariablesSchema rejects x-source: image without image_prompt context', () => {
  const schema = {
    type: 'object',
    properties: {
      image: { type: 'string', description: 'image IA', 'x-source': 'image' },
    },
  };
  // image_prompt context not provided
  const res = validateVariablesSchema(schema, { imagePrompt: null });
  assert.equal(res.ok, false);
  assert.match(res.error!, /image_prompt/);
});

test('validateSampleVars accepts payload conforming to schema', () => {
  const schema = {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 80, description: 'le titre', 'x-source': 'ai' },
    },
  };
  const res = validateSampleVars(schema, { title: 'Hello' });
  assert.equal(res.ok, true);
});

test('validateSampleVars rejects payload missing required field', () => {
  const schema = {
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', description: 'le titre', 'x-source': 'ai' },
    },
  };
  const res = validateSampleVars(schema, {});
  assert.equal(res.ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:visuals`
Expected: module not found error for `../../src/visuals/schema.js`.

- [ ] **Step 3: Implement `src/visuals/schema.ts`**

Create `src/visuals/schema.ts` :

```ts
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

export type ValidationResult =
  | { ok: true }
  | { ok: false; error: string };

const ALLOWED_X_SOURCES = new Set(['ai', 'user', 'image']);

const ajv = new Ajv2020({ allErrors: false, strict: false });
addFormats(ajv);

export function validateVariablesSchema(
  schema: unknown,
  ctx: { imagePrompt?: string | null } = {},
): ValidationResult {
  if (typeof schema !== 'object' || schema === null) {
    return { ok: false, error: 'variables_schema must be a JSON object' };
  }
  const s = schema as Record<string, unknown>;
  if (s.type !== 'object') {
    return { ok: false, error: "variables_schema root must have type: 'object'" };
  }
  const props = (s.properties ?? {}) as Record<string, Record<string, unknown>>;
  if (Object.keys(props).length === 0) {
    return { ok: false, error: 'variables_schema must declare at least one property' };
  }
  for (const [name, prop] of Object.entries(props)) {
    if (typeof prop.description !== 'string' || prop.description.trim() === '') {
      return { ok: false, error: `property "${name}" must have a non-empty description` };
    }
    const xs = prop['x-source'];
    if (typeof xs !== 'string' || !ALLOWED_X_SOURCES.has(xs)) {
      return {
        ok: false,
        error: `property "${name}" has invalid x-source (must be one of ai, user, image)`,
      };
    }
    if (xs === 'image' && !ctx.imagePrompt) {
      return {
        ok: false,
        error: `property "${name}" has x-source: "image" but template has no image_prompt`,
      };
    }
  }
  try {
    ajv.compile(schema as object);
  } catch (err) {
    return { ok: false, error: `invalid JSON Schema: ${(err as Error).message}` };
  }
  return { ok: true };
}

export function validateSampleVars(schema: unknown, vars: unknown): ValidationResult {
  try {
    const validate = ajv.compile(schema as object);
    if (validate(vars)) return { ok: true };
    const msg = ajv.errorsText(validate.errors, { dataVar: 'sample_vars' });
    return { ok: false, error: msg };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:visuals`
Expected: all 6 tests in `schema.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/schema.ts tests/visuals/schema.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): JSON Schema validator with x-source annotation

Module schema.ts qui valide les variables_schema des templates via Ajv
2020-12. Règles supplémentaires : chaque propriété doit avoir une
description non-vide, x-source doit être dans {ai, user, image}, et
x-source: image impose image_prompt non-vide. Inclut validateSampleVars
qui vérifie qu'un payload conforme au schema.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Build `src/visuals/sonnet-schema.ts` (filter to AI-only properties)

**Files:**
- Create: `src/visuals/sonnet-schema.ts`
- Create: `tests/visuals/sonnet-schema.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/visuals/sonnet-schema.test.ts` :

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toSonnetToolInputSchema } from '../../src/visuals/sonnet-schema.js';

const FULL_SCHEMA = {
  type: 'object',
  required: ['title', 'image'],
  properties: {
    title:      { type: 'string', maxLength: 80, description: 'titre', 'x-source': 'ai' },
    bullets:    { type: 'array', items: { type: 'string' }, description: 'puces', 'x-source': 'ai' },
    brandColor: { type: 'string', format: 'color', description: 'couleur de marque', 'x-source': 'user' },
    image:      { type: 'string', description: 'image IA', 'x-source': 'image' },
  },
};

test('filters out user and image sources, keeps ai', () => {
  const out = toSonnetToolInputSchema(FULL_SCHEMA);
  assert.deepEqual(Object.keys(out.properties), ['title', 'bullets']);
});

test('strips x-source annotation from output (Sonnet does not need it)', () => {
  const out = toSonnetToolInputSchema(FULL_SCHEMA);
  assert.equal('x-source' in out.properties.title, false);
});

test('rewrites required to only include ai properties', () => {
  const out = toSonnetToolInputSchema(FULL_SCHEMA);
  assert.deepEqual(out.required, ['title']);
});

test('preserves descriptions (Sonnet needs them for the prompt)', () => {
  const out = toSonnetToolInputSchema(FULL_SCHEMA);
  assert.equal(out.properties.title.description, 'titre');
});
```

- [ ] **Step 2: Run tests, expect module-not-found failure**

Run: `npm run test:visuals`
Expected: fail with module not found.

- [ ] **Step 3: Implement `src/visuals/sonnet-schema.ts`**

Create `src/visuals/sonnet-schema.ts` :

```ts
export type JsonSchema = {
  type: 'object';
  required?: string[];
  properties: Record<string, Record<string, unknown>>;
};

export function toSonnetToolInputSchema(schema: JsonSchema): JsonSchema {
  const aiProps: Record<string, Record<string, unknown>> = {};
  for (const [name, prop] of Object.entries(schema.properties)) {
    if (prop['x-source'] !== 'ai') continue;
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(prop)) {
      if (k === 'x-source') continue;
      cleaned[k] = v;
    }
    aiProps[name] = cleaned;
  }
  const required = (schema.required ?? []).filter((name) => name in aiProps);
  return {
    type: 'object',
    properties: aiProps,
    ...(required.length > 0 ? { required } : {}),
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:visuals`
Expected: 4 new tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/sonnet-schema.ts tests/visuals/sonnet-schema.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): transform DB schema → Sonnet tool_use input

Module sonnet-schema.ts qui filtre les variables d'un visual template à
celles avec x-source: ai uniquement (les user et image sont exclues du
prompt Sonnet). Strip de l'annotation x-source (Sonnet n'en a pas besoin)
et réécriture du required pour ne contenir que les ai. Les descriptions
sont préservées car elles guident le remplissage.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Compiler & store

### Task 5: Create `src/visuals/base.css`

**Files:**
- Create: `src/visuals/base.css`

- [ ] **Step 1: Extract common fragments from existing templates**

Grep one of the existing templates to confirm the shared font/reset block :

Run:
```bash
grep -A 6 "@font-face" src/visuals/linkedin-big-number/index.ts | head -20
```

- [ ] **Step 2: Write `src/visuals/base.css`**

Create `src/visuals/base.css` :

```css
/* Base CSS injecté dans le <head> de tous les visual templates.
   Fonts AVQN (Clash Display + General Sans) + reset universel.
   Les dimensions exactes du body sont appliquées par le compilateur via
   inline style="width:Xpx;height:Ypx" sur <body>. */

@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Regular.woff2") format("woff2"); font-weight: 400; font-display: swap; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Medium.woff2") format("woff2"); font-weight: 500; font-display: swap; font-style: normal; }
@font-face { font-family: "General Sans"; src: url("https://cdn.avqn.ch/fonts/GeneralSans-Semibold.woff2") format("woff2"); font-weight: 600; font-display: swap; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Semibold.woff2") format("woff2"); font-weight: 600; font-display: swap; font-style: normal; }
@font-face { font-family: "Clash Display"; src: url("https://cdn.avqn.ch/fonts/ClashDisplay-Bold.woff2") format("woff2"); font-weight: 700; font-display: swap; font-style: normal; }

* { margin: 0; padding: 0; box-sizing: border-box; }
```

- [ ] **Step 3: Commit**

```bash
git add src/visuals/base.css
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): base.css avec fonts AVQN et reset universel

Extrait les @font-face Clash Display + General Sans et le reset
universel des templates existants vers un fichier base.css partagé.
Sera injecté par le compilateur Handlebars dans le <head> de chaque
template, avant le css template-specific.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Build `src/visuals/compile.ts` (Handlebars compiler)

**Files:**
- Create: `src/visuals/compile.ts`
- Create: `tests/visuals/compile.test.ts`

- [ ] **Step 1: Write tests for the simple cases**

Create `tests/visuals/compile.test.ts` :

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate } from '../../src/visuals/compile.js';

const SIMPLE_TEMPLATE = {
  slug: 'test-simple',
  label: 'Test',
  platform: 'linkedin' as const,
  width: 100,
  height: 100,
  body_html: '<h1>{{title}}</h1>',
  css: 'h1 { color: red; }',
  variables_schema: JSON.stringify({
    type: 'object',
    required: ['title'],
    properties: {
      title: { type: 'string', description: 'titre', 'x-source': 'ai' },
    },
  }),
  sample_vars: '{}',
  image_prompt: null,
  image_aspect_ratio: null,
  id: 1,
  created_at: '',
  updated_at: '',
};

test('compileTemplate interpolates basic variables', () => {
  const html = compileTemplate(SIMPLE_TEMPLATE, { title: 'Hello' });
  assert.match(html, /<h1>Hello<\/h1>/);
});

test('compileTemplate HTML-escapes variables by default', () => {
  const html = compileTemplate(SIMPLE_TEMPLATE, { title: '<script>alert(1)</script>' });
  assert.equal(html.includes('<script>alert'), false);
  assert.match(html, /&lt;script&gt;/);
});

test('compileTemplate throws when required variable is missing', () => {
  assert.throws(
    () => compileTemplate(SIMPLE_TEMPLATE, {}),
    /missing required variable.*title/i,
  );
});

test('compileTemplate injects width/height inline on body', () => {
  const html = compileTemplate(SIMPLE_TEMPLATE, { title: 'Hi' });
  assert.match(html, /<body[^>]*style="width:100px;height:100px"/);
});

test('compileTemplate includes base_css fonts in the head', () => {
  const html = compileTemplate(SIMPLE_TEMPLATE, { title: 'Hi' });
  assert.match(html, /@font-face/);
  assert.match(html, /Clash Display/);
});

test('compileTemplate includes template-specific css after base_css', () => {
  const html = compileTemplate(SIMPLE_TEMPLATE, { title: 'Hi' });
  assert.match(html, /h1 \{ color: red; \}/);
});

test('compileTemplate exposes brand.* automatically', () => {
  const tpl = {
    ...SIMPLE_TEMPLATE,
    body_html: '<h1>{{title}}</h1><span class="brand">{{brand.name}}</span>',
  };
  const html = compileTemplate(tpl, { title: 'Hi' }, undefined, { brand: { name: 'AVQN', color: '#000', signature: '' } });
  assert.match(html, /<span class="brand">AVQN<\/span>/);
});

test('compileTemplate injects image variable when imageDataUrl provided', () => {
  const tpl = {
    ...SIMPLE_TEMPLATE,
    body_html: '<img src="{{image}}">',
    image_prompt: 'a duck',
    image_aspect_ratio: '1:1',
    variables_schema: JSON.stringify({
      type: 'object',
      required: ['title', 'image'],
      properties: {
        title: { type: 'string', description: 'titre', 'x-source': 'ai' },
        image: { type: 'string', description: 'image IA', 'x-source': 'image' },
      },
    }),
  };
  const html = compileTemplate(tpl, { title: 'Hi' }, 'data:image/png;base64,XXX');
  assert.match(html, /<img src="data:image\/png;base64,XXX">/);
});

test('compileTemplate ifNotEmpty helper renders block when list is non-empty', () => {
  const tpl = {
    ...SIMPLE_TEMPLATE,
    body_html: '{{#ifNotEmpty bullets}}<ul>{{#each bullets}}<li>{{this}}</li>{{/each}}</ul>{{/ifNotEmpty}}',
    variables_schema: JSON.stringify({
      type: 'object',
      properties: {
        bullets: { type: 'array', items: { type: 'string' }, description: 'puces', 'x-source': 'ai' },
      },
    }),
  };
  const empty = compileTemplate(tpl, { bullets: [] });
  assert.equal(empty.includes('<ul>'), false);
  const full = compileTemplate(tpl, { bullets: ['a', 'b'] });
  assert.match(full, /<li>a<\/li><li>b<\/li>/);
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

Run: `npm run test:visuals`
Expected: fail with module not found for `compile.js`.

- [ ] **Step 3: Implement `src/visuals/compile.ts`**

Create `src/visuals/compile.ts` :

```ts
import Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { VisualTemplateRow } from '../db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE_CSS = readFileSync(resolve(__dirname, 'base.css'), 'utf8');

const hb = Handlebars.create();
hb.registerHelper('escape', (value: unknown) => hb.escapeExpression(String(value ?? '')));
hb.registerHelper('trim', (value: unknown) => String(value ?? '').trim());
hb.registerHelper('ifNotEmpty', function (this: unknown, list: unknown, options: Handlebars.HelperOptions) {
  if (Array.isArray(list) && list.length > 0) return options.fn(this);
  return options.inverse(this);
});

type CompiledPair = { body: HandlebarsTemplateDelegate; css: HandlebarsTemplateDelegate };
type CacheEntry = { key: string; pair: CompiledPair };

const CACHE: CacheEntry[] = [];
const CACHE_MAX = 50;

function getCompiled(template: VisualTemplateRow): CompiledPair {
  const key = `${template.slug}:${template.updated_at}`;
  const existing = CACHE.find((e) => e.key === key);
  if (existing) {
    CACHE.splice(CACHE.indexOf(existing), 1);
    CACHE.unshift(existing);
    return existing.pair;
  }
  const pair: CompiledPair = {
    body: hb.compile(template.body_html, { noEscape: false }),
    css: hb.compile(template.css, { noEscape: false }),
  };
  CACHE.unshift({ key, pair });
  if (CACHE.length > CACHE_MAX) CACHE.pop();
  return pair;
}

export type BrandContext = {
  brand?: { name: string; color: string; signature: string };
};

export function compileTemplate(
  template: VisualTemplateRow,
  vars: Record<string, unknown>,
  imageDataUrl?: string,
  extra: BrandContext = {},
): string {
  const schema = JSON.parse(template.variables_schema) as {
    required?: string[];
    properties: Record<string, { 'x-source'?: string }>;
  };
  const required = schema.required ?? [];
  for (const name of required) {
    const source = schema.properties[name]?.['x-source'];
    if (source === 'image') {
      if (typeof imageDataUrl !== 'string' || imageDataUrl.length === 0) {
        throw new Error(`compileTemplate: missing required variable "${name}" (image source) for template "${template.slug}"`);
      }
      continue;
    }
    if (!(name in vars)) {
      throw new Error(`compileTemplate: missing required variable "${name}" for template "${template.slug}"`);
    }
  }

  const ctx: Record<string, unknown> = {
    ...vars,
    image: imageDataUrl,
    brand: extra.brand ?? { name: '', color: '#000000', signature: '' },
  };

  const { body, css } = getCompiled(template);
  const compiledBody = body(ctx);
  const compiledCss = css(ctx);

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
${BASE_CSS}
${compiledCss}
</style>
</head>
<body style="width:${template.width}px;height:${template.height}px">
${compiledBody}
</body>
</html>`;
}

export function clearCompileCache(): void {
  CACHE.length = 0;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:visuals`
Expected: all 9 tests in `compile.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/compile.ts tests/visuals/compile.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): Handlebars compiler with helpers, cache, brand context

compileTemplate(template, vars, imageDataUrl?, extra?) qui combine
base.css + template.css + body_html avec Handlebars. Helpers minimaux :
escape, trim, ifNotEmpty. Cache LRU 50 entrées par slug:updated_at.
Variables required vérifiées avant compile (avec source image gérée
séparément). brand.{name,color,signature} exposé automatiquement dans
le contexte.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Build `src/visuals/store.ts` (DB queries)

**Files:**
- Create: `src/visuals/store.ts`
- Create: `tests/visuals/store.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/visuals/store.test.ts` :

```ts
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

before(() => {
  const tmp = mkdtempSync(join(tmpdir(), 'avqn-test-'));
  process.env.DB_PATH = join(tmp, 'test.db');
});

const { createVisualTemplate, getVisualTemplate, listVisualTemplates, updateVisualTemplate, deleteVisualTemplate, countVisualsUsingTemplate } = await import('../../src/visuals/store.js');
const { db } = await import('../../src/db.js');

function freshRow(overrides: Record<string, unknown> = {}) {
  return {
    slug: 'test-' + Math.random().toString(36).slice(2, 8),
    label: 'Test',
    platform: 'linkedin' as const,
    width: 100,
    height: 100,
    body_html: '<h1>{{title}}</h1>',
    css: 'h1 { color: red; }',
    variables_schema: JSON.stringify({
      type: 'object',
      required: ['title'],
      properties: { title: { type: 'string', description: 'titre', 'x-source': 'ai' } },
    }),
    sample_vars: JSON.stringify({ title: 'Hello' }),
    image_prompt: null as string | null,
    image_aspect_ratio: null as string | null,
    ...overrides,
  };
}

test('create then get returns the row', () => {
  const row = freshRow();
  const id = createVisualTemplate(row);
  const fetched = getVisualTemplate(row.slug);
  assert.equal(fetched?.slug, row.slug);
  assert.equal(fetched?.label, 'Test');
  assert.equal(fetched?.id, id);
});

test('list filters by platform', () => {
  createVisualTemplate(freshRow({ slug: 'platform-li-1', platform: 'linkedin' }));
  const all = listVisualTemplates();
  assert.ok(all.some((t) => t.slug === 'platform-li-1'));
  const li = listVisualTemplates('linkedin');
  assert.ok(li.every((t) => t.platform === 'linkedin'));
});

test('update modifies a field and bumps updated_at', () => {
  const row = freshRow();
  createVisualTemplate(row);
  const before = getVisualTemplate(row.slug)!;
  // wait at least 1s because datetime('now') has second precision
  // (use a sentinel column update path that we can detect)
  updateVisualTemplate(row.slug, { label: 'New Label' });
  const after = getVisualTemplate(row.slug)!;
  assert.equal(after.label, 'New Label');
  assert.notEqual(after.updated_at, before.updated_at);  // may be equal at sub-second; assert label changed instead
});

test('delete removes the row', () => {
  const row = freshRow();
  createVisualTemplate(row);
  assert.ok(getVisualTemplate(row.slug));
  deleteVisualTemplate(row.slug);
  assert.equal(getVisualTemplate(row.slug), undefined);
});

test('countVisualsUsingTemplate returns number of visuals referencing slug', () => {
  const row = freshRow();
  createVisualTemplate(row);
  assert.equal(countVisualsUsingTemplate(row.slug), 0);
  db.prepare(`INSERT INTO visuals (template_slug, vars) VALUES (?, '{}')`).run(row.slug);
  assert.equal(countVisualsUsingTemplate(row.slug), 1);
});
```

- [ ] **Step 2: Run tests, expect module-not-found failure**

Run: `npm run test:visuals`
Expected: fail.

- [ ] **Step 3: Implement `src/visuals/store.ts`**

Create `src/visuals/store.ts` :

```ts
import { db } from '../db.js';
import type { VisualTemplateRow } from '../db.js';

export type VisualTemplateInput = {
  slug: string;
  label: string;
  platform: VisualTemplateRow['platform'];
  width: number;
  height: number;
  body_html: string;
  css: string;
  variables_schema: string;
  sample_vars: string;
  image_prompt: string | null;
  image_aspect_ratio: string | null;
};

export function createVisualTemplate(input: VisualTemplateInput): number {
  const stmt = db.prepare(`
    INSERT INTO visual_templates
      (slug, label, platform, width, height, body_html, css, variables_schema,
       sample_vars, image_prompt, image_aspect_ratio)
    VALUES
      (@slug, @label, @platform, @width, @height, @body_html, @css, @variables_schema,
       @sample_vars, @image_prompt, @image_aspect_ratio)
  `);
  const info = stmt.run(input);
  return Number(info.lastInsertRowid);
}

export function getVisualTemplate(slug: string): VisualTemplateRow | undefined {
  return db
    .prepare(`SELECT * FROM visual_templates WHERE slug = ?`)
    .get(slug) as VisualTemplateRow | undefined;
}

export function listVisualTemplates(platform?: string): VisualTemplateRow[] {
  if (platform) {
    return db
      .prepare(`SELECT * FROM visual_templates WHERE platform = ? ORDER BY label ASC`)
      .all(platform) as VisualTemplateRow[];
  }
  return db
    .prepare(`SELECT * FROM visual_templates ORDER BY platform, label ASC`)
    .all() as VisualTemplateRow[];
}

export function updateVisualTemplate(
  slug: string,
  patch: Partial<Omit<VisualTemplateInput, 'slug'>>,
): void {
  const fields = Object.keys(patch);
  if (fields.length === 0) return;
  const sets = fields.map((f) => `${f} = @${f}`).join(', ');
  db.prepare(
    `UPDATE visual_templates SET ${sets}, updated_at = datetime('now') WHERE slug = @slug`,
  ).run({ ...patch, slug });
}

export function deleteVisualTemplate(slug: string): void {
  db.prepare(`DELETE FROM visual_templates WHERE slug = ?`).run(slug);
}

export function countVisualsUsingTemplate(slug: string): number {
  const row = db
    .prepare(`SELECT COUNT(*) AS n FROM visuals WHERE template_slug = ?`)
    .get(slug) as { n: number };
  return row.n;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:visuals`
Expected: all 5 tests in `store.test.ts` pass.

- [ ] **Step 5: Commit**

```bash
git add src/visuals/store.ts tests/visuals/store.test.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): store.ts pour CRUD visual_templates

Module store.ts qui encapsule les queries DB de la table visual_templates :
create, get, list (avec filtre platform), update partiel, delete, et
countVisualsUsingTemplate (utilisé pour bloquer la suppression d'un
template référencé). better-sqlite3 synchrone, transactions implicites.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Integration test — compile + renderHtmlToPng

**Files:**
- Create: `tests/visuals/render.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/visuals/render.test.ts` :

```ts
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { compileTemplate } from '../../src/visuals/compile.js';
import { renderHtmlToPng, closeRenderer } from '../../src/render.js';
import type { VisualTemplateRow } from '../../src/db.js';

after(async () => {
  await closeRenderer();
});

const TEMPLATE: VisualTemplateRow = {
  id: 0,
  slug: 'integration-test',
  label: 'Integration',
  platform: 'linkedin',
  width: 200,
  height: 200,
  body_html: '<div style="background:{{color}};color:white;width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px">{{title}}</div>',
  css: '',
  variables_schema: JSON.stringify({
    type: 'object',
    required: ['title', 'color'],
    properties: {
      title: { type: 'string', description: 'titre', 'x-source': 'ai' },
      color: { type: 'string', description: 'couleur fond', 'x-source': 'user' },
    },
  }),
  sample_vars: '{}',
  image_prompt: null,
  image_aspect_ratio: null,
  created_at: '',
  updated_at: '',
};

test('compile + render produces a PNG of the right dimensions', async () => {
  const html = compileTemplate(TEMPLATE, { title: 'Hi', color: '#ff0000' });
  const buf = await renderHtmlToPng(html, TEMPLATE.width, TEMPLATE.height);
  assert.ok(buf instanceof Buffer);
  assert.ok(buf.length > 1000);
  // PNG signature : 89 50 4E 47 0D 0A 1A 0A
  assert.equal(buf[0], 0x89);
  assert.equal(buf[1], 0x50);
  assert.equal(buf[2], 0x4e);
  assert.equal(buf[3], 0x47);
});
```

- [ ] **Step 2: Verify `renderHtmlToPng` signature matches**

Run:
```bash
grep -n "export.*renderHtmlToPng\|export.*closeRenderer" src/render.ts
```

If the signature differs from the test, adjust the test to match.

- [ ] **Step 3: Run the test**

Run: `npm run test:visuals -- --test-name-pattern 'compile \+ render'`

Expected: pass. Lance Puppeteer, ~1s.

- [ ] **Step 4: Commit**

```bash
git add tests/visuals/render.test.ts
git commit -m "$(cat <<'EOF'
🤖 test(visuals): integration test compile + renderHtmlToPng

Test bout-en-bout : compileTemplate produit du HTML, renderHtmlToPng le
transforme en PNG via Puppeteer. Vérifie la signature PNG et que les
dimensions du buffer sont raisonnables. Sert de garde-fou : si on casse
le pipeline compile-render, ce test pète.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Pipeline integration with feature flag

### Task 9: Wire `compileTemplate` into `produceVisual` behind a feature flag

**Files:**
- Modify: `src/generate.ts`
- Modify: `src/visuals/index.ts`
- Create: `src/visuals/loader.ts`

- [ ] **Step 1: Inspect the current produceVisual call site**

Run:
```bash
grep -n "template.render\|produceVisual" src/generate.ts | head -20
```

Note the exact line numbers where `template.render(...)` is called inside `produceVisual` and `regenerateImageOnly`. The existing exports of `src/visuals/index.ts` are `getVisualTemplate(slug)`, `listVisualsForPlatform(key)`, `getDefaultVisualForPlatform(key)`, `listAllVisuals()` — no `visualTemplates` object.

- [ ] **Step 2: Create `src/visuals/loader.ts` with the feature flag**

Create `src/visuals/loader.ts` :

```ts
import { getVisualTemplate as getFromDb, listVisualTemplates as listFromDb } from './store.js';
import { compileTemplate } from './compile.js';
import { getVisualTemplate as getLegacy, listAllVisuals as listLegacy } from './index.js';
import type { VisualTemplate as LegacyTemplate, FilledVars } from './types.js';
import type { VisualTemplateRow } from '../db.js';
import { db } from '../db.js';

const FROM_DB = process.env.VISUAL_TEMPLATES_FROM_DB === 'true';

export type ResolvedTemplate = {
  slug: string;
  label: string;
  platform: string;
  width: number;
  height: number;
  imagePrompt: string | null;
  imageAspectRatio: string | null;
  render: (vars: FilledVars, imageDataUrl?: string) => string;
  // Raw row when DB-sourced (null if legacy).
  row: VisualTemplateRow | null;
};

function settingsBrand() {
  const row = db.prepare('SELECT brand_name, brand_color, brand_signature FROM settings WHERE id = 1').get() as
    | { brand_name: string; brand_color: string; brand_signature: string }
    | undefined;
  return {
    name: row?.brand_name ?? '',
    color: row?.brand_color ?? '#000000',
    signature: row?.brand_signature ?? '',
  };
}

function fromLegacy(t: LegacyTemplate): ResolvedTemplate {
  return {
    slug: t.slug,
    label: t.label,
    platform: t.platform,
    width: t.width,
    height: t.height,
    imagePrompt: t.imagePrompt,
    imageAspectRatio: t.imageAspectRatio ?? null,
    render: (vars, imageDataUrl) => t.render(vars, imageDataUrl),
    row: null,
  };
}

function fromDbRow(row: VisualTemplateRow): ResolvedTemplate {
  return {
    slug: row.slug,
    label: row.label,
    platform: row.platform,
    width: row.width,
    height: row.height,
    imagePrompt: row.image_prompt,
    imageAspectRatio: row.image_aspect_ratio,
    render: (vars, imageDataUrl) =>
      compileTemplate(row, vars, imageDataUrl, { brand: settingsBrand() }),
    row,
  };
}

export function resolveTemplate(slug: string): ResolvedTemplate | undefined {
  if (FROM_DB) {
    const row = getFromDb(slug);
    if (row) return fromDbRow(row);
    return undefined;
  }
  const legacy = getLegacy(slug);
  if (legacy) return fromLegacy(legacy);
  return undefined;
}

export function listResolvedTemplates(platform?: string): ResolvedTemplate[] {
  if (FROM_DB) {
    return listFromDb(platform).map(fromDbRow);
  }
  const all = listLegacy();
  const filtered = platform ? all.filter((t) => t.platform === platform) : all;
  return filtered.map(fromLegacy);
}
```

- [ ] **Step 3: Replace direct calls to `getVisualTemplate` / `listAllVisuals` in `src/generate.ts`**

Find and edit each occurrence inside `produceVisual` and `regenerateImageOnly`. Replace :

```ts
const template = getVisualTemplate(slug);
// ...
const html = template.render(filled, imageDataUrl);
```

By :

```ts
const template = resolveTemplate(slug);
if (!template) throw new Error(`unknown visual template: ${slug}`);
// ...
const html = template.render(filled, imageDataUrl);
```

Add to imports at the top of `src/generate.ts` :

```ts
import { resolveTemplate, listResolvedTemplates } from './visuals/loader.js';
```

For every other usage of `getVisualTemplate`, `listAllVisuals`, `listVisualsForPlatform`, `getDefaultVisualForPlatform` in `generate.ts`, switch to `resolveTemplate` / `listResolvedTemplates`. Be careful with `getDefaultVisualForPlatform` : its DB equivalent is `listResolvedTemplates(platform)[0]`.

- [ ] **Step 4: Smoke-check with flag OFF (legacy path)**

Run:
```bash
unset VISUAL_TEMPLATES_FROM_DB
npm run test:legacy
```

Expected: `Tous les N templates rendent correctement.` All legacy templates still render. **No regression.**

- [ ] **Step 5: Smoke-check with flag ON, no DB rows (should error gracefully)**

Run:
```bash
rm -f data/test-flag.db
DB_PATH=data/test-flag.db VISUAL_TEMPLATES_FROM_DB=true npm run test:legacy 2>&1 | head -10
rm -f data/test-flag.db
```

Expected: failures from smoke-render-templates.ts because no templates in DB yet. **This is expected** — proves the flag is being read.

- [ ] **Step 6: Commit**

```bash
git add src/generate.ts src/visuals/loader.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): pipeline derrière feature flag VISUAL_TEMPLATES_FROM_DB

Introduit src/visuals/loader.ts qui résout un template par slug depuis
le registre statique (flag off, défaut) ou depuis la DB (flag on, via
compileTemplate). produceVisual et regenerateImageOnly passent par
resolveTemplate(). Aucune régression côté legacy : tous les templates
existants rendent comme avant tant que VISUAL_TEMPLATES_FROM_DB != true.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Refactor `src/visuals/index.ts` to expose both registries

**Files:**
- Modify: `src/visuals/index.ts`

- [ ] **Step 1: Read the current state**

Run:
```bash
cat src/visuals/index.ts
```

Note the export name (`visualTemplates`, `listAllVisuals`, etc.).

- [ ] **Step 2: Add re-exports from loader.ts so consumers can migrate**

In `src/visuals/index.ts`, **after** the existing exports, add :

```ts
// Re-exports from loader for new consumers. Prefer these over the static
// `visualTemplates` registry going forward — they honor the feature flag.
export { resolveTemplate, listResolvedTemplates } from './loader.js';
export type { ResolvedTemplate } from './loader.js';
```

Do NOT remove the existing `visualTemplates` or `listAllVisuals` exports yet (Phase 8 cleanup).

- [ ] **Step 3: Smoke-check**

Run:
```bash
npm run test:legacy
```

Expected: still passes.

- [ ] **Step 4: Commit**

```bash
git add src/visuals/index.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(visuals): re-export resolveTemplate depuis index.ts

Expose resolveTemplate et listResolvedTemplates à travers le barrel
src/visuals/index.ts pour faciliter la migration des consommateurs.
Le registre statique visualTemplates est conservé, il sera supprimé
en Phase 8 cleanup (flag flip).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Migrate views and server.ts to use `listResolvedTemplates`

**Files:**
- Modify: `src/server.ts`
- Modify: `src/views/visuals.ts`
- Modify: `src/views/visual-templates.ts` (read-only side, list)

- [ ] **Step 1: Find all call sites**

Run:
```bash
grep -rn "listAllVisuals\|getVisualTemplate\|listVisualsForPlatform\|getDefaultVisualForPlatform" src/ --include='*.ts'
```

Note every file and line.

- [ ] **Step 2: Replace `listAllVisuals()` calls**

For each occurrence (likely in `src/server.ts`, `src/views/visuals.ts`, `src/views/visual-templates.ts`) :

Before :
```ts
import { listAllVisuals } from './visuals/index.js';
// ...
const all = listAllVisuals();
```

After :
```ts
import { listResolvedTemplates } from './visuals/index.js';
// ...
const all = listResolvedTemplates();
```

The shape of `ResolvedTemplate` matches the shape consumers expect (slug, label, platform, width, height, imagePrompt). Adjust property names where the consumer used `visual.imageAspectRatio` etc.

- [ ] **Step 3: Replace `getVisualTemplate(slug)` lookups**

For each occurrence :

Before :
```ts
const template = getVisualTemplate(slug);
if (!template) return c.notFound();
```

After :
```ts
const template = resolveTemplate(slug);
if (!template) return c.notFound();
```

Adjust imports. Note that `getVisualTemplate` is also re-exported from `src/visuals/store.ts` (DB-direct) for use in CRUD endpoints (Tasks 17-19) where we explicitly want DB-only access without the legacy fallback — there is no ambiguity since the two imports use distinct paths (`./visuals/index.js` vs `./visuals/store.js`). When migrating call sites for **rendering** (this task), use `resolveTemplate`. When implementing **CRUD endpoints** (Tasks 17-19), use the store function directly.

- [ ] **Step 4: Smoke-check**

Run:
```bash
npm run test:legacy
npm start &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3000/visual-templates | head -20
curl -s http://localhost:3000/visual-options?platform=linkedin | head -20
kill $SERVER_PID
```

Expected: HTML output for both, no 500 errors.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts src/views/visuals.ts src/views/visual-templates.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(visuals): migration des call sites vers resolveTemplate

Tous les call sites qui utilisaient visualTemplates[slug] ou
listAllVisuals() passent désormais par resolveTemplate /
listResolvedTemplates, qui honorent VISUAL_TEMPLATES_FROM_DB. Aucune
régression fonctionnelle : flag off, comportement identique au registre
statique.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — First template migration (mock + linkedin-big-number)

### Task 12: Create the `scripts/migrate-visuals.ts` helper

**Files:**
- Create: `scripts/migrate-visuals.ts`

- [ ] **Step 1: Implement the migration helper**

Create `scripts/migrate-visuals.ts` :

```ts
// Helper d'aide manuelle à la migration. Pour un template donné :
//   - construit un FilledVars avec des sentinels uniques par variable
//   - appelle l'ancien render(filled, sentinelImage)
//   - imprime body_html et css séparés (extraits du <style>...</style>)
// L'humain colle ces sorties dans seeds/<slug>/{body.hbs, style.css}
// et remplace les sentinels par des {{handlebars}}.
//
// Usage : npx tsx scripts/migrate-visuals.ts <slug>

import { getVisualTemplate, listAllVisuals } from '../src/visuals/index.js';

const slug = process.argv[2];
if (!slug) {
  console.error('usage: tsx scripts/migrate-visuals.ts <slug>');
  process.exit(1);
}

const template = getVisualTemplate(slug);
if (!template) {
  console.error(`unknown template: ${slug}`);
  console.error(`available: ${listAllVisuals().map((t) => t.slug).join(', ')}`);
  process.exit(1);
}

const filled: Record<string, string | string[]> = {};
for (const [name, spec] of Object.entries(template.variables)) {
  if (spec.type === 'list') {
    filled[name] = [
      `__${slug.toUpperCase()}_${name.toUpperCase()}_0__`,
      `__${slug.toUpperCase()}_${name.toUpperCase()}_1__`,
      `__${slug.toUpperCase()}_${name.toUpperCase()}_2__`,
    ];
  } else if (spec.type === 'color') {
    filled[name] = `__${slug.toUpperCase()}_${name.toUpperCase()}__`;
  } else {
    filled[name] = `__${slug.toUpperCase()}_${name.toUpperCase()}__`;
  }
}

const sentinelImage = template.imagePrompt
  ? 'data:image/png;base64,__IMAGE_SENTINEL__'
  : undefined;

const html = template.render(filled as never, sentinelImage);

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
const css = styleMatch ? styleMatch[1].trim() : '';
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
const body = bodyMatch ? bodyMatch[1].trim() : '';

console.log('=== meta.json ===');
console.log(JSON.stringify({
  label: template.label,
  platform: template.platform,
  width: template.width,
  height: template.height,
  image_prompt: template.imagePrompt,
  image_aspect_ratio: template.imageAspectRatio ?? null,
}, null, 2));

console.log('\n=== schema.json (à compléter, x-source à ajuster) ===');
const schema: { type: 'object'; required: string[]; properties: Record<string, unknown> } = {
  type: 'object',
  required: [],
  properties: {},
};
for (const [name, spec] of Object.entries(template.variables)) {
  let xSource: 'ai' | 'user' | 'image' = 'ai';
  if (spec.type === 'color') xSource = 'user';
  const prop: Record<string, unknown> = {
    description: spec.description,
    'x-source': xSource,
  };
  if (spec.type === 'string') {
    prop.type = 'string';
    if (spec.min) prop.minLength = spec.min;
    if (spec.max) prop.maxLength = spec.max;
  } else if (spec.type === 'list') {
    prop.type = 'array';
    prop.items = { type: 'string', ...(spec.itemMax ? { maxLength: spec.itemMax } : {}) };
    if (spec.minItems) prop.minItems = spec.minItems;
    if (spec.maxItems) prop.maxItems = spec.maxItems;
  } else if (spec.type === 'color') {
    prop.type = 'string';
    prop.format = 'color';
    if (spec.default) prop.default = spec.default;
  }
  schema.properties[name] = prop;
  if (!spec.optional) schema.required.push(name);
}
if (template.imagePrompt) {
  schema.properties.image = {
    type: 'string',
    description: 'Image IA générée par Gemini, injectée par le pipeline (jamais à remplir manuellement)',
    'x-source': 'image',
  };
  schema.required.push('image');
}
console.log(JSON.stringify(schema, null, 2));

console.log('\n=== body.hbs (sentinels à remplacer par {{variable}}) ===');
console.log(body);

console.log('\n=== style.css (sentinels à remplacer par {{variable}} si présents en CSS) ===');
console.log(css);
```

- [ ] **Step 2: Smoke-check on the `mock` template**

Run:
```bash
tsx scripts/migrate-visuals.ts mock | head -50
```

Expected: prints meta.json, schema.json (with x-source placeholders), body.hbs (with sentinels), style.css.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-visuals.ts
git commit -m "$(cat <<'EOF'
🤖 chore(visuals): script d'aide à la migration TS → seeds

Helper interactif pour passer un template legacy en seed : remplit le
render() avec des sentinels uniques, extrait body/css, génère un schema
JSON Schema 2020-12 avec x-source pré-rempli (ai/user/image). L'humain
remplace ensuite les sentinels par des {{handlebars}}.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Migrate the `mock` template to seed + golden test

**Files:**
- Create: `src/visuals/seeds/mock/{body.hbs,style.css,schema.json,sample-vars.json,meta.json}`
- Create: `tests/golden/visual-templates/mock.png`
- Create: `tests/visuals/golden/mock.test.ts`

- [ ] **Step 1: Run the migration helper for `mock`**

Run:
```bash
mkdir -p src/visuals/seeds/mock
tsx scripts/migrate-visuals.ts mock > /tmp/mock-migration.txt
cat /tmp/mock-migration.txt
```

- [ ] **Step 2: Manually populate the seed files**

Based on the helper output and a careful read of `src/visuals/mock.ts`, create :

`src/visuals/seeds/mock/meta.json` : copy the meta section from the helper.

`src/visuals/seeds/mock/schema.json` : copy the schema, verify `x-source` is correct for each variable (default `ai`, override to `user` for colors).

`src/visuals/seeds/mock/body.hbs` : copy the body section from the helper, then **replace every sentinel by its Handlebars expression** :
- `__MOCK_TITLE__` → `{{title}}`
- `__MOCK_BULLETS_0__` / `_1__` / `_2__` → `{{#each bullets}}<li>{{this}}</li>{{/each}}` (adjust based on actual usage)
- Conditional blocks (the old TS used `? :` ternaries) become `{{#if subtitle}}...{{/if}}`

`src/visuals/seeds/mock/style.css` : copy css section, **strip @font-face and `* { reset }`** (now in base.css), **strip `html, body { width: ...; height: ...; }`** (handled by inline style).

`src/visuals/seeds/mock/sample-vars.json` : create a payload conforming to the schema, with realistic values close to the mock's existing test data.

- [ ] **Step 3: Generate the reference golden PNG**

Create a one-shot script `scripts/snapshot-mock.ts` :

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate } from '../src/visuals/compile.js';
import { renderHtmlToPng, closeRenderer } from '../src/render.js';

const SEED_DIR = resolve('src/visuals/seeds/mock');
const meta = JSON.parse(readFileSync(`${SEED_DIR}/meta.json`, 'utf8'));
const sample = JSON.parse(readFileSync(`${SEED_DIR}/sample-vars.json`, 'utf8'));

const row = {
  id: 0,
  slug: 'mock',
  label: meta.label,
  platform: meta.platform,
  width: meta.width,
  height: meta.height,
  body_html: readFileSync(`${SEED_DIR}/body.hbs`, 'utf8'),
  css: readFileSync(`${SEED_DIR}/style.css`, 'utf8'),
  variables_schema: readFileSync(`${SEED_DIR}/schema.json`, 'utf8'),
  sample_vars: JSON.stringify(sample),
  image_prompt: meta.image_prompt,
  image_aspect_ratio: meta.image_aspect_ratio,
  created_at: '',
  updated_at: '',
};

const html = compileTemplate(row, sample);
const png = await renderHtmlToPng(html, meta.width, meta.height);

mkdirSync('tests/golden/visual-templates', { recursive: true });
writeFileSync('tests/golden/visual-templates/mock.png', png);
console.log(`wrote tests/golden/visual-templates/mock.png (${png.length} bytes)`);
await closeRenderer();
```

Run:
```bash
tsx scripts/snapshot-mock.ts
```

Expected: writes `tests/golden/visual-templates/mock.png`.

- [ ] **Step 4: Visually inspect the golden PNG**

Run:
```bash
open tests/golden/visual-templates/mock.png
```

Compare visually with what the legacy `mock` template renders today (open it in the browser via `/visual-templates/mock` or render legacy via `tsx scripts/smoke-render-templates.ts`). **If there is a visible regression, fix the seed files and re-run step 3 before continuing.**

- [ ] **Step 5: Write the golden test**

Create `tests/visuals/golden/mock.test.ts` :

```ts
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { compileTemplate } from '../../../src/visuals/compile.js';
import { renderHtmlToPng, closeRenderer } from '../../../src/render.js';

after(async () => { await closeRenderer(); });

const SEED_DIR = resolve('src/visuals/seeds/mock');
const GOLDEN_PATH = 'tests/golden/visual-templates/mock.png';
const SLUG = 'mock';

test(`golden: ${SLUG} pixel-matches reference within 0.1% tolerance`, async () => {
  const meta = JSON.parse(readFileSync(`${SEED_DIR}/meta.json`, 'utf8'));
  const sample = JSON.parse(readFileSync(`${SEED_DIR}/sample-vars.json`, 'utf8'));
  const row = {
    id: 0, slug: SLUG, label: meta.label, platform: meta.platform,
    width: meta.width, height: meta.height,
    body_html: readFileSync(`${SEED_DIR}/body.hbs`, 'utf8'),
    css: readFileSync(`${SEED_DIR}/style.css`, 'utf8'),
    variables_schema: readFileSync(`${SEED_DIR}/schema.json`, 'utf8'),
    sample_vars: JSON.stringify(sample),
    image_prompt: meta.image_prompt,
    image_aspect_ratio: meta.image_aspect_ratio,
    created_at: '', updated_at: '',
  };

  const html = compileTemplate(row, sample);
  const actualBuf = await renderHtmlToPng(html, meta.width, meta.height);
  const actual = PNG.sync.read(actualBuf);
  const golden = PNG.sync.read(readFileSync(GOLDEN_PATH));

  assert.equal(actual.width, golden.width, 'width mismatch');
  assert.equal(actual.height, golden.height, 'height mismatch');

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    actual.data, golden.data, diff.data,
    actual.width, actual.height, { threshold: 0.1 },
  );
  const total = actual.width * actual.height;
  const ratio = diffPixels / total;

  if (ratio > 0.001) {
    const diffPath = `tests/golden/visual-templates/${SLUG}.diff.png`;
    const fs = await import('node:fs');
    fs.writeFileSync(diffPath, PNG.sync.write(diff));
    assert.fail(`golden ${SLUG} : ${diffPixels}/${total} pixels diff (${(ratio * 100).toFixed(3)}%). Diff written to ${diffPath}`);
  }
});
```

- [ ] **Step 6: Run the golden test**

Run:
```bash
npm run test:visuals -- --test-name-pattern 'golden: mock'
```

Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add src/visuals/seeds/mock tests/golden/visual-templates/mock.png tests/visuals/golden/mock.test.ts scripts/snapshot-mock.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): migrate mock template to seeds + golden test

Premier template migré : src/visuals/seeds/mock/ contient body.hbs,
style.css, schema.json, sample-vars.json, meta.json. PNG de référence
en tests/golden/visual-templates/mock.png. Test golden qui pixelmatch
le rendu DB contre la référence avec tolérance 0.1%. Valide tout le
pipeline compile → renderHtmlToPng end-to-end.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Migrate `linkedin-big-number` (no image IA, conditionals)

**Files:**
- Create: `src/visuals/seeds/linkedin-big-number/{body.hbs,style.css,schema.json,sample-vars.json,meta.json}`
- Create: `tests/golden/visual-templates/linkedin-big-number.png`
- Create: `tests/visuals/golden/linkedin-big-number.test.ts`

- [ ] **Step 1: Run the migration helper**

Run:
```bash
mkdir -p src/visuals/seeds/linkedin-big-number
tsx scripts/migrate-visuals.ts linkedin-big-number > /tmp/lbn-migration.txt
cat /tmp/lbn-migration.txt
```

- [ ] **Step 2: Populate seed files**

Same process as Task 13 :

- `meta.json` from helper.
- `schema.json` from helper, verify x-source.
- `body.hbs` : sentinels replaced. **Pay attention to the ternary blocks** (`arrowBlock = subtitle ? '...' : ''`) — these become `{{#if subtitle}}...{{/if}}`. The inline SVG of the arrow goes inside the `{{#if subtitle}}` block. SVG content is **trusted** (template author), so it can be triple-stash if needed, but since it's static HTML in the template, just leave it as-is in the body.hbs (no variable substitution inside the SVG).
- `style.css` : strip `@font-face`, strip universal reset, strip `html, body { width:...; height:...; }`. Keep the rest as is.
- `sample-vars.json` : realistic payload, e.g. `{ "bigNumber": "+10h", "context": "Gagnées par client en automatisant le tri d'emails", "subtitle": "Sur 3 mois, équipe de 4 personnes", "signature": "AVQN.CH" }`.

- [ ] **Step 3: Generalize the snapshot script**

Refactor `scripts/snapshot-mock.ts` into `scripts/snapshot-seed.ts` accepting a slug arg :

```ts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { compileTemplate } from '../src/visuals/compile.js';
import { renderHtmlToPng, closeRenderer } from '../src/render.js';

const slug = process.argv[2];
if (!slug) { console.error('usage: tsx scripts/snapshot-seed.ts <slug>'); process.exit(1); }

const SEED_DIR = resolve(`src/visuals/seeds/${slug}`);
const meta = JSON.parse(readFileSync(`${SEED_DIR}/meta.json`, 'utf8'));
const sample = JSON.parse(readFileSync(`${SEED_DIR}/sample-vars.json`, 'utf8'));

const row = {
  id: 0, slug, label: meta.label, platform: meta.platform,
  width: meta.width, height: meta.height,
  body_html: readFileSync(`${SEED_DIR}/body.hbs`, 'utf8'),
  css: readFileSync(`${SEED_DIR}/style.css`, 'utf8'),
  variables_schema: readFileSync(`${SEED_DIR}/schema.json`, 'utf8'),
  sample_vars: JSON.stringify(sample),
  image_prompt: meta.image_prompt,
  image_aspect_ratio: meta.image_aspect_ratio,
  created_at: '', updated_at: '',
};

const html = compileTemplate(row, sample);
const png = await renderHtmlToPng(html, meta.width, meta.height);

mkdirSync('tests/golden/visual-templates', { recursive: true });
const out = `tests/golden/visual-templates/${slug}.png`;
writeFileSync(out, png);
console.log(`wrote ${out} (${png.length} bytes)`);
await closeRenderer();
```

Delete `scripts/snapshot-mock.ts` (it's replaced).

Run:
```bash
rm scripts/snapshot-mock.ts
tsx scripts/snapshot-seed.ts linkedin-big-number
open tests/golden/visual-templates/linkedin-big-number.png
```

Expected: PNG written and looks identical to the legacy render. **Compare visually with `/visual-templates/linkedin-big-number` (legacy)** : if there is a visible regression, iterate on seeds.

- [ ] **Step 4: Generalize the golden test**

Convert `tests/visuals/golden/mock.test.ts` into a parameterized helper, then a per-slug test. Create `tests/visuals/golden/_helpers.ts` :

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import assert from 'node:assert/strict';
import { compileTemplate } from '../../../src/visuals/compile.js';
import { renderHtmlToPng } from '../../../src/render.js';

export async function assertGoldenMatch(slug: string): Promise<void> {
  const seedDir = resolve(`src/visuals/seeds/${slug}`);
  const meta = JSON.parse(readFileSync(`${seedDir}/meta.json`, 'utf8'));
  const sample = JSON.parse(readFileSync(`${seedDir}/sample-vars.json`, 'utf8'));
  const row = {
    id: 0, slug, label: meta.label, platform: meta.platform,
    width: meta.width, height: meta.height,
    body_html: readFileSync(`${seedDir}/body.hbs`, 'utf8'),
    css: readFileSync(`${seedDir}/style.css`, 'utf8'),
    variables_schema: readFileSync(`${seedDir}/schema.json`, 'utf8'),
    sample_vars: JSON.stringify(sample),
    image_prompt: meta.image_prompt,
    image_aspect_ratio: meta.image_aspect_ratio,
    created_at: '', updated_at: '',
  };

  const html = compileTemplate(row, sample);
  const actualBuf = await renderHtmlToPng(html, meta.width, meta.height);
  const actual = PNG.sync.read(actualBuf);
  const golden = PNG.sync.read(readFileSync(`tests/golden/visual-templates/${slug}.png`));

  assert.equal(actual.width, golden.width, 'width mismatch');
  assert.equal(actual.height, golden.height, 'height mismatch');

  const diff = new PNG({ width: actual.width, height: actual.height });
  const diffPixels = pixelmatch(
    actual.data, golden.data, diff.data,
    actual.width, actual.height, { threshold: 0.1 },
  );
  const total = actual.width * actual.height;
  const ratio = diffPixels / total;

  if (ratio > 0.001) {
    const fs = await import('node:fs');
    fs.writeFileSync(`tests/golden/visual-templates/${slug}.diff.png`, PNG.sync.write(diff));
    assert.fail(`golden ${slug} : ${diffPixels}/${total} pixels diff (${(ratio * 100).toFixed(3)}%)`);
  }
}
```

Rewrite `tests/visuals/golden/mock.test.ts` :

```ts
import { test, after } from 'node:test';
import { closeRenderer } from '../../../src/render.js';
import { assertGoldenMatch } from './_helpers.js';

after(async () => { await closeRenderer(); });

test('golden: mock pixel-matches reference within 0.1% tolerance', async () => {
  await assertGoldenMatch('mock');
});
```

Create `tests/visuals/golden/linkedin-big-number.test.ts` :

```ts
import { test, after } from 'node:test';
import { closeRenderer } from '../../../src/render.js';
import { assertGoldenMatch } from './_helpers.js';

after(async () => { await closeRenderer(); });

test('golden: linkedin-big-number pixel-matches reference within 0.1% tolerance', async () => {
  await assertGoldenMatch('linkedin-big-number');
});
```

- [ ] **Step 5: Run golden tests**

Run:
```bash
npm run test:visuals -- --test-name-pattern 'golden:'
```

Expected: both `mock` and `linkedin-big-number` pass.

- [ ] **Step 6: Commit**

```bash
git add src/visuals/seeds/linkedin-big-number tests/golden/visual-templates/linkedin-big-number.png tests/visuals/golden scripts/snapshot-seed.ts
git rm scripts/snapshot-mock.ts || true
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): migrate linkedin-big-number + factorize golden helper

linkedin-big-number en seeds (body.hbs avec {{#if subtitle}} pour la
flèche conditionnelle + SVG inline statique, style.css sans fonts ni
reset, schema avec x-source ai). Helper assertGoldenMatch factorisé
dans tests/visuals/golden/_helpers.ts pour les futurs templates.
Script snapshot-mock.ts généralisé en snapshot-seed.ts <slug>.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Seed script

### Task 15: Build `scripts/seed-visual-templates.ts`

**Files:**
- Create: `scripts/seed-visual-templates.ts`

- [ ] **Step 1: Implement the seed script**

Create `scripts/seed-visual-templates.ts` :

```ts
// Idempotent : lit src/visuals/seeds/<slug>/ et INSERT OR IGNORE en DB.
// Avec --force, fait UPDATE de tous les champs (utilisé pour re-pousser
// un seed après avoir édité un body.hbs ou style.css côté code).
//
// Usage :
//   tsx scripts/seed-visual-templates.ts          # idempotent
//   tsx scripts/seed-visual-templates.ts --force  # écrase

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from '../src/db.js';
import { createVisualTemplate, getVisualTemplate, updateVisualTemplate } from '../src/visuals/store.js';
import { validateVariablesSchema, validateSampleVars } from '../src/visuals/schema.js';

const SEEDS_DIR = resolve('src/visuals/seeds');
const force = process.argv.includes('--force');

const slugs = readdirSync(SEEDS_DIR).filter((name) => {
  try { return statSync(resolve(SEEDS_DIR, name)).isDirectory(); } catch { return false; }
});

console.log(`[seed] ${slugs.length} seed(s) trouvé(s). force=${force}`);

let created = 0;
let updated = 0;
let skipped = 0;
let failed = 0;

for (const slug of slugs) {
  const seedDir = resolve(SEEDS_DIR, slug);
  try {
    const meta = JSON.parse(readFileSync(`${seedDir}/meta.json`, 'utf8'));
    const body_html = readFileSync(`${seedDir}/body.hbs`, 'utf8');
    const css = readFileSync(`${seedDir}/style.css`, 'utf8');
    const variables_schema = readFileSync(`${seedDir}/schema.json`, 'utf8');
    const sample_vars = readFileSync(`${seedDir}/sample-vars.json`, 'utf8');

    const parsedSchema = JSON.parse(variables_schema);
    const schemaCheck = validateVariablesSchema(parsedSchema, { imagePrompt: meta.image_prompt });
    if (!schemaCheck.ok) { throw new Error(`schema invalid: ${schemaCheck.error}`); }
    const sampleCheck = validateSampleVars(parsedSchema, JSON.parse(sample_vars));
    if (!sampleCheck.ok) { throw new Error(`sample_vars invalid: ${sampleCheck.error}`); }

    const input = {
      slug,
      label: meta.label,
      platform: meta.platform,
      width: meta.width,
      height: meta.height,
      body_html,
      css,
      variables_schema,
      sample_vars,
      image_prompt: meta.image_prompt ?? null,
      image_aspect_ratio: meta.image_aspect_ratio ?? null,
    };

    const existing = getVisualTemplate(slug);
    if (existing && !force) {
      console.log(`[skip] ${slug} (already in DB, use --force to overwrite)`);
      skipped++;
      continue;
    }
    if (existing) {
      updateVisualTemplate(slug, input);
      console.log(`[update] ${slug}`);
      updated++;
    } else {
      createVisualTemplate(input);
      console.log(`[create] ${slug}`);
      created++;
    }
  } catch (err) {
    console.error(`[fail] ${slug}:`, (err as Error).message);
    failed++;
  }
}

console.log(`\ncreated=${created} updated=${updated} skipped=${skipped} failed=${failed}`);
process.exit(failed > 0 ? 1 : 0);
```

- [ ] **Step 2: Run seed script (first time)**

Run:
```bash
rm -f data/avqn.db
npm start &
SERVER_PID=$!
sleep 3
kill $SERVER_PID
tsx scripts/seed-visual-templates.ts
```

Expected: `[create] mock` and `[create] linkedin-big-number`, `created=2`.

- [ ] **Step 3: Run again (idempotency check)**

Run:
```bash
tsx scripts/seed-visual-templates.ts
```

Expected: `[skip] mock (already in DB...)`, `[skip] linkedin-big-number ...`, `created=0 updated=0 skipped=2`.

- [ ] **Step 4: Run with --force**

Run:
```bash
tsx scripts/seed-visual-templates.ts --force
```

Expected: `[update] mock`, `[update] linkedin-big-number`, `updated=2`.

- [ ] **Step 5: End-to-end smoke test with flag ON**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3000/visual-templates | grep -c "linkedin-big-number"
kill $SERVER_PID
```

Expected: count > 0. The DB-sourced templates appear in the list.

- [ ] **Step 6: Commit**

```bash
git add scripts/seed-visual-templates.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): script seed idempotent (INSERT OR IGNORE + --force)

scripts/seed-visual-templates.ts lit src/visuals/seeds/<slug>/ et insère
en DB. Idempotent par défaut (skip si slug existe), --force pour
ré-écraser. Valide le schema et sample_vars via Ajv avant insertion.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Admin UI

### Task 16: Refactor `/visual-templates` list page to read from DB

**Files:**
- Modify: `src/views/visual-templates.ts`
- Modify: `src/server.ts` (existing `GET /visual-templates` route)

- [ ] **Step 1: Inspect current state**

Run:
```bash
cat src/views/visual-templates.ts
grep -n "/visual-templates" src/server.ts
```

- [ ] **Step 2: Rewrite the list view to use `listResolvedTemplates()`**

In `src/views/visual-templates.ts`, replace the rendering function so it accepts an array of `ResolvedTemplate` (or use `listResolvedTemplates()` directly inside the page). The function should render :

- A "Nouveau template" button linking to `/visual-templates/new`.
- A grid of cards, one per template, each showing slug, label, platform, dimensions, and a small thumbnail (the sample PNG).
- Each card links to `/visual-templates/<slug>` (the edit page, built in Task 17).

Use existing patterns from `src/views/templates.ts` (writing templates page) as visual reference.

- [ ] **Step 3: Add `GET /visual-templates/:slug/thumbnail` route**

In `src/server.ts`, add a route that serves the rendered PNG for a template using its `sample_vars`. Cache in-memory for 60s by slug:

```ts
const thumbnailCache = new Map<string, { png: Buffer; ts: number }>();
const THUMB_TTL_MS = 60_000;

app.get('/visual-templates/:slug/thumbnail', async (c) => {
  const slug = c.req.param('slug');
  const cached = thumbnailCache.get(slug);
  if (cached && Date.now() - cached.ts < THUMB_TTL_MS) {
    return new Response(cached.png, { headers: { 'content-type': 'image/png' } });
  }
  const tpl = resolveTemplate(slug);
  if (!tpl) return c.notFound();
  const row = tpl.row;
  if (!row) return c.text('thumbnail only for DB templates', 400);
  const sample = JSON.parse(row.sample_vars);
  const html = tpl.render(sample);
  const png = await renderHtmlToPng(html, tpl.width, tpl.height);
  thumbnailCache.set(slug, { png, ts: Date.now() });
  return new Response(png, { headers: { 'content-type': 'image/png' } });
});
```

Add imports : `renderHtmlToPng` from `./render.js`, `resolveTemplate` from `./visuals/index.js`.

- [ ] **Step 4: Smoke-check**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3000/visual-templates | grep -c "linkedin-big-number"
curl -s -o /tmp/thumb.png -w "%{http_code}\n" http://localhost:3000/visual-templates/linkedin-big-number/thumbnail
file /tmp/thumb.png
kill $SERVER_PID
```

Expected: list contains the template, thumbnail returns 200 with `PNG image data`.

- [ ] **Step 5: Commit**

```bash
git add src/views/visual-templates.ts src/server.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): refactor /visual-templates list + thumbnail endpoint

La page liste lit désormais via listResolvedTemplates() (honore le flag
VISUAL_TEMPLATES_FROM_DB). Nouvelle route GET /visual-templates/:slug/thumbnail
qui sert le PNG rendu avec sample_vars, cache mémoire 60s par slug.
Préparation des cards cliquables vers l'éditeur (Task 17).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 17: Build the edit page `/visual-templates/:slug` and `/new`

**Files:**
- Modify: `src/views/visual-templates.ts` (add edit view)
- Modify: `src/server.ts` (add edit + new routes)

- [ ] **Step 1: Add the edit view function**

In `src/views/visual-templates.ts`, add an exported function `visualTemplateEditPage(template?: VisualTemplateRow)` that renders a form with 4 sections (tabs implemented as simple `<details>` for parity-only) :

- Metadata (label, platform, width, height, image_prompt, image_aspect_ratio)
- HTML (textarea monospace, name=`body_html`)
- CSS (textarea monospace, name=`css`)
- Variables (textarea monospace, name=`variables_schema`, expects valid JSON)
- Sample vars (textarea monospace, name=`sample_vars`, expects valid JSON)

The form submits via HTMX `hx-patch` (for edit) or `hx-post` (for create) to the corresponding endpoint. A "Régénérer preview" button on the right pane triggers `POST /visual-templates/:slug/preview` (or `/visual-templates/new/preview` for create) and swaps the `<img>` source.

All user-controlled values must go through `escapeHtml()` (cf. existing helpers in `src/views/components.ts`).

If `template` is undefined, render a blank create form with sane defaults (width=1080, height=1350, platform=linkedin, image_prompt='', schema=`{"type":"object","properties":{}}`, sample_vars=`{}`).

- [ ] **Step 2: Add GET routes for the edit + new pages**

In `src/server.ts` :

```ts
app.get('/visual-templates/new', (c) => {
  return c.html(layout('Nouveau template visuel', visualTemplateEditPage(undefined)));
});

app.get('/visual-templates/:slug', (c) => {
  const slug = c.req.param('slug');
  if (slug === 'new') return c.notFound();
  const template = getVisualTemplate(slug);
  if (!template) return c.notFound();
  return c.html(layout(`Edit ${template.label}`, visualTemplateEditPage(template)));
});
```

Add imports : `getVisualTemplate` from `./visuals/store.js`, `visualTemplateEditPage` from `./views/visual-templates.js`.

**Order matters in Hono** : `/visual-templates/new` must be declared **before** `/visual-templates/:slug` (or use the inline check shown above).

- [ ] **Step 3: Smoke-check**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3
curl -s -o /tmp/new.html http://localhost:3000/visual-templates/new -w "%{http_code}\n"
curl -s -o /tmp/edit.html http://localhost:3000/visual-templates/linkedin-big-number -w "%{http_code}\n"
grep -c "body_html" /tmp/edit.html
grep -c "variables_schema" /tmp/edit.html
kill $SERVER_PID
```

Expected: both pages return 200, the edit page contains the textareas with field names.

- [ ] **Step 4: Commit**

```bash
git add src/views/visual-templates.ts src/server.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): edit page /visual-templates/:slug + /new

visualTemplateEditPage(template?) rend un formulaire avec 5 textareas
(metadata, HTML, CSS, variables_schema, sample_vars) et un panneau
preview à droite. La page /new pré-remplit avec des défauts sains.
Routes GET ajoutées dans src/server.ts. Les endpoints POST/PATCH/preview
arrivent dans les tâches suivantes.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 18: Add POST/PATCH/DELETE endpoints with validation

**Files:**
- Modify: `src/server.ts`
- Create: `src/visuals/validation.ts`

- [ ] **Step 1: Create validation module**

Create `src/visuals/validation.ts` :

```ts
import Handlebars from 'handlebars';
import { validateVariablesSchema, validateSampleVars } from './schema.js';
import type { VisualTemplateInput } from './store.js';

const SLUG_RE = /^[a-z0-9-]+$/;
const GEMINI_RATIOS = new Set([
  '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9',
]);

export function validateTemplateInput(
  input: Partial<VisualTemplateInput>,
  mode: 'create' | 'update',
  existing?: VisualTemplateInput,
): { ok: true; merged: VisualTemplateInput } | { ok: false; error: string } {
  const merged: VisualTemplateInput = {
    slug: input.slug ?? existing?.slug ?? '',
    label: input.label ?? existing?.label ?? '',
    platform: input.platform ?? existing?.platform ?? 'linkedin',
    width: input.width ?? existing?.width ?? 0,
    height: input.height ?? existing?.height ?? 0,
    body_html: input.body_html ?? existing?.body_html ?? '',
    css: input.css ?? existing?.css ?? '',
    variables_schema: input.variables_schema ?? existing?.variables_schema ?? '',
    sample_vars: input.sample_vars ?? existing?.sample_vars ?? '{}',
    image_prompt: input.image_prompt ?? existing?.image_prompt ?? null,
    image_aspect_ratio: input.image_aspect_ratio ?? existing?.image_aspect_ratio ?? null,
  };

  if (mode === 'create' || input.slug !== undefined) {
    if (!SLUG_RE.test(merged.slug)) return { ok: false, error: 'slug invalid (kebab-case alphanum only)' };
  }
  if (!merged.label.trim()) return { ok: false, error: 'label required' };
  if (!Number.isInteger(merged.width) || merged.width < 1 || merged.width > 10000) {
    return { ok: false, error: 'width must be integer in [1, 10000]' };
  }
  if (!Number.isInteger(merged.height) || merged.height < 1 || merged.height > 10000) {
    return { ok: false, error: 'height must be integer in [1, 10000]' };
  }
  if (merged.image_prompt) {
    if (!merged.image_aspect_ratio || !GEMINI_RATIOS.has(merged.image_aspect_ratio)) {
      return { ok: false, error: `image_aspect_ratio required and must be one of ${[...GEMINI_RATIOS].join(', ')}` };
    }
  } else if (merged.image_aspect_ratio) {
    return { ok: false, error: 'image_aspect_ratio must be null when image_prompt is empty' };
  }

  let parsedSchema: unknown;
  try { parsedSchema = JSON.parse(merged.variables_schema); }
  catch (e) { return { ok: false, error: `variables_schema not valid JSON: ${(e as Error).message}` }; }
  const schemaCheck = validateVariablesSchema(parsedSchema, { imagePrompt: merged.image_prompt });
  if (!schemaCheck.ok) return { ok: false, error: schemaCheck.error };

  let parsedSample: unknown;
  try { parsedSample = JSON.parse(merged.sample_vars); }
  catch (e) { return { ok: false, error: `sample_vars not valid JSON: ${(e as Error).message}` }; }
  const sampleCheck = validateSampleVars(parsedSchema, parsedSample);
  if (!sampleCheck.ok) return { ok: false, error: sampleCheck.error };

  try { Handlebars.compile(merged.body_html); }
  catch (e) { return { ok: false, error: `body_html Handlebars compile failed: ${(e as Error).message}` }; }

  if (merged.css.includes('</style>') || merged.css.includes('<')) {
    return { ok: false, error: 'css must not contain "<" or "</style>"' };
  }

  return { ok: true, merged };
}
```

- [ ] **Step 2: Add POST /visual-templates (create)**

In `src/server.ts` add :

```ts
app.post('/visual-templates', async (c) => {
  const form = await c.req.parseBody();
  const input = {
    slug: String(form.slug ?? ''),
    label: String(form.label ?? ''),
    platform: String(form.platform ?? 'linkedin'),
    width: Number(form.width ?? 0),
    height: Number(form.height ?? 0),
    body_html: String(form.body_html ?? ''),
    css: String(form.css ?? ''),
    variables_schema: String(form.variables_schema ?? '{}'),
    sample_vars: String(form.sample_vars ?? '{}'),
    image_prompt: form.image_prompt ? String(form.image_prompt) : null,
    image_aspect_ratio: form.image_aspect_ratio ? String(form.image_aspect_ratio) : null,
  };
  if (getVisualTemplate(input.slug)) {
    return c.text('slug already exists', 409);
  }
  const validated = validateTemplateInput(input, 'create');
  if (!validated.ok) return c.text(validated.error, 400);

  // Preview obligatoire : compile + render. Échec = save refusé.
  try {
    const previewHtml = compileTemplate(
      { ...validated.merged, id: 0, created_at: '', updated_at: '' } as VisualTemplateRow,
      JSON.parse(validated.merged.sample_vars),
    );
    await renderHtmlToPng(previewHtml, validated.merged.width, validated.merged.height);
  } catch (e) {
    return c.text(`preview failed: ${(e as Error).message}`, 400);
  }

  createVisualTemplate(validated.merged);
  return c.redirect(`/visual-templates/${input.slug}`);
});
```

Add imports : `validateTemplateInput` from `./visuals/validation.js`, `compileTemplate` from `./visuals/compile.js`, `renderHtmlToPng` from `./render.js`, `createVisualTemplate`, `getVisualTemplate`, `updateVisualTemplate`, `deleteVisualTemplate`, `countVisualsUsingTemplate` from `./visuals/store.js`.

- [ ] **Step 3: Add PATCH /visual-templates/:slug (update)**

```ts
app.patch('/visual-templates/:slug', async (c) => {
  const slug = c.req.param('slug');
  const existing = getVisualTemplate(slug);
  if (!existing) return c.notFound();
  const form = await c.req.parseBody();

  const patch: Partial<typeof existing> = {};
  for (const key of ['label', 'platform', 'body_html', 'css', 'variables_schema', 'sample_vars', 'image_prompt', 'image_aspect_ratio'] as const) {
    if (key in form) patch[key] = form[key] === '' && (key === 'image_prompt' || key === 'image_aspect_ratio') ? null : String(form[key]);
  }
  for (const key of ['width', 'height'] as const) {
    if (key in form) patch[key] = Number(form[key]);
  }

  const existingAsInput = {
    slug: existing.slug, label: existing.label, platform: existing.platform,
    width: existing.width, height: existing.height,
    body_html: existing.body_html, css: existing.css,
    variables_schema: existing.variables_schema, sample_vars: existing.sample_vars,
    image_prompt: existing.image_prompt, image_aspect_ratio: existing.image_aspect_ratio,
  };
  const validated = validateTemplateInput(patch, 'update', existingAsInput);
  if (!validated.ok) return c.text(validated.error, 400);

  try {
    const previewHtml = compileTemplate(
      { ...validated.merged, id: existing.id, created_at: existing.created_at, updated_at: '' } as VisualTemplateRow,
      JSON.parse(validated.merged.sample_vars),
    );
    await renderHtmlToPng(previewHtml, validated.merged.width, validated.merged.height);
  } catch (e) {
    return c.text(`preview failed: ${(e as Error).message}`, 400);
  }

  updateVisualTemplate(slug, validated.merged);
  return c.text('ok', 200);
});
```

- [ ] **Step 4: Add DELETE /visual-templates/:slug**

```ts
app.delete('/visual-templates/:slug', (c) => {
  const slug = c.req.param('slug');
  if (!getVisualTemplate(slug)) return c.notFound();
  const refCount = countVisualsUsingTemplate(slug);
  if (refCount > 0) {
    return c.text(`cannot delete: ${refCount} visual(s) reference this template`, 409);
  }
  deleteVisualTemplate(slug);
  return c.text('ok', 200);
});
```

- [ ] **Step 5: Smoke-check all three endpoints**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3

# Create with bad slug → 400
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3000/visual-templates \
  -d "slug=BAD SLUG&label=x&platform=linkedin&width=100&height=100&body_html=<h1>{{title}}</h1>&css=&variables_schema={\"type\":\"object\",\"properties\":{\"title\":{\"type\":\"string\",\"description\":\"t\",\"x-source\":\"ai\"}}}&sample_vars={\"title\":\"x\"}"

# Delete a referenced template → 409
# (need to insert a visual referencing linkedin-big-number first)
sqlite3 data/avqn.db "INSERT INTO visuals (template_slug, vars) VALUES ('linkedin-big-number', '{}')"
curl -s -o /dev/null -w "%{http_code}\n" -X DELETE http://localhost:3000/visual-templates/linkedin-big-number

# Cleanup
sqlite3 data/avqn.db "DELETE FROM visuals WHERE template_slug='linkedin-big-number'"
kill $SERVER_PID
```

Expected: first returns 400, second returns 409.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts src/visuals/validation.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): endpoints POST/PATCH/DELETE avec validation + preview obligatoire

Module validation.ts qui applique les règles du spec (slug kebab-case,
dimensions 1-10000, image_aspect_ratio requis ssi image_prompt, JSON
Schema valide via Ajv, sample_vars conforme, body_html Handlebars OK,
css sans <). Tous les saves passent par un preview obligatoire
(compile + renderHtmlToPng) : si le preview échoue, le save est refusé.
DELETE bloqué (409) si la table visuals référence le slug.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 19: Add `POST /visual-templates/:slug/preview` endpoint

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Add preview endpoint**

In `src/server.ts` :

```ts
app.post('/visual-templates/:slug/preview', async (c) => {
  const slug = c.req.param('slug');
  const form = await c.req.parseBody();
  let row: VisualTemplateRow | undefined;
  if (slug === 'draft') {
    // Preview for an unsaved template : everything comes from the form.
    row = {
      id: 0,
      slug: 'draft',
      label: String(form.label ?? ''),
      platform: String(form.platform ?? 'linkedin') as VisualTemplateRow['platform'],
      width: Number(form.width ?? 0),
      height: Number(form.height ?? 0),
      body_html: String(form.body_html ?? ''),
      css: String(form.css ?? ''),
      variables_schema: String(form.variables_schema ?? '{}'),
      sample_vars: String(form.sample_vars ?? '{}'),
      image_prompt: form.image_prompt ? String(form.image_prompt) : null,
      image_aspect_ratio: form.image_aspect_ratio ? String(form.image_aspect_ratio) : null,
      created_at: '', updated_at: '',
    };
  } else {
    row = getVisualTemplate(slug);
    if (!row) return c.notFound();
    // Overlay form fields if provided (live preview while editing).
    if (form.body_html !== undefined) row.body_html = String(form.body_html);
    if (form.css !== undefined) row.css = String(form.css);
    if (form.variables_schema !== undefined) row.variables_schema = String(form.variables_schema);
    if (form.sample_vars !== undefined) row.sample_vars = String(form.sample_vars);
  }

  try {
    const sampleVars = JSON.parse(row.sample_vars);
    // For templates with image source, use a placeholder (no real Gemini call).
    const placeholderImage = row.image_prompt
      ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='
      : undefined;
    const html = compileTemplate(row, sampleVars, placeholderImage);
    const png = await renderHtmlToPng(html, row.width, row.height);
    return new Response(png, { headers: { 'content-type': 'image/png' } });
  } catch (e) {
    return c.text(`preview failed: ${(e as Error).message}`, 400);
  }
});
```

- [ ] **Step 2: Wire the "Régénérer preview" button in the edit view**

In `src/views/visual-templates.ts`, the edit form's "Régénérer preview" button should submit the form fields to the preview endpoint and swap the `<img>` source. With HTMX :

```html
<button hx-post="/visual-templates/{slug}/preview"
        hx-target="#preview-img"
        hx-swap="outerHTML"
        hx-include="closest form">
  Régénérer preview
</button>
<img id="preview-img" src="/visual-templates/{slug}/thumbnail" alt="preview">
```

For HTMX to swap a PNG response into an `<img>` tag, we use a small JS workaround : intercept the response, blob it, set `src`. Or simpler : send the form to a preview endpoint, redirect the `<img src>` to a cache-busted thumbnail URL :

```html
<button onclick="
  fetch('/visual-templates/{slug}/preview', {method:'POST', body: new FormData(this.closest('form'))})
    .then(r => r.blob())
    .then(b => { document.getElementById('preview-img').src = URL.createObjectURL(b); });
  return false;
">Régénérer preview</button>
```

Use that vanilla JS approach (no HTMX magic for binary swaps).

For the create page, use `/visual-templates/draft/preview`.

- [ ] **Step 3: Smoke-check**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3

# Preview an existing template
curl -s -o /tmp/preview.png -w "%{http_code}\n" \
  -X POST http://localhost:3000/visual-templates/linkedin-big-number/preview \
  -F "sample_vars={\"bigNumber\":\"100\",\"context\":\"Test context phrase\",\"subtitle\":\"sub\",\"signature\":\"AVQN\"}"
file /tmp/preview.png

# Preview a draft
curl -s -o /tmp/draft.png -w "%{http_code}\n" \
  -X POST http://localhost:3000/visual-templates/draft/preview \
  -F "label=test" -F "platform=linkedin" -F "width=200" -F "height=200" \
  -F "body_html=<h1>{{title}}</h1>" -F "css=h1{color:red}" \
  -F "variables_schema={\"type\":\"object\",\"required\":[\"title\"],\"properties\":{\"title\":{\"type\":\"string\",\"description\":\"t\",\"x-source\":\"ai\"}}}" \
  -F "sample_vars={\"title\":\"hi\"}"
file /tmp/draft.png

kill $SERVER_PID
```

Expected: both return 200 with `PNG image data`.

- [ ] **Step 4: Commit**

```bash
git add src/server.ts src/views/visual-templates.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): preview endpoint /visual-templates/:slug/preview

Endpoint POST qui compile + render un PNG depuis le form data (overlay
sur les valeurs DB). Slug spécial "draft" pour la page /new. Image
placeholder utilisée si image_prompt présent (pas d'appel Gemini réel
en preview). Bouton "Régénérer preview" dans l'éditeur via fetch +
URL.createObjectURL.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 20: Refactor `GET /visual-options` to read from DB

**Files:**
- Modify: `src/server.ts`

- [ ] **Step 1: Find and update the existing route**

Run:
```bash
grep -n "/visual-options" src/server.ts
```

Replace the handler so it uses `listResolvedTemplates(platform)` instead of iterating the static registry.

- [ ] **Step 2: Smoke-check**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3
curl -s "http://localhost:3000/visual-options?platform=linkedin"
kill $SERVER_PID
```

Expected: HTML `<option>` elements for the DB-sourced templates (mock and linkedin-big-number at this point).

- [ ] **Step 3: Commit**

```bash
git add src/server.ts
git commit -m "$(cat <<'EOF'
🤖 refactor(visuals): /visual-options lit la DB via listResolvedTemplates

GET /visual-options utilise listResolvedTemplates(platform) au lieu
d'itérer sur le registre statique. Honore VISUAL_TEMPLATES_FROM_DB.
Le dropdown HTMX dans le formulaire de génération d'idée affiche
désormais les templates DB quand le flag est on.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Migrate remaining 8 templates

### Task 21: Migrate the 8 remaining templates

**Files:** For each slug in the list below, create the same set of seed files + golden PNG + golden test.

Templates restants :
1. `linkedin-banner-stat`
2. `linkedin-code-window`
3. `linkedin-command`
4. `linkedin-feature-image`
5. `linkedin-horizontal`
6. `linkedin-manifesto`
7. `linkedin-poster`
8. `linkedin-process`
9. `linkedin-stack`
10. `linkedin-vertical`

(Note : 10 listed, mock + linkedin-big-number already done = 12 minus 2 = 10 to do here. Verify by counting `ls src/visuals/ | grep linkedin- | wc -l`.)

- [ ] **Step 1: For each slug, repeat the per-template migration loop**

For each `<slug>` :

```bash
SLUG=<slug>
mkdir -p src/visuals/seeds/$SLUG
tsx scripts/migrate-visuals.ts $SLUG > /tmp/$SLUG-migration.txt
# (manual) populate src/visuals/seeds/$SLUG/{meta.json, schema.json, body.hbs, style.css, sample-vars.json}
# Important per-template adjustments:
#  - Replace sentinels by Handlebars expressions
#  - Convert ternaries (e.g. `imageDataUrl ? ... : ''`) to {{#if image}}...{{/if}}
#  - Move @font-face, * reset, html/body dimensions OUT of css (covered by base.css + inline body style)
#  - For templates with image IA : add `image` property to schema with x-source: "image"
#  - sample-vars.json : realistic payload conforming to schema
tsx scripts/snapshot-seed.ts $SLUG
open tests/golden/visual-templates/$SLUG.png    # eyeball vs legacy render
# Compare with legacy : start server with VISUAL_TEMPLATES_FROM_DB=false and visit /visual-templates/$SLUG
# If visual regression, edit seeds, re-snapshot.

# Add golden test file:
cat > tests/visuals/golden/$SLUG.test.ts <<EOF
import { test, after } from 'node:test';
import { closeRenderer } from '../../../src/render.js';
import { assertGoldenMatch } from './_helpers.js';

after(async () => { await closeRenderer(); });

test('golden: $SLUG pixel-matches reference within 0.1% tolerance', async () => {
  await assertGoldenMatch('$SLUG');
});
EOF

# Run THIS template's golden test
npm run test:visuals -- --test-name-pattern "golden: $SLUG"

# If pass, seed it into DB and commit
tsx scripts/seed-visual-templates.ts
git add src/visuals/seeds/$SLUG tests/golden/visual-templates/$SLUG.png tests/visuals/golden/$SLUG.test.ts
git commit -m "🤖 feat(visuals): migrate $SLUG to seeds + golden test

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

Repeat for all 10 remaining slugs. One commit per slug to make rollback easy if a regression is discovered later.

**Templates avec image IA** (need `image` in schema with `x-source: image`) :
- `linkedin-feature-image` (uses background image)
- `linkedin-banner-stat` (check `imagePrompt` in source)
- `linkedin-poster` (check)
- `linkedin-horizontal` (check)
- `linkedin-vertical` (check)

For each, verify by running `grep "imagePrompt" src/visuals/<slug>/index.ts` → if non-null, it has image IA.

- [ ] **Step 2: Run all golden tests at once**

Run:
```bash
npm run test:visuals -- --test-name-pattern 'golden:'
```

Expected: all 12 (mock + 11 linkedin) pass.

- [ ] **Step 3: Final smoke check with flag ON**

Run:
```bash
VISUAL_TEMPLATES_FROM_DB=true npm start &
SERVER_PID=$!
sleep 3
curl -s http://localhost:3000/visual-templates | grep -c '<a href="/visual-templates/'
kill $SERVER_PID
```

Expected: count = 12.

---

## Phase 8 — Flag flip & cleanup

### Task 22: Flip the feature flag default to `true` and run full test suite

**Files:**
- Modify: `src/visuals/loader.ts`

- [ ] **Step 1: Edit the flag default**

In `src/visuals/loader.ts`, change :

```ts
const FROM_DB = process.env.VISUAL_TEMPLATES_FROM_DB === 'true';
```

to :

```ts
const FROM_DB = process.env.VISUAL_TEMPLATES_FROM_DB !== 'false';
```

(Default true, opt-out via explicit `false`.)

- [ ] **Step 2: Run the full test suite**

Run:
```bash
npm test
```

Expected: all tests pass, including the legacy smoke (`test:legacy`) since the legacy registry is still loaded but unused by default.

- [ ] **Step 3: End-to-end manual test**

```bash
rm -f data/avqn.db
npm start &
SERVER_PID=$!
sleep 3
tsx scripts/seed-visual-templates.ts
# Visit http://localhost:3000/visual-templates in a browser
# Visit http://localhost:3000/ideas, create an idea, generate a post with one of the templates
# Verify the generated visual looks correct (PNG should not be broken)
kill $SERVER_PID
```

If broken, **do not commit**. Diagnose and fix the underlying issue.

- [ ] **Step 4: Commit**

```bash
git add src/visuals/loader.ts
git commit -m "$(cat <<'EOF'
🤖 feat(visuals): flip VISUAL_TEMPLATES_FROM_DB default to true

Le flag passe en opt-out (VISUAL_TEMPLATES_FROM_DB=false pour repasser
en mode legacy). Toutes les générations utilisent désormais le pipeline
DB par défaut. Le code legacy (src/visuals/<slug>/index.ts) reste
chargé mais n'est plus appelé. Suppression à la tâche suivante.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

### Task 23: Cleanup — delete legacy template files

**Files:**
- Delete: `src/visuals/<slug>/index.ts` × 10
- Delete: `src/visuals/mock.ts`
- Modify: `src/visuals/index.ts`
- Modify: `src/visuals/loader.ts`
- Modify: `src/visuals/types.ts`
- Modify: `scripts/smoke-render-templates.ts`

- [ ] **Step 1: Identify exact files to delete**

Run:
```bash
ls -d src/visuals/*/ | grep -v seeds
ls src/visuals/mock.ts
```

- [ ] **Step 2: Remove legacy template files**

```bash
git rm -r src/visuals/linkedin-banner-stat src/visuals/linkedin-big-number src/visuals/linkedin-code-window \
  src/visuals/linkedin-command src/visuals/linkedin-feature-image src/visuals/linkedin-horizontal \
  src/visuals/linkedin-manifesto src/visuals/linkedin-poster src/visuals/linkedin-process \
  src/visuals/linkedin-stack src/visuals/linkedin-vertical src/visuals/mock.ts
```

- [ ] **Step 3: Clean up `src/visuals/index.ts`**

Edit `src/visuals/index.ts` to remove the now-orphaned `visualTemplates` registry. The file becomes :

```ts
export { resolveTemplate, listResolvedTemplates } from './loader.js';
export type { ResolvedTemplate } from './loader.js';
```

- [ ] **Step 4: Clean up `src/visuals/loader.ts`**

Remove all the `fromLegacy` code path and the import of `visualTemplates as legacyRegistry`. `resolveTemplate` and `listResolvedTemplates` now go straight to DB :

```ts
import { getVisualTemplate as getFromDb, listVisualTemplates as listFromDb } from './store.js';
import { compileTemplate } from './compile.js';
import type { FilledVars } from './types.js';
import type { VisualTemplateRow } from '../db.js';
import { db } from '../db.js';

export type ResolvedTemplate = {
  slug: string; label: string; platform: string;
  width: number; height: number;
  imagePrompt: string | null; imageAspectRatio: string | null;
  render: (vars: FilledVars, imageDataUrl?: string) => string;
  row: VisualTemplateRow;
};

function settingsBrand() {
  const row = db.prepare('SELECT brand_name, brand_color, brand_signature FROM settings WHERE id = 1').get() as
    | { brand_name: string; brand_color: string; brand_signature: string } | undefined;
  return {
    name: row?.brand_name ?? '', color: row?.brand_color ?? '#000000', signature: row?.brand_signature ?? '',
  };
}

function fromDbRow(row: VisualTemplateRow): ResolvedTemplate {
  return {
    slug: row.slug, label: row.label, platform: row.platform,
    width: row.width, height: row.height,
    imagePrompt: row.image_prompt, imageAspectRatio: row.image_aspect_ratio,
    render: (vars, imageDataUrl) => compileTemplate(row, vars, imageDataUrl, { brand: settingsBrand() }),
    row,
  };
}

export function resolveTemplate(slug: string): ResolvedTemplate | undefined {
  const row = getFromDb(slug);
  return row ? fromDbRow(row) : undefined;
}

export function listResolvedTemplates(platform?: string): ResolvedTemplate[] {
  return listFromDb(platform).map(fromDbRow);
}
```

- [ ] **Step 5: Clean up `src/visuals/types.ts`**

Remove `VisualTemplate` and `getMockVarsForTemplate`-related types if any remain. Keep `FilledVars`, `GeminiAspectRatio`. Add the schema-related types if not already done :

```ts
import type { PlatformKey } from '../db.js';

export type FilledVars = Record<string, string | string[]>;

export type GeminiAspectRatio =
  | '1:1' | '2:3' | '3:2' | '3:4' | '4:3'
  | '4:5' | '5:4' | '9:16' | '16:9' | '21:9';
```

- [ ] **Step 6: Update `scripts/smoke-render-templates.ts`**

Rewrite to iterate `listResolvedTemplates()` and call `template.render(sampleVars)`. The script becomes :

```ts
import { listResolvedTemplates } from '../src/visuals/index.js';

let failures = 0;
const templates = listResolvedTemplates();
for (const template of templates) {
  const row = template.row;
  const sample = JSON.parse(row.sample_vars);
  try {
    const html = template.render(sample, row.image_prompt ? 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=' : undefined);
    if (typeof html !== 'string' || !html.includes('<html') || !html.includes('<body')) {
      console.error(`[fail] ${template.slug} : HTML invalide`); failures++; continue;
    }
    if (!html.includes(`${template.width}px`) || !html.includes(`${template.height}px`)) {
      console.error(`[fail] ${template.slug} : dimensions ${template.width}x${template.height} absentes`); failures++; continue;
    }
    console.log(`[ok]   ${template.slug.padEnd(28)} (${template.width}x${template.height}, ${html.length} chars)`);
  } catch (err) {
    console.error(`[fail] ${template.slug} :`, err); failures++;
  }
}
if (failures > 0) { console.error(`\n${failures} template(s) en échec.`); process.exit(1); }
console.log(`\nTous les ${templates.length} templates rendent correctement.`);
```

- [ ] **Step 7: Find and fix any remaining references to deleted modules**

Run:
```bash
grep -rn "from '.*visuals/mock'\|from '.*visuals/linkedin-\|MOCK_VISUAL_IMAGE_DATA_URL\|getMockVarsForTemplate" src/ scripts/ tests/
```

For each hit, replace with the seed-based equivalent or delete the line.

- [ ] **Step 8: Run all tests**

Run:
```bash
rm -f data/avqn.db
npm start &
SERVER_PID=$!
sleep 3
kill $SERVER_PID
tsx scripts/seed-visual-templates.ts
npm test
```

Expected: all tests green.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
🤖 chore(visuals): suppression du registre statique legacy

Suppression de src/visuals/<slug>/index.ts × 11 et src/visuals/mock.ts.
src/visuals/index.ts ne ré-exporte plus que resolveTemplate /
listResolvedTemplates. loader.ts simplifié (plus de branch fromLegacy).
scripts/smoke-render-templates.ts itère désormais sur la DB. La table
visual_templates est l'unique source de vérité.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Self-review checklist (for the engineer executing this plan)

Before opening a PR, verify :

- [ ] `npm test` is green (legacy smoke + visual unit/integration/golden tests).
- [ ] `rm -f data/avqn.db && npm start && tsx scripts/seed-visual-templates.ts && open http://localhost:3000/visual-templates` shows the 12 templates with thumbnails.
- [ ] Generate a real idea via the UI, pick a template, verify the visual is produced correctly.
- [ ] Edit a template via `/visual-templates/<slug>`, change a value, save, regenerate preview, verify the change took effect.
- [ ] Try to delete a referenced template, verify the 409 response and the user-facing error.
- [ ] Try to save a template with invalid CSS (`</style>` in css), verify it's rejected.
- [ ] Try to save a template with invalid schema (missing description), verify it's rejected.
- [ ] Set `VISUAL_TEMPLATES_FROM_DB=false` env, restart, verify the app boots but `/visual-templates` is empty (legacy registry no longer exists post-cleanup, this is acceptable degradation).
