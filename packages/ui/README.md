# @contentos/ui — composants partagés

Source **canonique** des composants UI partagés entre les projets de la suite
(`cast`, `media`, `ressources`, …). Socle esthétique : **cast** (shadcn + `@base-ui/react`,
tokens OKLch, polices Geist, thème clair/sombre).

Pas de registre npm, pas de workspace : le build Docker est scopé par projet
(contexte = `projects/<projet>/`). On suit donc le modèle **shadcn** : `packages/ui`
est la vérité, et on **copie** les composants dans chaque projet avec `bin/ui-sync`.

## Contenu (approche atomique light)

| Fichier | Rôle |
| --- | --- |
| `src/styles/tokens.css` | Tokens — couleurs OKLch (clair/sombre), rayons, polices |
| `src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) |
| `src/components/button.tsx` | **atome** — bouton (variantes default/outline/secondary/ghost/destructive/link) |
| `src/components/typography.tsx` | **atomes** — `Heading` (h1–h4), `Lead`, `Text`, `Muted`, `Code` |
| `src/components/badge.tsx` | **atome** — badge |
| `src/components/card.tsx` | **molécule** — carte (`Card`, `CardHeader`, …) |
| `src/components/dialog.tsx` | **primitives** — modale (`@base-ui/react`) |
| `src/components/confirm-dialog.tsx` | **molécule** — confirmation oui/non |
| `src/components/sidebar.tsx` | **organisme** — navigation latérale |

La vitrine vivante est le projet `projects/styleguide/` → `styleguide.contentos.ch`.

## Synchroniser dans un projet

Depuis la racine de l'atelier :

```bash
bin/ui-sync <projet>          # copie composants + utils dans projects/<projet>
bin/ui-sync --check <projet>  # vérifie l'absence de dérive (exit 1 si dérive)
bin/ui-sync --list            # liste les composants gérés
```

Les fichiers copiés arrivent sous `projects/<projet>/src/components/ui/` et
`projects/<projet>/src/lib/utils.ts`, préfixés d'un en-tête `@generated`.
**On ne les édite pas dans le projet** : on modifie ici puis on resynchronise.

### Mise en place initiale d'un projet consommateur

1. Ajouter les dépendances (cf. `peerDependencies` de `manifest.json`) :
   `@base-ui/react`, `class-variance-authority`, `clsx`, `lucide-react`,
   `tailwind-merge`, `tailwindcss`, `tw-animate-css`, `shadcn`.
2. Copier les tokens une fois (rarement modifiés) : `cp packages/ui/src/styles/tokens.css projects/<projet>/src/styles/ui-tokens.css`,
   puis dans `globals.css`, après les imports framework :
   ```css
   @import "tailwindcss";
   @import "tw-animate-css";
   @import "shadcn/tailwind.css";
   @import "./ui-tokens.css";
   ```
3. Exposer les polices Geist sur `<html>` via `next/font` (variables
   `--font-geist-sans` / `--font-geist-mono`).
4. `bin/ui-sync <projet>`.

> Les composants importent `@/lib/utils` et `@/components/ui/*` : ils supposent
> l'alias `@/* → ./src/*` (convention de l'atelier, déjà en place dans les projets Next).
