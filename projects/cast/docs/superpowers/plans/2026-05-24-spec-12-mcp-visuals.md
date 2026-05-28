# Spec 12 — Visuels pilotables via MCP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Exposer en MCP la gestion des templates/styles visuels + l'inspection des params + la pré-validation du rendu.

**Architecture:** Nouveaux tools dans `src/lib/mcp/tools/visuals.ts` (CRUD templates + styles + get_visual_template avec specs parsées), déplacement des `list_visual_*` depuis `config.ts`, pré-validation dans `renderVisualTool` (media.ts). Façade sur les repos existants.

---

## Task 1 : `tools/visuals.ts` (CRUD templates + styles + get + parse)

**Files:**
- Create: `src/lib/mcp/tools/visuals.ts`
- Modify: `src/lib/mcp/tools/config.ts` (retirer list_visual_templates / list_visual_styles), `src/lib/mcp/server.ts` (registerVisualTools)
- Test: `test/integration/mcp-tools-visuals.test.ts`

- [ ] **Step 1 : Écrire `visuals.ts`**

Impls exportés + `registerVisualTools(server)` :
- `get_visual_template {id}` → `const t = await getVisualTemplate(userId, id); if (!t) throw new Error('Template visuel introuvable'); return { ...t, variableSpecs: parseVariablesSchema(t.variablesSchema) };`
- `create_visual_template {slug, label, platform?, width, height, bodyHtml, css, variablesSchema, sampleVars}` → valider `parseVariablesSchema(variablesSchema)` (throw si KO), puis `createVisualTemplate(userId, { ...input, platform: input.platform ?? 'linkedin' })`.
- `update_visual_template {id, ...patch}` → si `variablesSchema` fourni, le valider ; `updateVisualTemplate(userId, id, patch)`.
- `delete_visual_template {id}` → `deleteVisualTemplate` puis `{ deleted: id }`.
- `list_visual_templates` (déplacé) → `listVisualTemplates(userId)`.
- `create_visual_style {name, prompt}`, `update_visual_style {id, name?, prompt?}`, `delete_visual_style {id}`, `list_visual_styles` (déplacé).

zod inputSchema pour `variablesSchema` :
```ts
const variableSpecInput = z
  .object({ name: z.string(), label: z.string(), type: z.enum(['string', 'image']) })
  .passthrough();
// variablesSchema: z.array(variableSpecInput)
// sampleVars: z.record(z.string(), z.unknown())
```

Pattern de chaque tool : `(input, extra) => handle(extra, (u) => impl(u, input))`.

- [ ] **Step 2 : Retirer de `config.ts`** les enregistrements `list_visual_templates` et `list_visual_styles` (et imports devenus inutiles).

- [ ] **Step 3 : Brancher** `registerVisualTools(server)` dans `server.ts`.

- [ ] **Step 4 : Tests**

```ts
// extraits clés
const tpl = await visualImpl.createTemplate(userId, {
  slug: 'mcp-tpl', label: 'MCP', platform: 'linkedin', width: 1080, height: 1080,
  bodyHtml: '<div>{{titre}}</div>', css: 'div{}',
  variablesSchema: [{ name: 'titre', label: 'Titre', type: 'string' }],
  sampleVars: { titre: 'Exemple' },
});
const got = await visualImpl.getTemplate(userId, { id: tpl.id });
expect(got.variableSpecs.map((s) => s.name)).toContain('titre');

await expect(
  visualImpl.createTemplate(userId, { /* ... */ variablesSchema: [{ bad: true }], sampleVars: {} }),
).rejects.toThrow();

const style = await visualImpl.createStyle(userId, { name: 'Néon', prompt: 'style néon' });
expect((await visualImpl.listStyles(userId)).some((s) => s.id === style.id)).toBe(true);
```

Run: `npm run test:integration -- mcp-tools-visuals`
Expected: PASS.

- [ ] **Step 5 : Commit**

```bash
git add src/lib/mcp/tools/visuals.ts src/lib/mcp/tools/config.ts src/lib/mcp/server.ts test/integration/mcp-tools-visuals.test.ts
git commit -m "🤖 feat(spec-12): tools MCP templates + styles visuels (CRUD + specs parsées)"
```

---

## Task 2 : Pré-validation des vars dans `render_visual`

**Files:**
- Modify: `src/lib/mcp/tools/media.ts`
- Test: étendre `test/integration/mcp-tools-media.test.ts`

- [ ] **Step 1 : Valider avant d'enfiler**

Dans `renderVisualTool`, avant d'appeler le runner :
```ts
const template = await getVisualTemplate(userId, input.templateId);
if (!template) throw new Error('Template visuel introuvable');
variablesSchemaToZod(parseVariablesSchema(template.variablesSchema), { imagesOptional: false }).parse(input.vars);
```
(imports `getVisualTemplate`, `parseVariablesSchema`, `variablesSchemaToZod`.)

- [ ] **Step 2 : Tests**

- vars invalides (champ requis manquant) → `renderVisualTool` throw, runner injecté non appelé.
- vars valides + runner injecté renvoyant `{ mode:'final', mediaId, ... }` → renvoie le résultat.

Run: `npm run test:integration -- mcp-tools-media`
Expected: PASS.

- [ ] **Step 3 : Commit**

```bash
git add src/lib/mcp/tools/media.ts test/integration/mcp-tools-media.test.ts
git commit -m "🤖 feat(spec-12): pré-validation des vars dans render_visual (MCP)"
```

---

## Task 3 : Validation finale + PR

- [ ] **Step 1** : `npm run db:test:prepare && npm test` → verts.
- [ ] **Step 2** : `npx biome check --write . && npm run lint && npx tsc --noEmit` → clean.
- [ ] **Step 3** : `pkill -f "src/worker/index.ts"; pkill -f "tsx watch"; CONTENT_OS_AI_STUB=1 CONTENT_OS_PUPPETEER_STUB=1 CONTENT_OS_GEMINI_STUB=1 CONTENT_OS_LINKEDIN_STUB=1 npm run test:e2e` → verts.
- [ ] **Step 4** : `git push -u origin spec-12/mcp-visuals` ; `gh pr create`.
- [ ] **Step 5** : surveiller CI vert, rendre la main.
