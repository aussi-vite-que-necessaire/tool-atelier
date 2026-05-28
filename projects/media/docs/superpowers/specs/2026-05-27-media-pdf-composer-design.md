# Composer un PDF depuis la galerie — design

Page d'admin pour assembler un PDF à partir d'images de la galerie. Le moteur d'agrégation
(`aggregatePdf`) existe déjà et alimente l'outil MCP `create_pdf` et l'endpoint `/v1/pdf` ; il
manque l'interface humaine pour le piloter.

## Objectif

Depuis l'admin, sélectionner des images de la galerie dans l'ordre voulu, les réordonner, puis
produire un PDF (une image par page). Le PDF est stocké comme média (`kind: "pdf"`) et apparaît
dans la galerie.

## Périmètre

Inclus :

- Nouvelle page admin `/pdf` (route group `(admin)`, protégée par la session héritée du layout).
- Sélection « clic = ajout en séquence » : la galerie d'un côté, la liste des pages du PDF de
  l'autre, avec réordonnancement (monter/descendre) et retrait.
- Champ « tags » optionnel appliqué au PDF produit (pour le retrouver dans la galerie).
- Extension de `aggregatePdf` : paramètre `tags?: string[]` (défaut `[]`), rétrocompatible avec les
  appelants MCP / `/v1` existants.

Exclus (YAGNI) :

- Glisser-déposer (pas de dépendance DnD).
- Options de mise en page (taille de page forcée, marges, plusieurs images par page) : le moteur
  reste « une image par page, plein cadre, page aux dimensions de l'image ».
- Modification des surfaces MCP / `/v1` (leur signature ne change pas : `tags` y reste implicite à
  `[]`).

## Formats supportés

`buildPdf` n'embarque que **PNG et JPEG** (détection par magic bytes). Le picker ne liste donc que
les images dont le `mime` est `image/png` ou `image/jpeg`, parmi les `kind` `image` et `render`.
Les WebP, vidéos et PDF existants sont exclus de la sélection — ce qui évite un échec d'agrégation
côté serveur.

## Architecture & fichiers

```
src/app/(admin)/pdf/
  page.tsx      # server component : liste les images éligibles, rend le composer
  composer.tsx  # client component : galerie cliquable + liste de pages + tags + bouton construire
  actions.ts    # server action composePdfAction(ids, tags) -> aggregatePdf
  order.ts      # helpers purs de manipulation de la liste ordonnée (testés)
```

Nav : ajout de `{ href: "/pdf", label: "PDF" }` dans `src/app/(admin)/layout.tsx`.

### `page.tsx` (serveur)

- `listMediaRecords({ kind: "image", limit: 100 })` + `listMediaRecords({ kind: "render", limit: 100 })`,
  fusion, tri par `created_at` décroissant, puis filtre `mime ∈ {image/png, image/jpeg}`.
- Passe la liste (`id`, `url`, `mime`, `created_at`) au `composer` (client).

### `composer.tsx` (client)

- État local : `selected: string[]` (ids ordonnés des pages du PDF).
- Galerie en grille (style repris de `/gallery`) : clic sur une image → `addImage` (ajout en fin,
  même image autorisée une seule fois). Une image déjà sélectionnée est marquée (badge numéro).
- Liste des pages : vignette + n° + boutons monter / descendre / retirer (`moveUp`, `moveDown`,
  `removeAt`).
- Champ texte « tags » (séparés par des virgules) → normalisés en `string[]`.
- Bouton « Construire le PDF » : désactivé si `selected` vide ou pendant la construction. Soumet
  `selected` (JSON) + `tags` au server action via `useTransition` / appel direct.
- Après succès : affiche un bandeau « PDF créé » avec lien `Ouvrir le PDF` (nouvel onglet) et vide
  `selected`. En cas d'erreur (ex. format), affiche le message renvoyé.

### `actions.ts` (serveur)

```ts
"use server";
export async function composePdfAction(input: { imageIds: string[]; tags: string[] })
  : Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  // valide non-vide, appelle aggregatePdf(imageIds, tags), revalidatePath("/gallery"),
  // renvoie { ok, url } ou { ok:false, error } (try/catch sur les erreurs du moteur).
}
```

Le server action renvoie un résultat structuré (et non un `throw`) pour que le composer affiche
proprement succès/erreur sans page d'erreur Next.

### `order.ts` (pur, testé)

`addImage(list, id)`, `removeAt(list, i)`, `moveUp(list, i)`, `moveDown(list, i)` — fonctions pures
sur `string[]`, sans mutation de l'entrée, bornes respectées.

## Flux de données

1. La page (serveur) charge les images éligibles et les passe au composer.
2. L'utilisateur clique des images (ajout en séquence), réordonne, saisit des tags.
3. « Construire » → server action → `aggregatePdf(ids, tags)` → `store(...)` (R2 + Postgres,
   `kind: "pdf"`, `source: "pdf_aggregate"`, `tags`).
4. Le PDF apparaît dans `/gallery?kind=pdf` ; le composer affiche le lien et se réinitialise.

## Gestion des erreurs

- Liste vide → bouton désactivé (et garde côté action : `{ ok:false }`).
- Image introuvable / octets absents / format non supporté → `aggregatePdf` lève ; l'action capte
  et renvoie `{ ok:false, error }`, affiché dans le composer.
- Le pré-filtrage PNG/JPEG rend le cas « format non supporté » improbable, mais l'action reste
  défensive.

## Tests

- `test/pdf-order.test.ts` (vitest, logique pure) : `addImage` (ajout, pas de doublon),
  `removeAt`, `moveUp` / `moveDown` (y compris aux bornes, sans mutation).
- `aggregatePdf` (DB + R2) reste hors tests unitaires, conformément à la convention du dépôt
  (les tests ne touchent ni Postgres ni R2). Vérification par `tsc --noEmit` + `next build`.

## Déploiement

`git push` de la branche → preview `https://media-<branche>.lab.avqn.ch` ; merge de la PR → prod.
Aucun changement de schéma DB, aucun nouveau secret.
