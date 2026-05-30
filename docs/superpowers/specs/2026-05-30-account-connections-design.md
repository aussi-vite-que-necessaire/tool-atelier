# Espace « Compte » niveau suite — connexions sociales

## Contexte

La connexion LinkedIn est déjà implémentée de bout en bout dans `projects/app` :
OAuth (`/api/linkedin/connect` → `/api/linkedin/callback`), token chiffré (AES-256-GCM,
`social_accounts`), page de réglages (`/cast/settings/connections` : connecter / reconnecter /
déconnecter, nom du compte, expiration), et publication via le worker `publish-linkedin`.

**Problème réel : la page est introuvable.** L'onglet « Réglages » de `cast-nav` pointe en dur
sur `/cast/settings/voice`, et il n'existe aucune sous-navigation entre les sections de réglages
(Voice / Writing Templates / Connexions). La page Connexions est orpheline — on n'y arrive que
par un lien d'erreur du panneau de publication.

Or un compte social est une donnée **niveau utilisateur** (`social_accounts` est clé par
`userId` + `platform`, rien de cast-spécifique). On la sort donc dans un espace **Compte** au
niveau de la suite, accessible et extensible (autres réseaux, puis infos profil).

## Objectif

Rendre la connexion LinkedIn accessible depuis un espace **Compte** niveau suite, sans rien
réimplémenter de l'OAuth. Poser une structure qui accueillera plus tard d'autres réseaux et les
infos de profil.

## Architecture

### Routes (nouvelle section suite `src/app/(app)/account/`)

- `account/layout.tsx` + `account/account-nav.tsx` : sous-nav calquée sur `cast-nav.tsx`.
  Un onglet aujourd'hui — **Connexions** — avec la place pour **Profil** plus tard.
- `account/page.tsx` → `redirect('/account/connections')` (même pattern que
  `/cast/settings/page.tsx` → voice).
- `account/connections/` : la page LinkedIn **déplacée** depuis `cast/settings/connections`
  (`page.tsx`, `actions.ts`, `_components/disconnect-button.tsx`). Logique inchangée.

La section n'est **pas** un onglet de domaine (pas dans `SUITE_ENTRIES`) : on y accède par le
menu utilisateur.

### Câblage (l'OAuth ne bouge pas, seules les cibles de redirection changent)

- `src/app/api/linkedin/callback/route.ts` : cible `/cast/settings/connections` →
  `/account/connections`.
- `src/app/(app)/cast/posts/[id]/_components/publish-panel.tsx` : lien d'erreur →
  `/account/connections`.
- `account/connections/actions.ts` : `revalidatePath('/account/connections')`.
- Ancien `src/app/(app)/cast/settings/connections/page.tsx` → `redirect('/account/connections')`
  (back-compat ; on supprime l'action et le composant déplacés, on ne garde qu'une redirection).
- Cast conserve ses réglages **Voice + Writing Templates** (cast-spécifiques). `cast-nav` reste
  inchangé.

### Point d'entrée UI

- Lien **« Compte »** dans le menu utilisateur (`suite-nav.tsx`, `UserMenu`), au-dessus de
  « Déconnexion », pointant sur `/account/connections`.
- Entrée équivalente dans le drawer mobile (`mobile-drawer.tsx`), hors de la liste des domaines.

## Extensibilité (le « plus tard »)

- **Autres réseaux** : cartes supplémentaires sur la page Connexions. Aucune nouvelle table —
  `social_accounts` est déjà générique sur `platform`.
- **Infos profil** : nouvel onglet `/account/profil` dans la sous-nav.

## Tests (TDD)

- `account/page.tsx` redirige vers `/account/connections`.
- L'ancien `cast/settings/connections/page.tsx` redirige vers `/account/connections`.
- La cible de redirection du callback OAuth est `/account/connections` (assertion sur l'URL
  construite, dans la logique testable du callback ou un test du module).
- La logique OAuth / connect-core déjà couverte (`test/integration/linkedin-connect-core.test.ts`,
  `test/unit/linkedin-oauth.test.ts`) ne change pas.

## Œil de l'agent

Avant de pousser : `/apercu` sur `/account/connections` (mobile + desktop) et sur le menu
utilisateur ouvert, pour vérifier hiérarchie, espacement, cohérence avec le thème de la suite.

## Hors périmètre

- OAuth par utilisateur sur `/api/mcp`.
- Connexion d'autres réseaux que LinkedIn (structure prête, pas l'implémentation).
- Page/onglet Profil (structure prête, pas l'implémentation).
