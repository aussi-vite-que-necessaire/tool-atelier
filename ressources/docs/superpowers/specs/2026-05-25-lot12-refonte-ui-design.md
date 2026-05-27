# Lot 12 — Refonte UI/UX (brutalisme éditorial)

## Intention

La plateforme a des fondations propres mais une expérience visuelle pauvre : pages
clairsemées, hiérarchie typographique faible, callouts nus, états vides non traités, console
admin brute. L'identité **noir & blanc brutaliste** est conservée et poussée à un niveau
*intentionnel et vivant* : papier chaud, une couleur d'accent vermillon utilisée avec
parcimonie, ombres portées dures avec effet d'enfoncement au survol, vraie échelle
typographique, rythme d'espacement, composants soignés, micro-animations.

Le modèle de données, les routes, le serveur MCP et la logique métier sont inchangés. La
refonte est purement présentation : tokens, composants, layouts.

## Système de design

### Tokens (oklch, dans `app/globals.css`)

- **Papier** `--paper` (fond, blanc cassé chaud), `--paper-2` (panneaux, gris très clair).
- **Encre** `--ink` (texte/bordures, noir chaud), `--ink-soft` (texte secondaire).
- **Accent** `--accent` (vermillon), `--accent-ink` (texte sur accent), `--accent-soft`
  (lavis pour survols/sélection). Usage *restreint* : CTA primaire, état actif de navigation,
  numéros d'étapes, liens au survol, focus, filets d'accent.
- **Sémantique callouts** `--c-info` (bleu), `--c-success` (vert), `--c-warn` (ambre), fond
  plat + encre noire.
- **Ombres** `--shadow-brutal` (`4px 4px 0 ink`), `-sm` (`2px 2px`), `-lg` (`6px 6px`).
- **Rayon** 0 (angles francs). **Polices** Geist Sans (UI/texte) + Geist Mono (code, labels
  techniques).

Les tokens de base existants (`background`, `foreground`, `muted`, `muted-foreground`,
`border`, `accent`) sont remappés sur cette palette : tout le code qui les utilise déjà hérite
du nouveau rendu sans réécriture.

### Signature visuelle

- **Carte/bouton brutal** : bordure 2px encre + ombre portée dure. Au survol : translation
  `(2px,2px)` et ombre réduite → effet d'appui tactile. Respecte `prefers-reduced-motion`.
- **Filet d'accent** : court trait vermillon sous les titres de section / en marqueur d'état actif.
- **Labels techniques** en Geist Mono, petites capitales, `tracking` large.

### Primitives (`components/ui/`)

- `Button` (cva) : variantes `accent`, `solid`, `outline`, `ghost` ; tailles `sm|md|lg`.
- `Card` : conteneur brutal, ombre + lift optionnels.
- `Badge` : pastille capitales (statut, tag).
- `Reveal` (client, `motion`) : apparition fondu + translation à l'entrée dans le viewport,
  léger décalage en cascade.
- Classes CSS utilitaires `.field`, `.btn`, `.btn-accent` pour les formulaires (réduit la
  répétition dans l'admin).

## Écrans

### Surface visiteur

- **Accueil** (`/`) : hero (titre display surdimensionné, filet d'accent, tagline, wordmark),
  puis **grille de cartes** ressources (cover ou motif généré, titre, description, badge, flèche,
  lift au survol). État vide traité. Pied de page sobre.
- **Lecteur** (`/r/...`) : barre de progression de lecture en haut ; en-tête sticky (wordmark +
  fil d'Ariane + accès bibliothèque) ; 3 colonnes (arbre de pages / contenu / sommaire) aux
  bordures et espacements travaillés ; arbre avec état actif (filet d'accent), sommaire avec
  **section active** surlignée au scroll ; bloc-titre de page ; navigation précédent/suivant en
  bas ; tiroir mobile pour l'arbre.
- **Bibliothèque** (`/bibliotheque`) : en-tête avec identité utilisateur, grille de cartes
  abonnées (désinscription en action secondaire), état vide incitatif (CTA explorer).
- **Connexion / Gate** : carte centrée avec ombre portée, wordmark, parcours OTP en deux temps
  (email → code), champ de code en grandes capitales espacées, bouton accent, états
  chargement/erreur soignés.

### Les 14 modules

Chaque bloc repris dans le système : `markdown` (typographie prose), `callout` (fond
sémantique + icône Lucide), `image`/`video`/`embed` (cadre + légende), `gallery` (grille,
zoom léger au survol), `file` (carte de téléchargement, icône + poids), `code` (badge langage,
nom de fichier, bouton copier avec retour), `prompt` (cadre accent, copier), `accordion`
(chevron animé), `steps` (pastilles numérotées accent + filet de liaison), `comparison`
(cartes à ombre), `quote` (guillemet éditorial surdimensionné, accent), `cta` (primaire =
accent plein + appui, secondaire = contour).

### Console admin

- **Layout** : barre supérieure (wordmark, nav, déconnexion).
- **Tableau de bord** : cartes KPI (ressources, vues totales, gate), liste des ressources en
  lignes structurées avec badges de statut, formulaire de création stylé.
- **Éditeur de ressource** : sections en cartes, champs stylés, bouton aperçu, zone de danger.
- **Éditeur de page / builder** : champs, sélecteur de type, boutons et cartes de module
  homogènes avec le reste — logique et server actions inchangées.

## Non-objectifs

- Pas de changement de schéma, de routes, d'API/MCP, de logique d'accès ou de stats.
- Pas de refonte fonctionnelle du builder (drag&drop, aperçu live : restent au backlog).
- Emails transactionnels hors périmètre.

## Vérification

- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` au vert.
- Captures avant/après de tous les écrans (desktop + mobile) via `scripts/shots.mjs`.
- Parcours manuel : accueil → ressource → toutes les familles de blocs → bibliothèque →
  admin, connecté et déconnecté.
