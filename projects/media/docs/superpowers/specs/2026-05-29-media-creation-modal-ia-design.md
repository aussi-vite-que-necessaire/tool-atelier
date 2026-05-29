# Réorganisation de l'admin — Galerie hub + modal de création unique

Refonte de l'**architecture d'information** du front-end d'admin de `media`. Aujourd'hui les
*méthodes de création* sont éparpillées (upload + génération coincés dans l'en-tête de la galerie,
composition de PDF isolée comme item de nav), ce qui brouille la lecture du système. On regroupe
toute la création derrière une porte unique et on clarifie la navigation, pour poser une base
cohérente. **Pur travail d'organisation : aucune logique métier réécrite.**

## Objectif

Que chaque chose soit à sa place :

1. **Galerie = hub unique des médias.** Tout y vit (images, vidéos, PDF, renders), filtrable par
   type. C'est la seule destination « médias ».
2. **Une seule porte de création** : un bouton « Ajouter à la galerie » ouvre une grande modal
   (near-fullscreen) adressable par URL, avec des **onglets** par méthode.
3. **Navigation clarifiée** : `Galerie` en tête, puis une section `Bibliothèque` regroupant les
   réglages qui nourrissent la génération (`Templates`, `Styles`, `Chartes`, `Marque`). La page
   `/pdf` de premier niveau disparaît.

Non-objectifs (YAGNI) : pas de dark mode, pas de reskin, pas de nouvelle capacité média, pas
d'extraction d'un design-system. On déplace et regroupe l'existant. Copie FR et palette grises
conservées.

## Architecture

Tout se joue dans le route group `(admin)`. Les composants serveur continuent de charger les
données ; les Server Actions de mutation sont **réutilisées telles quelles** (`uploadAction`,
`generateAction`, `composePdfAction`). On ne touche ni aux repositories, ni au moteur de
génération/PDF, ni à la session/au middleware.

### Navigation (`(admin)/layout.tsx`)

La sidebar passe d'une liste plate de 6 liens à une structure typée en sections :

```
const navSections = [
  { label: null,           links: [{ href: "/gallery", label: "Galerie" }] },
  { label: "Bibliothèque", links: [
      { href: "/templates",    label: "Templates" },
      { href: "/styles",       label: "Styles" },
      { href: "/style-guides", label: "Chartes" },
      { href: "/brand",        label: "Marque" },
  ] },
];
```

Chaque section avec `label` affiche un petit intitulé discret (gris, majuscules légères). L'entrée
`PDF` est retirée — la composition de PDF devient une méthode de création (onglet de la modal).

### La modal de création

C'est une **vraie route** rendue en overlay near-fullscreen — une « fausse modal » avec son URL
propre, présentée par-dessus la galerie.

- **Route** : `(admin)/gallery/new/page.tsx` (Server Component). L'onglet actif est porté par la
  query `?tab=upload|generate|pdf` (défaut `upload`) → chaque onglet est deep-linkable.
- La route serveur **fetch ce dont les onglets ont besoin** :
  - `listStyles(userId)` pour l'onglet génération ;
  - les images/renders sélectionnables (PNG/JPEG, mêmes filtres qu'aujourd'hui via
    `listMediaRecords`) pour l'onglet PDF.
  Elle passe ces données au composant client de la modal.
- **`(admin)/gallery/new/add-media-dialog.tsx`** (client) — le panneau overlay : backdrop sombre,
  grand conteneur centré, barre d'onglets en haut, bouton de fermeture. Fermer (croix, clic
  backdrop, `Échap`) navigue vers `/gallery`. Les onglets sont des liens qui changent `?tab=` ; le
  composant rend le contenu de l'onglet actif.
- **Décision (choix le plus simple)** : overlay via route classique + panneau `fixed`, **pas** le
  combo *parallel/intercepting routes* de Next. Ça satisfait « URL propre + modal par-dessus »
  sans la machinerie supplémentaire. La galerie n'est pas rendue vivante derrière, mais le panneau
  near-fullscreen + backdrop la couvre — sans incidence sur l'objectif.

