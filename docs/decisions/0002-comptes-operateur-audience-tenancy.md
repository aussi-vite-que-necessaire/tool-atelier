# ADR-0002 : Comptes opérateur/audience (accountType central) + tenancy locale

**Statut.** Accepted
**Date.** 2026-05-29

## Contexte

La suite contentos vise un modèle SaaS B2B2C : des **opérateurs** (clients payants de niveau 1)
pilotent une suite d'outils (`ressources`, `media`, `cast`, …) via le SSO central
`auth.contentos.ch`, et certains outils — `ressources` au premier chef — leur permettent de
**partager du contenu à une audience** (les utilisateurs de leurs clients), qui s'authentifie
elle aussi pour consulter ce qui lui est partagé.

Jusqu'ici les deux populations passaient déjà par `auth.contentos.ch`, mais la seule distinction
« admin vs lecteur » était une variable d'env par outil (`ADMIN_USER_IDS` dans `ressources`) —
un hack qui ne porte ni la notion de tenant, ni une frontière de confiance propre.

Deux écoles s'opposaient : (a) **un seul système d'auth** avec des niveaux d'utilisateur, ou
(b) **deux systèmes d'auth séparés** (un pour les opérateurs, un pour l'audience, réutilisable
pour un futur produit grand public).

## Décision

**Un seul système d'auth (`auth.contentos.ch`), avec un `accountType` de première classe et
central ; la tenancy reste locale à chaque outil.**

- `accountType ∈ { operator, audience }` est une propriété **de la personne**, portée par le
  user BetterAuth (`additionalFields`, `input: false` → non positionnable par le client), donc
  vraie et héritée dans **tous** les outils de la suite. Défaut : `audience`. Octroi `operator` =
  acte d'administration (pas d'auto-promotion).
- **Tenant / membership = métier local** à chaque outil : c'est l'outil qui décide qui possède
  quoi. Dans `ressources` : table `operators` (profil + handle d'espace), `resources.operator_id`,
  `audience_members(operator_id, user_id)`.
- Pas de super-admin / visibilité cross-tenant en v1 (ajoutable plus tard comme simple
  permission).
- Frontière de confiance tenue par : `accountType` non modifiable côté client + **autorisation
  à la couche données** (toute requête scopée par tenant), pas seulement le middleware.

## Conséquences

- Tout nouvel outil de la suite hérite gratuitement de `accountType` ; il n'a qu'à définir sa
  propre tenancy locale s'il en a besoin.
- `ressources` devient multi-tenant ; `ADMIN_USER_IDS` disparaît (voir spec
  `2026-05-29-operateurs-multi-tenant-design`).
- La frontière opérateur/audience étant une colonne et non un système séparé, la rigueur de
  l'autorisation data-layer est **non négociable** (un bug de scoping = fuite cross-tenant).
- Évolution future possible vers un système d'identité « audience » séparé (produit grand
  public) : c'est une **extraction/migration**, pas un prérequis. On garde l'identité audience
  structurellement séparable (type distinct, tables dédiées) pour ne pas se fermer cette porte.

## Alternatives écartées

- **Deux systèmes d'auth séparés dès maintenant.** Double plomberie (deux instances BetterAuth,
  deux flux OTP/email, deux émetteurs de tokens MCP, deux domaines de cookie) pour un atelier
  petit, alors que l'audience vit déjà dans `auth.contentos.ch`. Le vrai travail (tenancy +
  autorisation) est identique quel que soit le nombre de systèmes. À reconsidérer si l'audience
  devient un produit grand public à part entière.
- **Garder des « niveaux » plats sans type explicite (ex. liste d'IDs admin).** Ne porte pas la
  tenancy, frontière floue, ne s'hérite pas proprement entre outils.
- **Mettre aussi le tenant/membership dans l'auth central.** Injecte du métier produit dans
  l'IdP ; chaque outil a une notion de possession différente. On garde l'auth mince.
