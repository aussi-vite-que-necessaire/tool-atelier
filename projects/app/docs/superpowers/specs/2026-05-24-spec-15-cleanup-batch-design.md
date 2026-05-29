# Spec 15 — Cleanup + petites features (pré-refonte UX) — Design

**Objectif** : nettoyer les leftovers et ajouter quelques petites features avant la grosse refonte UX. Un seul batch.

## Périmètre

1. **Writing templates : retirer `slug`** (leftover).
2. **Voix multiples** (plusieurs voix éditoriales, choisies à la génération).
3. **Supprimer `visual_briefing`** (mort, aucun usage dans la génération).
4. **Clés API dynamiques en base** (Anthropic + Gemini), saisie requise, plus d'env.
5. **Touches UI** : logo navbar → `/`, bloc email/nom → `/settings`.

## 1. Retirer le slug des writing templates

- Migration : drop `writing_templates.slug` (+ son index unique).
- `CreateWritingTemplateInput`/`UpdateWritingTemplatePatch` : retirer `slug`. Repo : `createWritingTemplate` n'utilise plus `onConflictDoNothing(slug)`.
- Form (settings) + éditeur : retirer le champ slug.
- Seed `DEFAULT_WRITING_TEMPLATE` : retirer `slug` ; idempotence du seed bascule sur le `name` (`seedUserDefaults`/`dev-sample` vérifient par nom).
- MCP `create/update_writing_template` : retirer `slug`.

## 2. Voix multiples

- Schéma `voice` → table multi-lignes : `id` (pk), `userId` (fk), `name`, `content`, timestamps. Index `userId`. **Migration** : la voix unique existante (1 ligne par user) devient une voix nommée « Voix principale » (préserver le contenu).
- Repo `voices` : `listVoices(userId)`, `getVoice(userId, id)`, `createVoice(userId, {name, content})`, `updateVoice(userId, id, patch)`, `deleteVoice(userId, id)`. `seedUserDefaults` crée « Voix principale » avec `DEFAULT_VOICE_CONTENT`.
- Settings : page liste des voix (comme writing templates) + new/edit/delete.
- **Génération** : le formulaire idée→post (`idea-card`) choisit une **voix** (select) en plus du template ; `enqueueGeneratePost`/job `generate-post` portent `voiceId` ; `build-system-prompt` reçoit le contenu de cette voix (au lieu du `getVoice(userId)` unique). Pré-check : voix introuvable → erreur.
- MCP : remplacer `get_voice`/`set_voice` par `list_voices`/`create_voice`/`update_voice`/`delete_voice` ; `generate_post` accepte un `voiceId` optionnel (à défaut, la 1ʳᵉ voix).

## 3. Supprimer visual_briefing

Suppression complète : `schemas/visual-briefing.ts` (migration drop table), `repositories/visual-briefing.ts`, `app/(app)/settings/visual-briefing/*`, entrée sidebar, tools MCP `get/set_visual_briefing`, usages dans `seeds/user-defaults.ts` + `dev-sample.ts`, et tests dédiés (`visual-briefing-*.test.ts`, références dans tenant-isolation / user-defaults-seed / mcp-tools-config / settings-editorial e2e). Retrait du `delete(visualBriefing)` du setup-integration.

## 4. Clés API dynamiques en base

- Table `api_credentials` : `userId`, `provider` (`'anthropic'|'gemini'`), `secretCiphertext` (chiffré AES-256-GCM via `encryptToken`/`decryptToken` existants), timestamps. Unique `(userId, provider)`.
- Repo : `getApiKey(userId, provider)` (déchiffre, ou undefined), `setApiKey(userId, provider, key)` (upsert chiffré), `listApiKeyStatus(userId)` (présence par provider, sans révéler la clé).
- Page settings **« Clés API »** : champs Anthropic + Gemini (afficher « définie ✓ » / « non définie », saisie pour (re)définir ; jamais réafficher la valeur). Entrée sidebar `Clés API` activée.
- **Génération** : `generate(opts)` (Anthropic) et `generateImage`/`editImage` (Gemini) reçoivent la clé en paramètre. Les workers `generate-post`/`generate-image` résolvent la clé du user (`getApiKey`) et la passent ; si absente et hors stub → échec du job avec message clair (« Configure ta clé API <provider> dans Réglages »).
- Retrait de `ANTHROPIC_API_KEY` et `GEMINI_API_KEY` de `env.ts` et `.env.example`. Les stubs (`CONTENT_OS_AI_STUB`, `CONTENT_OS_GEMINI_STUB`) court-circuitent toujours toute clé → CI/E2E inchangés.
- Non exposé via MCP (sécurité) : les clés se gèrent uniquement dans l'UI web.

## 5. Touches UI

- `app-header` : le titre « content-os » devient `<Link href="/">`. Le bloc email/nom devient `<Link href="/settings">` (ou la 1ʳᵉ page settings).

## Tests

- **Unit** : crypto déjà couvert ; build-system-prompt avec une voix donnée.
- **Integration** : `voices` CRUD + seed « Voix principale » ; `api_credentials` set/get (round-trip chiffré, valeur jamais en clair) ; `generate-post` core avec `voiceId` ; suppression : adapter/retirer les tests visual_briefing.
- **Worker** : `generate-post` avec voiceId + clé DB (stub) ; `generate-image` avec clé DB (stub) ; absence de clé hors stub → erreur.
- **E2E** : `settings-editorial` mis à jour (voix multiples, plus de briefing) ; petite nav (logo → home, email → settings) ; page Clés API (définir une clé, voir « définie »).

## Hors périmètre

Refonte UX globale (écrans), exposition des clés via MCP, providers autres qu'Anthropic/Gemini.
