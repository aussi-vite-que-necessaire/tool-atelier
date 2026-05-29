# styleguide — vitrine du design system

Projet **styleguide** de la suite **contentos** (`styleguide.contentos.ch`). Site maison
(pas de Storybook) qui présente la librairie de composants partagés **`@contentos/ui`**
(socle **cast**). **Public**, sans base de données.

## Source des composants — `packages/ui`

Les composants ne vivent pas ici : la source canonique est **`packages/ui/`** (racine de
l'atelier). Le build Docker étant scopé par projet, on suit le modèle shadcn — on **copie**
la librairie dans le projet :

```bash
bin/ui-sync styleguide          # copie composants + utils dans src/components/ui & src/lib
bin/ui-sync --check styleguide  # vérifie l'absence de dérive
```

Les fichiers `src/components/ui/*` et `src/lib/utils.ts` sont **générés** (en-tête
`@generated`). On ne les édite pas : on modifie `packages/ui` puis on resynchronise.
Les tokens (`src/styles/ui-tokens.css`) sont copiés une fois depuis
`packages/ui/src/styles/tokens.css` et importés par `globals.css`.

## Repères

- `src/app/` — App Router. `globals.css` importe Tailwind + `ui-tokens.css`.
- `src/components/styleguide/` — la vitrine (shell + sections). **Seul** code propre au projet.
- `src/components/ui/`, `src/lib/utils.ts` — **générés** par `bin/ui-sync` (ne pas éditer).
- `healthz/route.ts` — `GET /healthz` → 200, ne touche aucune ressource.
- `lab.json` — aucune capacité (vitrine statique).

## Ajouter / modifier un composant

1. Éditer/créer le composant dans `packages/ui/src/components/` (+ l'ajouter aux `mappings`
   de `bin/ui-sync` si nouveau).
2. `bin/ui-sync styleguide` (et les autres projets consommateurs).
3. Ajouter une section de démonstration dans `src/components/styleguide/styleguide.tsx`.

## Déployer

`git push` sur une branche → preview `https://styleguide-<branche>.preview.contentos.ch`.
Merge de la PR → prod `https://styleguide.contentos.ch`. Jamais de commit sur `main`.