### Onglets de la modal

- **Uploader un fichier** — le formulaire d'upload actuellement en dur dans `gallery/page.tsx` est
  déplacé ici (mêmes champs, `accept`, note de tailles, `uploadAction`).
- **Générer une image (IA)** — le `GenerateForm` existant (`gallery/generate-form.tsx`), réutilisé
  tel quel, alimenté par les `styles` chargés par la route. Le libellé « Générer une image (IA) »
  explicite que la génération ne produit qu'une image.
- **Composer un PDF** — le `Composer` existant (`pdf/composer.tsx`) **migré** dans cet onglet, avec
  tout l'espace de la modal. Reçoit la liste des images sélectionnables fournie par la route.

### Migrations de code

- **Suppression** de `(admin)/pdf/page.tsx` et de l'entrée de nav `PDF`.
- **Relocalisation** sous `(admin)/gallery/new/` (logique inchangée) :
  - `pdf/composer.tsx` → le composer (client) ;
  - `pdf/actions.ts` (`composePdfAction`, `normalizeTags`) ;
  - `pdf/order.ts` (helpers purs `addImage`/`removeAt`/`moveUp`/`moveDown`).
  Les imports et le ou les tests existants ciblant `order.ts` sont repointés vers le nouveau
  chemin. `composePdfAction` fait déjà `revalidatePath("/gallery")` → le PDF produit atterrit dans
  le hub, cohérent avec la nouvelle organisation.
- **`gallery/page.tsx`** : on retire les deux blocs « upload » et « génération » de l'en-tête ; la
  page devient `titre + filtres par type + bouton « Ajouter à la galerie » (lien vers
  /gallery/new) + grille`. `GalleryGrid` et les actions (`editAction`, `deleteMediaAction`) sont
  inchangés.

## Flux de données

Inchangé sur le fond. Après une création (upload / génération / PDF), les actions appellent déjà
`revalidatePath("/gallery")` : la modal peut alors fermer et renvoyer vers `/gallery` à jour, ou
rester ouverte sur l'onglet pour enchaîner (comportement actuel du `GenerateForm`/`Composer`
conservé — aperçu du résultat dans l'onglet). On ne change pas la mécanique de retour des actions.

## Gestion d'erreurs

Inchangée : les actions renvoient leurs `{ error }` / `{ ok:false, error }` actuels, affichés dans
l'onglet concerné comme aujourd'hui. Une route `/gallery/new?tab=` avec une valeur inconnue retombe
sur `upload`.

## Portée

- On **réorganise** : déplacement de l'upload et de la génération dans la modal, migration du
  composer PDF, regroupement de la nav, suppression de `/pdf`.
- On **ne change pas** : les Server Actions, les repositories, le moteur Gemini/PDF, la grille, les
  modales d'agrandissement/édition/suppression de la galerie, la session/le middleware.
- Renders : restent visibles et filtrables dans la galerie ; pas de création dédiée (ils viennent
  du MCP/API), inchangé.

## Tests & vérification

Surtout du recâblage UI + déplacements de fichiers. Garde-fous :

- `npm run build` (tsc + next build) vert — vérifie les imports repointés et la nouvelle route.
- `npm test` vert — non-régression ; les helpers purs `order.ts` gardent leur couverture après
  relocalisation (test repointé). Petit test pur possible sur la résolution de l'onglet actif
  (`tab` inconnu → `upload`) si on isole un helper.
- Contrôle manuel sur la preview : ouvrir la modal depuis la galerie, vérifier les trois onglets
  (uploader, générer une image, composer un PDF), le deep-link `?tab=`, la fermeture
  (croix/backdrop/Échap), et que la nav groupée ne référence plus `/pdf`.
