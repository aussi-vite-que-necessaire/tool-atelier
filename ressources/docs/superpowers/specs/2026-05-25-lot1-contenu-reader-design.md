# Lot 1 — Modèle de contenu modulaire + reader public

## Contexte

`lab-ressources` est une plateforme de ressources (lead magnets) pour une communauté
LinkedIn. Chaque ressource possède un lien public et sert à approfondir un sujet (IA,
automatisation, cloud). À terme, la plateforme est pilotée par API et MCP, avec
authentification par magic link, bibliothèque personnelle par utilisateur, statistiques et
builder visuel. Le projet est découpé en lots livrables ; ce document spécifie le **lot 1**.

Le lot 1 pose le socle technique et l'abstraction centrale — la ressource modulaire — puis
la rend lisible via un reader public. Les lots suivants (auth & bibliothèque, API & MCP,
statistiques, builder) se branchent sur ce modèle sans le refondre.

## Objectif

Un visiteur ouvre `/r/<slug>` et lit une ressource : page racine et sous-pages dans une
arborescence, contenu composé de modules typés, rendu SSR au style brutaliste N&B. Le
contenu est inséré par un script de seed (pas encore d'écriture via interface ou API).

## Périmètre

Dans le lot :

- Socle applicatif : Next.js 16 (App Router) + Drizzle ORM + Postgres, déployable sur Coolify.
- Modèle de données noyau : `resources`, `pages`, `modules`.
- Six types de modules avec schéma de validation et composant de rendu.
- Reader public SSR : arborescence à gauche, contenu au centre, sommaire à droite.
- Script de seed insérant une ressource de démonstration.
- Tests de la logique pure (arbre, sommaire, validation des modules).

Hors lot (lots suivants) :

- Authentification, magic link, sessions.
- Bibliothèque personnelle, abonnement / désabonnement.
- Ressources privées attribuées à un utilisateur.
- Écriture de contenu via API REST ou MCP.
- Statistiques de vue / usage.
- Builder visuel d'édition.
- Upload de fichiers vers R2 : le lot 1 consomme des URLs R2 existantes, il n'uploade rien.

## Modèle de données

Trois tables, gérées par Drizzle et migrées via `drizzle-kit`.

### `resources`

L'unité lead-magnet, identifiée par un slug public.

| Colonne           | Type        | Notes                                              |
| ----------------- | ----------- | -------------------------------------------------- |
| `id`              | uuid (pk)   | `gen_random_uuid()`                                |
| `slug`            | text unique | segment d'URL → `/r/<slug>`                         |
| `title`           | text        |                                                    |
| `description`     | text null   | résumé court                                       |
| `cover_image_url` | text null   | URL R2                                             |
| `visibility`      | text        | `public` par défaut ; appliqué au lot 2            |
| `published`       | boolean     | `false` par défaut ; un reader ne sert que publié  |
| `created_at`      | timestamptz | défaut `now()`                                     |
| `updated_at`      | timestamptz | défaut `now()`                                     |

### `pages`

Les nœuds de l'arborescence d'une ressource. La page racine a `parent_id = null`.

| Colonne       | Type        | Notes                                                   |
| ------------- | ----------- | ------------------------------------------------------- |
| `id`          | uuid (pk)   |                                                         |
| `resource_id` | uuid (fk)   | → `resources.id`, `on delete cascade`                   |
| `parent_id`   | uuid null   | → `pages.id`, `on delete cascade` ; null = racine       |
| `slug`        | text        | unique par `(resource_id, parent_id)`                   |
| `title`       | text        |                                                         |
| `position`    | integer     | ordre entre frères                                      |
| `created_at`  | timestamptz | défaut `now()`                                          |
| `updated_at`  | timestamptz | défaut `now()`                                          |

Contrainte : une ressource a exactement une page racine. Le chemin d'URL d'une sous-page est
la concaténation des slugs depuis la racine (`/r/<slug>/<page>/<sous-page>`).

### `modules`

Le contenu ordonné d'une page.

| Colonne      | Type        | Notes                                                       |
| ------------ | ----------- | ----------------------------------------------------------- |
| `id`         | uuid (pk)   |                                                             |
| `page_id`    | uuid (fk)   | → `pages.id`, `on delete cascade`                           |
| `type`       | text        | un des six types ci-dessous                                 |
| `position`   | integer     | ordre dans la page                                          |
| `content`    | jsonb       | forme validée par le schéma Zod du type                     |
| `created_at` | timestamptz | défaut `now()`                                              |
| `updated_at` | timestamptz | défaut `now()`                                              |

## Types de modules

Chaque type est défini par un schéma Zod (la source de vérité de la forme de `content`,
réutilisé par l'API/MCP au lot 3) et un composant de rendu React. Un **registre**
`type → { schema, component }` centralise l'enregistrement ; ajouter un type se fait à un
seul endroit.

| Type       | `content`                                | Rendu                                              |
| ---------- | ---------------------------------------- | -------------------------------------------------- |
| `markdown` | `{ md: string }`                         | markdown GFM (titres, listes, tableaux, code, images inline R2, citations) |
| `callout`  | `{ variant: "info"\|"warn"\|"success", md: string }` | encadré contrasté avec markdown interne            |
| `image`    | `{ url: string, alt?: string, caption?: string }` | image pleine largeur (R2)                          |
| `video`    | `{ url: string, caption?: string }`      | lecteur (mp4 R2 via `<video>` ou URL externe)      |
| `file`     | `{ url, label, filename, size?: number }` | bloc de téléchargement (workflow N8N, PDF, zip)    |
| `embed`    | `{ url: string }`                        | iframe responsive (YouTube, Loom, Figma…)          |

Validation : un module dont le `content` ne valide pas son schéma est ignoré au rendu (le
reader ne casse pas) et signalé en log côté serveur.

## Reader public

### Routes

- `/r/[slug]` — page racine de la ressource.
- `/r/[slug]/[...path]` — sous-page résolue en suivant la chaîne de slugs.

Rendu en Server Components. Une ressource non publiée renvoie 404 sur le reader public.

### Mise en page (layout B)

Trois colonnes, style brutaliste N&B (Tailwind v4 + shadcn/Radix + Geist, bordures épaisses,
gros titres, contraste maximal) :

- **Gauche** : arbre des pages de la ressource, page courante mise en évidence.
- **Centre** : titre de la page puis modules rendus dans l'ordre `position`.
- **Droite** : sommaire de la page, construit à partir des titres `h2`/`h3` du contenu markdown.

Le markdown est rendu côté serveur avec support GFM (tableaux, code) et assaini.

### Construction de l'arbre et du sommaire

- L'arbre se construit en mémoire depuis la liste plate des `pages` d'une ressource (fonction
  pure testable).
- Le sommaire s'extrait des titres des modules `markdown` et `callout` de la page (fonction
  pure testable) ; chaque titre reçoit un id d'ancre.

## Seed

Un script de seed (`db/seed.ts`) insère une ressource de démonstration réaliste — un « Guide »
avec une page racine, deux à trois sous-pages, et au moins un module de chaque type — afin de
rendre le reader démontrable de bout en bout. Le script est idempotent (efface puis réinsère
la ressource de démo via son slug).

La migration fidèle d'un document Outline existant est une tâche ultérieure, réalisée de
préférence via le MCP au lot 3.

## Stack et arborescence du code

Stack reprise du starter maison (`avqn-starter-kit`) :

- Next.js 16 (App Router), React 19, TypeScript.
- Drizzle ORM + `postgres` (driver porsager), `drizzle-kit` pour les migrations.
- Tailwind v4 + shadcn/Radix + Geist + lucide.
- Rendu markdown : `react-markdown` + `remark-gfm` + assainissement (`rehype-sanitize`).
- Zod pour les schémas de modules.
- Vitest pour les tests.

Arborescence cible :

```
app/(public)/r/[slug]/page.tsx          reader page racine
app/(public)/r/[slug]/[...path]/page.tsx reader sous-page
components/reader/                       sidebar (arbre), toc (sommaire), layout
components/modules/                      un composant par type + registre
db/schema.ts                             tables Drizzle
db/index.ts                              client Postgres
db/seed.ts                               script de seed
lib/modules/                             schémas Zod + registre type → { schema, component }
lib/content/tree.ts                      construction de l'arbre de pages (pur)
lib/content/toc.ts                       extraction du sommaire (pur)
lib/content/resolve.ts                   résolution d'un chemin de slugs → page
drizzle.config.ts                        config migrations
Dockerfile                               image Next standalone
```

## Déploiement Coolify

- Sortie Next en mode `standalone`, packagée dans une image Docker (`Dockerfile`).
- Service Postgres dans Coolify ; l'app lit `DATABASE_URL` en variable d'environnement.
- Les migrations Drizzle sont appliquées au déploiement.
- `.env.example` documente `DATABASE_URL` (et les variables R2/Resend réservées aux lots suivants).

## Tests

Vitest sur la logique pure et la validation :

- Construction de l'arbre de pages depuis des lignes plates (ordre, imbrication, racine unique).
- Extraction du sommaire depuis du markdown (titres `h2`/`h3`, ancres).
- Résolution d'un chemin de slugs vers la bonne page (chemins valides et invalides).
- Validation Zod du `content` par type de module (cas valides et rejets).

## Critères d'acceptation

1. `npm test` passe.
2. Après migration + seed sur une base locale, `/r/<slug>` rend la ressource de démo avec son
   arborescence, ses six types de modules et son sommaire.
3. Une ressource non publiée renvoie 404 sur le reader.
4. Un module au `content` invalide est ignoré sans casser le rendu de la page.
5. `npm run build` produit une sortie standalone exploitable par le `Dockerfile`.
