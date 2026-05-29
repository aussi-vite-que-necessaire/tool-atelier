# Suppression du « Brand Mark » dans cast

**Date** : 2026-05-29
**Statut** : validé (brainstorm) → implémentation

## Contexte

cast embarque une fonctionnalité « Identité de marque » (Brand Mark) : nom de
marque (`brand_name`), signature (`brand_signature`) et logo (`brand_logo_url`),
stockés dans la table `settings`, éditables sur `/settings/brand`, exposés à
l'agent via le tool MCP `get_settings`, et utilisés comme repli pour l'identité
d'auteur affichée dans l'aperçu LinkedIn.

C'est un **legacy sans intérêt dans cast** : la table `settings` ne sert qu'à la
marque (sa seule autre colonne réelle, `brand_color`, a déjà été retirée).

## Décisions (brainstorm)

1. **Tout retirer** : `brand_name`, `brand_signature` **et** `brand_logo_url`.
   Comme la table `settings` est entièrement dédiée à la marque, on supprime tout
   le sous-système `settings` (table, schéma, repository, page, seed, tool MCP).
2. **Auteur de l'aperçu LinkedIn = compte connecté seul.** La marque servait de
   repli pour le nom (et fournissait headline/avatar custom). Après suppression,
   `resolveAuthor`/`getAuthorIdentity` ne lisent plus que le compte LinkedIn
   (`social_accounts.display_name`), repli `'Vous'`. Plus de headline ni d'avatar
   custom (le compte ne stocke que `display_name`).

## Périmètre — ce qui est SUPPRIMÉ vs SIMPLIFIÉ

### Supprimé
- UI : `src/app/(settings)/settings/brand/` (page, form, actions, actions-core)
- DB : `src/lib/db/schemas/settings.ts`, `src/lib/db/repositories/settings.ts`,
  export barrel dans `schema.ts`, + migration `DROP TABLE settings`
- MCP : tool `get_settings` dans `src/lib/mcp/tools/config.ts`
- Tests : `settings-repository.test.ts`, `settings-action.test.ts`

### Simplifié (PAS supprimé — utilisé par l'aperçu LinkedIn)
- `src/lib/linkedin/author.ts` : `resolveAuthor` ne prend plus que le compte
  (`displayName`/`userName`), produit `{ name }`. Le type `LinkedInAuthor`
  conserve `headline?`/`avatarUrl?` optionnels → les 7 composants d'aperçu
  compilent sans changement (ils affichent désormais initiales + pas de headline).
- `src/lib/linkedin/identity.ts` : `getAuthorIdentity` ne charge plus que
  `getSocialAccount` (plus de `getSettings`).
- `test/unit/linkedin-identity.test.ts` : tests réduits au nom (priorité
  displayName, repli `'Vous'`, trim).

### Édité (retrait des références marque/settings)
- `src/app/cast-nav.ts` (lien `/settings/brand`),
  `src/app/(settings)/settings/page.tsx` (redirige vers `/settings/voice`)
- seeds : `user-defaults.ts`, `dev-sample.ts`, `scripts/seed-preview.mjs`
- tests : `tenant-isolation.test.ts`, `user-defaults-seed.test.ts`,
  `seed-dev.test.ts`, `test/integration/setup-integration.ts`

## Vérification
`npx tsc --noEmit` + `npm run lint` + `npm test` (base provisionnée par
`scripts/dev-db.sh up cast`) + `npm run build`, tous verts ; aucune référence
résiduelle à `brand`/`repositories/settings`/`schemas/settings`.

## Points de vigilance
- **Migration destructive** : le merge en prod jouera `DROP TABLE settings` →
  perte des données de marque existantes (assumé : legacy sans valeur).
- L'aperçu LinkedIn n'affiche plus d'avatar/headline custom (le flux de
  publication réel ne portait déjà aucune métadonnée d'auteur).
