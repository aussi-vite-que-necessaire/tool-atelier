# Galerie admin — génération et édition d'image par IA

Front-end d'administration de `media` : la galerie devient un poste de travail image complet.
On y génère une image par IA, on agrandit une image dans une modale, on l'édite par IA en
chaîne, et toute suppression passe par une confirmation.

## Objectif

Donner à l'admin (`/gallery`) les capacités IA déjà exposées par le MCP et l'API `/v1`, sans
quitter la galerie :

1. **Générer** une image par IA depuis la galerie (prompt + ratio + style optionnel).
2. **Agrandir** une image au clic, dans une modale.
3. **Éditer** l'image affichée par IA (prompt) — crée une variante dérivée ; la modale bascule
   sur le résultat pour permettre l'édition en chaîne.
4. **Confirmer** toute suppression d'un média (modale oui/non).

## Architecture

`gallery/page.tsx` reste un composant serveur : il charge les médias (`listMediaRecords`) et la
liste des styles (`listStyles`), puis délègue l'interactivité à des îlots client. Les actions
serveur réutilisent le moteur existant — aucune logique de génération/édition n'est dupliquée.

### Composants

- **`page.tsx`** (serveur) — filtres par `kind`, section haute en deux colonnes
  (upload | génération), puis la grille. Passe `items` et `styles` aux îlots client.
- **`generate-form.tsx`** (client) — formulaire de génération via `useActionState(generateAction)` :
  champ prompt, sélecteur de ratio, menu déroulant de style (« Aucun style » par défaut), état
  `pending`, message d'erreur, aperçu du résultat. Pattern calqué sur `template-preview.tsx`.
- **`gallery-grid.tsx`** (client) — reçoit `items`, rend la grille (mêmes vignettes
  qu'aujourd'hui) et porte l'état des modales :
  - **Modale d'agrandissement / édition** : ouverte au clic sur une vignette `image`/`render`.
    Affiche l'image en grand + ses métadonnées + un formulaire d'édition IA
    (`useActionState(editAction)`). Au succès, la modale remplace l'image affichée par la
    variante renvoyée (id/url) → édition en chaîne.
  - **Modale de confirmation de suppression** : déclenchée par le bouton « Supprimer » de chaque
    carte ; « Oui » soumet `deleteMediaAction`, « Non » ferme.

### Actions serveur (`gallery/actions.ts`)

- `generateAction(prev, formData) → { id?, url?, error? }` — lit `prompt`, `aspectRatio`,
  `styleId` ; résout le style (`getStyle`) → `composePrompt` → `generateImage` → `store({ source:
  "gemini_generate", style_id })`. `revalidatePath("/gallery")`.
- `editAction(prev, formData) → { id?, url?, error? }` — lit `sourceId`, `prompt` ; charge la
  source (`getMediaRecord` + `getImageBytes`) → `editImage` → `store({ parent_id, source:
  "gemini_edit" })`. `revalidatePath("/gallery")`.
- `uploadAction`, `deleteMediaAction` — inchangées.

Ces actions reproduisent la logique des handlers `/v1` `handleGenerate` / `handleEdit`, mais
côté session admin (pas de clé de service). On extrait la logique commune partagée si la
duplication devient gênante ; à ce stade, les deux chemins restent fins.

### Flux de données

Après une action de mutation, `revalidatePath("/gallery")` provoque le re-rendu du composant
serveur : la grille reflète l'image neuve sans rechargement manuel. La modale d'édition utilise
en plus l'`{ id, url }` renvoyé par l'action pour basculer son affichage sur la variante.

## Réglages exposés

- **Ratios** : `1:1` (défaut), `16:9`, `9:16`, `4:5`, `4:3` — passés tels quels à Gemini.
- **Styles** : menu déroulant alimenté par `listStyles()` ; valeur vide = aucun style.
- L'édition IA ne prend qu'un prompt (le moteur `editImage` n'applique pas de style).

## Portée

- Agrandissement + édition IA concernent les médias raster (`kind` `image` ou `render`). Vidéo et
  PDF gardent leur vignette actuelle (lecteur / lien) sans modale d'agrandissement.
- La confirmation de suppression couvre **tous** les médias (cohérence).
- La section haute en deux colonnes (upload | génération) est visible quel que soit le filtre ;
  la génération produit toujours une image.

## Gestion d'erreurs

Génération/édition peuvent échouer (erreur Gemini, source absente, clé manquante). Les actions
renvoient `{ error }` ; les formulaires l'affichent en rouge sous le bouton. L'état `pending`
désactive le bouton et affiche « Génération… » / « Édition… ».

## Dépendance de déploiement

La génération et l'édition exigent `GEMINI_API_KEY` dans le scope `media` (`/lab-secret`). À
vérifier sur la preview : si la clé manque, les actions renvoient une erreur explicite plutôt que
de planter.

## Tests & vérification

La logique métier (composition de prompt, store, gemini) est déjà couverte / hors-périmètre du
front. Cette tâche est surtout du câblage UI : vérification par `tsc`/`next build`, `npm test`
(non-régression), puis contrôle manuel sur la preview (générer, agrandir, éditer en chaîne,
confirmer une suppression).
