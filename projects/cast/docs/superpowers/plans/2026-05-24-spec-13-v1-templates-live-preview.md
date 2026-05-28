# Spec 13 — Import templates V1 + preview HTML live — Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en `- [ ]`.

**Goal:** DSL étendu (list+color) → preview HTML live → 9 templates v1 portés + vérifiés → PR.

---

## Task 1 : DSL étendu (list + color) + fillVarDefaults
- Create/modify: `src/lib/visual-templates/dsl.ts` ; Test: `test/unit/dsl-list-color.test.ts`
- [ ] listSpec + colorSpec ajoutés au discriminatedUnion ; `variablesSchemaToZod` gère list (array, minItems/maxItems, optional) et color (regex hex, optionnel à la validation).
- [ ] `fillVarDefaults(schema, vars)` → contexte complet (string→'', list→[], color→default??'#000000', image→inchangé).
- [ ] Unit tests : list/color/zod/fillVarDefaults. `npm run test:unit -- dsl-list-color`.
- [ ] Commit.

## Task 2 : preview.ts + worker fillVarDefaults
- Create: `src/lib/visual-templates/preview.ts` ; Modify: `src/worker/queues/render-visual.ts` ; Test: `test/integration/visual-preview.test.ts`
- [ ] `buildPreviewHtml(template, vars, brand?)` : fillVarDefaults + placeholder image + compileTemplate.
- [ ] Worker : remplacer la construction du contexte par fillVarDefaults (+ résolution image existante).
- [ ] Test : buildPreviewHtml d'un seed → HTML non vide, contient le contenu attendu.
- [ ] Commit.

## Task 3 : Composant TemplatePreview + page détail
- Create: `src/app/(app)/settings/visual-templates/_components/template-preview.tsx` ; Modify: `[id]/page.tsx`
- [ ] `TemplatePreview` (client) : iframe `srcDoc={html}`, `transform: scale` pour tenir le ratio dans le conteneur.
- [ ] Page détail [id] : compiler le HTML côté serveur (`buildPreviewHtml` avec sampleVars + brand du user) et le passer au composant → aperçu live immédiat. Garder le PreviewPanel (PNG) en complément.
- [ ] Build OK. Commit.

## Task 4 : Formulaires variables (list + color)
- Modify: `src/app/(app)/posts/[id]/_components/variables-form.tsx` (+ éventuel éditeur de template)
- [ ] `list` → inputs répétables (ajouter/supprimer) ; `color` → `<input type="color">` (défaut spec.default).
- [ ] tsc + build OK. Commit.

## Task 5 : Porter les 9 templates (seeds)
- Create: `src/lib/visual-templates/seeds/linkedin-{banner-stat,code-window,command,feature-image,horizontal,poster,process,stack,vertical}.ts` ; Modify: `seeds/index.ts`
- [ ] Pour chaque : lire `content-os/src/visuals/<slug>/index.ts`, convertir `render()` → bodyHtml Handlebars + css + schéma DSL + sampleVars. Préserver le design, garde-fous overflow, fonts base.css. Lists → `{{#each}}`, color → `{{couleurVar}}` dans css/style, image → `{{var}}` (url).
- [ ] Enregistrer dans `index.ts` (VISUAL_TEMPLATE_SEEDS).
- [ ] **Vérification visuelle** : pour chaque template, rendre le PNG (Puppeteer dev via un script ou compile+renderHtmlToPng) et inspecter l'image. Corriger débordements/incohérences.
- [ ] Commit (par lots).

## Task 6 : Tests integration + E2E
- [ ] Integration : tous les VISUAL_TEMPLATE_SEEDS compilent (buildPreviewHtml) sans throw avec leurs sampleVars ; et avec optionnels retirés (fillVarDefaults).
- [ ] E2E : page détail template → iframe d'aperçu visible.
- [ ] Commit.

## Task 7 : Validation + PR
- [ ] `npm run db:test:prepare && npm test` ; `npx biome check --write . && npm run lint && npx tsc --noEmit` ; E2E complète.
- [ ] `git push` + `gh pr create`. Surveiller CI. Ne pas merger.
