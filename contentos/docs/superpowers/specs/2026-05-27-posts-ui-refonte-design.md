# Refonte UI des posts — design

## Objectif

Les écrans « Posts » (listing + détail/édition) ressemblent à du décoffrage : cartes sans
visuel, aperçu LinkedIn relégué en bas, contrôles peu lisibles. On les fait passer à une
interface soignée, fluide et professionnelle, dans l'identité monochrome existante (shadcn,
thème neutre — pas de couleur de marque introduite).

## Principes de direction

- **Monochrome raffiné** : noir/blanc/gris actuel, mais bien composé (vignettes, hiérarchie
  nette, ombres discrètes, espacements généreux, états de survol).
- **WYSIWYG** : sur le détail, le post LinkedIn *est* la surface d'édition. On tape le texte
  dedans, on clique l'image dedans. Pas de textarea séparée ni de section « Aperçu » distincte.
- **Statuts en français** dans l'UI (`draft` → « brouillon », `validated` → « validé »), valeurs
  DB inchangées.

## Écran 1 — Listing (`/posts`)

`src/app/(app)/posts/page.tsx` + `_components/`.

- **En-tête** : « Posts » + compteur, sous-titre court.
- **Composer** : barre de création raffinée (input titre + bouton primaire « Créer un post »).
  Comportement inchangé : crée un brouillon vide puis redirige vers l'éditeur.
- **Grille de cartes** (responsive `sm:grid-cols-2 xl:grid-cols-3`), chaque carte (`PostCard`) :
  - **Vignette** en tête : le visuel du post (`media.assetKey`) si présent, sinon un placeholder
    neutre avec icône. Ratio fixe, `object-cover`.
  - Badge de statut (français), titre, extrait tronqué, date courte, id court.
  - Survol : légère élévation (ombre + ring).
- **État vide** (`EmptyPostsState`) : repensé, accueillant.

### Donnée

`listPosts` ne joint pas le média. On ajoute **`listPostsWithMedia(userId)`** dans
`src/lib/db/repositories/posts.ts` : `LEFT JOIN media ON posts.media_id = media.id`, renvoie
chaque post + `thumbnail: { url: media.assetKey, kind } | null`. `page.tsx` consomme cette
fonction. `listPosts` reste pour les autres appelants.

## Écran 2 — Détail / édition (`/posts/[id]`)

`src/app/(app)/posts/[id]/page.tsx` + `_components/`.

Mise en page **deux colonnes** (empilées en mobile, `lg:grid-cols-[minmax(0,1fr)_20rem]`) :

### Barre d'action (pleine largeur, en haut)

`← Tous les posts` · pastille de statut (français) · *spacer* · bouton **Supprimer** (icône +
`DeletePostDialog`) · bouton primaire **Valider** / **Validé ✓** (bascule draft↔validated, label
explicite selon l'état ; quand validé, action secondaire « Repasser en brouillon »).

### Colonne gauche — le post éditable (`PostComposer`, nouveau composant)

Reproduit le chrome de `LinkedInPostPreview` (en-tête auteur, pied réactions/actions) mais avec
des zones éditables :

- **En-tête auteur** : avatar/initiales, nom, headline, « Maintenant · 🌐 » (statique, depuis
  `getAuthorIdentity`).
- **Corps éditable** : `<textarea>` auto-agrandissante (pas de scroll interne), typographie
  identique au rendu LinkedIn (`text-sm leading-snug`), fond transparent, sans bordure.
  Sauvegarde sur `onBlur` (comme aujourd'hui).
- **Repère de pli « ··· voir plus »** : règle fine en overlay positionnée en absolu à
  `paddingTop + 3 × lineHeight` (les 3 lignes du `line-clamp-3` de LinkedIn). `pointer-events:none`,
  affichée seulement quand le contenu dépasse 3 lignes (mesure `scrollHeight` vs hauteur 3 lignes).
  Visible **pendant l'édition** — c'est le repère du hook qui manque aujourd'hui.
- **Emplacement visuel dans la carte** (sous le texte, comme une image LinkedIn) :
  - Vide : zone cliquable pleine largeur « ＋ Ajouter un visuel » (discrète, pas un petit bouton
    faible) → ouvre `AddVisualDialog`.
  - Rempli : rend le média plein cadre (image / carrousel avec nav / vidéo), au survol une petite
    barre « Remplacer » (rouvre le dialog) / « Détacher » (`detachMediaAction`).
- **Pied** : réactions/actions LinkedIn statiques (réalisme).

### Colonne droite — inspecteur (sticky)

- **Titre interne** : champ libellé (input), sauvegarde sur `onBlur`. C'est le libellé de
  rangement (n'apparaît pas dans le post LinkedIn).
- **Publication** : `PublishPanel` existant (publier / planifier / état), inchangé.

### Suppressions

L'ancienne section « Visuel » séparée, la section « Aperçu LinkedIn » en bas et la grande
textarea mono disparaissent : tout fusionne dans `PostComposer`.

## Composants

| Fichier | Action |
|---|---|
| `posts/page.tsx` | Restructure en-tête + grille ; consomme `listPostsWithMedia`. |
| `_components/post-card.tsx` | Ajoute vignette, statut FR, survol. |
| `_components/post-create-form.tsx` | Raffinement visuel (comportement inchangé). |
| `_components/empty-state.tsx` | Repensé. |
| `[id]/page.tsx` | Layout deux colonnes ; passe `author`/`mediaInfo`/`templates…` à `PostComposer`, `PublishPanel` dans l'inspecteur. |
| `[id]/_components/post-editor.tsx` | Réécrit : barre d'action + `PostComposer` + inspecteur. |
| `[id]/_components/post-composer.tsx` | **Nouveau** : carte LinkedIn éditable (texte + pli + emplacement visuel). |
| `linkedin/post-preview.tsx` | Inchangé (lecture seule, utilisé par le calendrier). Chrome dupliqué dans `PostComposer` (≈15 lignes, faible risque) plutôt qu'une abstraction prématurée. |
| `lib/db/repositories/posts.ts` | Ajoute `listPostsWithMedia`. |

`AddVisualDialog`, `VisualDisplay` (logique média), `DeletePostDialog`, `PublishPanel` :
réutilisés tels quels, juste repositionnés.

## Tests & vérification

- **Unitaire** : helper de mesure du pli (si extrait en pur), sinon couverture par le rendu.
- **Intégration** : `listPostsWithMedia` — un post avec média (URL présente) et un sans média
  (thumbnail `null`), isolation par `userId`. Suivre `test/integration/posts-repository.test.ts`.
- **Non-régression** : `npm run lint`, `tsc`/`next build`, `npm test` (suite existante).
- **Visuel** : déploiement preview `contentos-<branche>.lab.avqn.ch` (la CI build au push).

## Hors périmètre

Pas de couleur de marque, pas de refonte du `AddVisualDialog`, pas de changement du flux de
publication ni du modèle de données (hors ajout du helper de lecture).
