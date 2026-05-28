# Spec 15 — Cleanup + petites features — Plan

> REQUIRED SUB-SKILL: superpowers:executing-plans. Steps `- [ ]`.

**Goal:** retirer slug + visual_briefing ; voix multiples (choix à la génération) ; clés API en base ; liens navbar. Une PR.

---

## Task 1 : Retirer le slug des writing templates
- Modify: `schemas/writing-templates.ts` (drop slug + unique index), `repositories/writing-templates.ts` (input/patch sans slug ; create sans onConflict slug), `seeds/user-defaults.ts` (DEFAULT_WRITING_TEMPLATE sans slug), `seeds/dev-sample.ts` (idempotence par name), settings form/éditeur writing-templates, `lib/mcp/tools/config.ts` (create/update_writing_template sans slug). Migration `db:generate`.
- [ ] Adapter les tests writing-template (retrait slug). `npm test` ciblé. Commit.

## Task 2 : Voix multiples — schéma + repo + seed
- Modify: `schemas/voice.ts` (table : id, userId, name, content, timestamps ; index userId), `schema.ts`. Create migration **manuelle** : transformer la table voice existante (1 ligne/user) → ajouter id/name, remplir name='Voix principale'. Si trop complexe en SQL généré, drop+recreate (dev only) — mais préserver via migration `db:generate` + ajustement.
- Create `repositories/voices.ts` : list/get/create/update/delete.
- Modify `seeds/user-defaults.ts` : `createVoice(userId, { name: 'Voix principale', content: DEFAULT_VOICE_CONTENT })`.
- [ ] Migration appliquée dev+test. Integration : CRUD voix + seed. Commit.

## Task 3 : Voix — génération + MCP
- Modify: `lib/ai/build-system-prompt.ts` (reçoit le contenu voix en param), `lib/ai/generate-post.ts`, `worker/queues/generate-post.ts`, `lib/queue/client.ts` (GeneratePostJob + voiceId), `ideas/actions-core.ts` (enqueueGeneratePostCore prend voiceId, pré-check voix), `ideas/_components/idea-card.tsx` (select voix), page ideas (charger voix), `lib/mcp/tools/posts.ts` (generate_post + voiceId), `lib/mcp/tools/config.ts` → `voices.ts` MCP (list/create/update/delete_voice ; retirer get/set_voice).
- [ ] Integration : generate-post core résout la voix par voiceId. Worker : voiceId passé. Commit.

## Task 4 : Voix — UI settings
- Settings voix : page liste (`/settings/voice`) + new/edit/delete (calquer writing-templates). Routes/forms.
- [ ] Build OK. Commit.

## Task 5 : Supprimer visual_briefing
- Delete: `schemas/visual-briefing.ts`, `repositories/visual-briefing.ts`, `app/(app)/settings/visual-briefing/*`, tests `visual-briefing-*`. Modify: `schema.ts`, `settings-sidebar.tsx`, `lib/mcp/tools/config.ts` (retirer get/set_visual_briefing + impl), `seeds/user-defaults.ts` + `dev-sample.ts`, `setup-integration.ts`, tests référençant le briefing (tenant-isolation, user-defaults-seed, mcp-tools-config, settings-editorial e2e). Migration drop table.
- [ ] tsc + tests verts. Commit.

## Task 6 : Clés API — table/repo + page settings
- Create `schemas/api-credentials.ts` (userId, provider enum anthropic|gemini, secret_ciphertext, timestamps ; unique userId+provider), `repositories/api-credentials.ts` (getApiKey déchiffre, setApiKey chiffre upsert, listApiKeyStatus), `app/(app)/settings/api-keys/*` (page + form + actions). Modify `schema.ts`, `settings-sidebar.tsx` (activer Clés API), `setup-integration.ts`.
- [ ] Migration. Integration : set/get round-trip chiffré (clé jamais en clair en base). Commit.

## Task 7 : Clés API — génération + retrait env
- Modify `lib/ai/generate-post.ts` (`generate` reçoit apiKey), `lib/ai/generate-image.ts` (generateImage/editImage reçoivent apiKey), workers `generate-post`/`generate-image` (résoudre `getApiKey(userId, provider)`, passer ; erreur claire si absente hors stub), `env.ts` (retirer ANTHROPIC_API_KEY/GEMINI_API_KEY), `.env.example`.
- [ ] Worker tests (stub inchangés) + cas « clé absente hors stub → erreur ». tsc. Commit.

## Task 8 : Touches UI navbar
- Modify `components/layout/app-header.tsx` : titre → `<Link href="/">` ; bloc email/nom → `<Link href="/settings">`.
- [ ] Build OK. Commit.

## Task 9 : Validation + PR
- [ ] `npm run db:test:prepare && npm test` ; `npx biome check --write . && npm run lint && npx tsc --noEmit` ; E2E complète (re-run flakes).
- [ ] push + `gh pr create`. CI verte. Ne pas merger.
