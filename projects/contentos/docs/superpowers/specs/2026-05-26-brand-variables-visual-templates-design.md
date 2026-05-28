# Variables d'identité de marque dans les templates visuels

## Objectif

Rendre les éléments d'identité de marque utilisables comme variables statiques
dans les templates visuels, substituées automatiquement au rendu :

- `{{brand.name}}` — nom de marque
- `{{brand.color}}` — couleur principale (hex)
- `{{brand.signature}}` — signature
- `{{brand.logo}}` — URL du logo (nouveau)

Et ajouter un **logo** à l'identité de marque, uploadable depuis les réglages.

À la différence des variables d'un template (déclarées dans son schéma, saisies
post par post), ces handles puisent dans une source unique — l'identité de marque
du compte — et sont disponibles dans n'importe quel template sans déclaration.

## État actuel

- La table `settings` porte `brand_name`, `brand_color`, `brand_signature`.
- `compileTemplate` injecte déjà un objet `brand` (`{ name, color, signature }`)
  dans le contexte Handlebars : `{{brand.name}}`, `{{brand.color}}`,
  `{{brand.signature}}` sont donc résolus au rendu. Aucun template ne s'en sert
  et aucune UI ne les expose.
- L'objet `brand` est reconstruit à la main dans trois chemins de rendu :
  - `src/worker/queues/render-visual.ts` (rendu final + aperçu via worker)
  - `src/app/(settings)/settings/visual-templates/preview-actions.ts` (aperçu éditeur)
  - `src/app/(app)/posts/[id]/media-actions.ts` (aperçu live côté post)
- Handlebars compile en **strict mode** : référencer une clé absente lève. Toute
  clé de `brand` doit donc toujours être présente (chaîne vide si non renseignée).
- L'upload d'image existe (`src/lib/media/upload-core.ts`) : valide le fichier,
  pousse les octets au media engine, qui renvoie une URL publique permanente.

## Conception

### 1. Donnée — logo dans `settings`

Nouvelle colonne `settings.brand_logo_url` (`text`, nullable, défaut `null`).
Elle stocke l'URL publique du logo renvoyée par le media engine. `{{brand.logo}}`
vaut cette URL, ou chaîne vide si aucun logo.

Le logo est une propriété singleton de la marque, pas une image de galerie : on
stocke l'URL directement dans `settings` plutôt qu'un `mediaId` à résoudre. Cela
évite d'entrelacer le logo avec la table `media`/la galerie et garde le contexte
`brand` sans lookup supplémentaire.

Migration Drizzle générée via `db:generate`.

### 2. Upload du logo

`src/lib/media/brand-logo-core.ts` :

- `uploadBrandLogoCore(userId, file)` : valide (`validateUploadFile` — png/jpg/webp,
  max 10 Mo), pousse au media engine, écrit `brandLogoUrl = obj.url`. Renvoie
  `{ status: 'success', url }` ou `{ status: 'error', message }`.
- `removeBrandLogoCore(userId)` : écrit `brandLogoUrl = null`.

`SettingsPatch` (repository `settings`) gagne `brandLogoUrl`.

Server actions dans `src/app/(settings)/settings/brand/actions.ts` :
`uploadBrandLogo` et `removeBrandLogo`, chacune `revalidatePath('/settings/brand')`.

### 3. Contexte `brand` centralisé

`src/lib/visual-templates/brand.ts` :

```ts
export type Brand = { name: string; color: string; signature: string | null; logo: string };
export const EMPTY_BRAND: Brand;                 // { name:'', color:'#000000', signature:null, logo:'' }
export async function buildBrandContext(userId: string): Promise<Brand>;
```

`buildBrandContext` lit `getSettings` et mappe : `signature` → `null` si vide,
`logo` → `brandLogoUrl ?? ''`. Les trois chemins de rendu l'appellent à la place
de leur construction inline.

`compile.ts` et `preview.ts` importent le type `Brand` (champ `logo` inclus) au
lieu de le redéfinir.

### 4. Découvrabilité dans l'éditeur

Dans `visual-template-form.tsx`, section « Code (HTML / CSS) », un encart liste les
handles de marque disponibles avec une courte description :

- `{{brand.name}}` — Nom de marque
- `{{brand.color}}` — Couleur principale (hex)
- `{{brand.signature}}` — Signature
- `{{brand.logo}}` — URL du logo, à placer dans `<img src="…">` ou `background-image`

### 5. UI réglages

`src/app/(settings)/settings/brand/page.tsx` passe `brandLogoUrl` à un composant
`LogoField` (client) : aperçu du logo courant, input fichier (png/jpg/webp), bouton
supprimer. Le formulaire texte existant reste inchangé.

### 6. MCP

`get_settings` renvoie l'objet `Settings` complet : `brandLogoUrl` y apparaît
automatiquement. Le rendu injecte `brand` côté serveur — aucun nouvel outil requis.

## Tests (TDD)

- `compileTemplate` : `{{brand.logo}}` rend l'URL fournie.
- `buildBrandContext` : mappe settings → brand (logo présent / absent, signature
  vide → null) ; défauts quand aucune row settings.
- `brand-logo-core` (integration) : upload écrit `brandLogoUrl`, remove l'efface,
  format non supporté rejeté.
- `settings` repository : `updateSettings` accepte `brandLogoUrl` (set + clear).

## Hors scope (YAGNI)

- Pas de suppression de l'asset orphelin côté engine au remplacement/retrait du logo.
- Pas d'outil MCP d'écriture de l'identité de marque.
- Pas de recadrage/redimensionnement du logo.
