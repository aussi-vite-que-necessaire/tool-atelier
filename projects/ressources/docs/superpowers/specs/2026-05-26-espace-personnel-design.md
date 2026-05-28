# Espace personnel (lecteur)

Un lecteur connecté dispose de deux pages distinctes, reliées par un en-tête commun :

- **`/bibliotheque` — Ma bibliothèque** : vue de lecture. Les cartes ouvrent les ressources.
- **`/compte` — Mon compte** : centre personnel. Nom modifiable, email en lecture seule,
  déconnexion, et gestion des abonnements (liste + se désinscrire).

Aucun changement de modèle de données : `user.name` et la table `subscriptions` existent déjà.

## Navigation

Composant `components/library-nav.tsx` exportant `<LibraryNav active="library" | "account" />`,
passé en `right` à `SiteHeader`. Deux liens — « Ma bibliothèque » et « Mon compte » — la page
courante surlignée. Présent sur les deux pages.

## `/compte`

`app/compte/page.tsx`, `force-dynamic`, redirige vers `/connexion` sans session. Style
brutaliste existant, deux sections :

- **Profil** : champ « Nom » éditable (form → server action), email en lecture seule, bouton
  **Se déconnecter**. Tant que le nom est vide, l'affichage retombe sur l'email.
- **Mes ressources** : liste compacte des abonnements (titre cliquable vers `/r/<slug>` +
  bouton **Se désinscrire** par ligne) avec état vide. Source : `listSubscriptions`.

## `/bibliotheque`

Grille de cartes de lecture (cartes → ouverture de la ressource) et état vide. L'en-tête reçoit
`<LibraryNav active="library" />`. Les cartes n'ont pas d'action de gestion.

## Actions serveur

`lib/actions/account.ts` :

- `signOutAction` — déconnecte puis redirige vers `/connexion`.
- `unsubscribeAction(formData)` — retire l'abonnement, revalide `/compte` et `/bibliotheque`.
- `updateNameAction(formData)` — `auth.api.updateUser({ body: { name }, headers })`, revalide
  `/compte`.

## Logique pure + tests

`lib/account.ts` :

- `normalizeName(input)` — trim, tronque à 80 caractères, autorise la chaîne vide.
- `displayName({ name, email })` — renvoie le nom s'il est non vide, sinon l'email.

Tests Vitest unitaires sur ces deux fonctions (convention « logique pure » du projet).

## Vérification visuelle

Captures Playwright via le harnais OTP (`scripts/shots.mjs`) sur `/compte` et `/bibliotheque`.

## Hors périmètre

Pas de catégorie « cours », pas d'onboarding du nom à la connexion, pas de modification du
reader `/r/[slug]`.
