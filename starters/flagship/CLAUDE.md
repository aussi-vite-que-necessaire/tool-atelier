# flagship starter

Starter phare de l'atelier : **Next.js (App Router, TypeScript) + Drizzle ORM (Postgres) +
BetterAuth + Tailwind CSS**. La stack de base de Manu, prête à déployer. C'est un point de
départ **déviable** : tout est modifiable ensuite.

## Stack & arborescence

- **Next.js 16** en sortie `standalone` (`next.config.ts`) → image Docker slim.
- **Tailwind 4** (config CSS-first dans `src/app/globals.css`, plugin `@tailwindcss/postcss`).
- **Drizzle ORM** (driver `postgres`) : schéma dans `src/db/schema.ts`, client paresseux dans
  `src/db/index.ts` (lit `DATABASE_URL` au runtime, jamais au build).
- **BetterAuth** : instance serveur `src/lib/auth.ts` (adaptateur Drizzle), client navigateur
  `src/lib/auth-client.ts`, routes montées sous `app/api/auth/[...all]/route.ts`. Email +
  mot de passe activés.

```
flagship/
├── Dockerfile              multi-stage : deps → build → runner (standalone, non-root, :8080)
├── compose.yml             service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json                description + db:true + migrate/seed
├── next.config.ts          output: "standalone"
├── drizzle.config.ts       lit DATABASE_URL (dev : drizzle-kit generate)
├── drizzle/                migrations SQL committées (appliquées au déploiement)
├── scripts/
│   ├── migrate.mjs         applique drizzle/ à la base (drizzle-orm migrator)
│   └── seed.mjs            seed preview (vide par défaut)
└── src/
    ├── db/{schema.ts,index.ts}
    ├── lib/{auth.ts,auth-client.ts}
    └── app/
        ├── layout.tsx · page.tsx (landing) · globals.css
        ├── healthz/route.ts          GET /healthz → 200 "ok" (ne touche pas la base)
        ├── sign-in/page.tsx          connexion / inscription
        └── api/auth/[...all]/route.ts handler BetterAuth
```

## Build (CI uniquement)

Le serveur ne build jamais : la GitHub Action build l'image (`docker build .`) → GHCR → pull
sur `lab`. Le `Dockerfile` compile l'app entièrement au build. `next build` n'a besoin **ni**
de `DATABASE_URL` **ni** de `BETTER_AUTH_SECRET` (lecture paresseuse au runtime).

## Données

`lab.json` déclare `"db": true` → la plateforme crée la base `<projet>_<env>` (Postgres
central) et injecte **`DATABASE_URL`** automatiquement. La commande **`migrate`** (`node
scripts/migrate.mjs`) tourne dans un conteneur one-shot avec `DATABASE_URL`, **avant** le
démarrage de l'app : elle applique les migrations SQL committées du dossier `drizzle/` (via le
migrator `drizzle-orm/postgres-js` — pas besoin de `drizzle-kit` dans l'image de prod).

Faire évoluer le schéma : éditer `src/db/schema.ts`, lancer `npm run db:generate` (crée un
nouveau fichier dans `drizzle/`), committer. Le prochain déploiement applique la migration.

## Secret requis : `BETTER_AUTH_SECRET`

BetterAuth signe les sessions/cookies avec **`BETTER_AUTH_SECRET`** (≥ 32 caractères) et a
besoin de **`BETTER_AUTH_URL`** (URL publique de l'app). Ces deux variables **ne sont pas**
auto-injectées comme `DATABASE_URL` : sans elles, l'auth ne démarre pas correctement.

Le backend de secrets par projet de l'atelier est **en cours de choix** : tant qu'il n'est pas
en place, poser `BETTER_AUTH_SECRET` (et `BETTER_AUTH_URL`) à la main dans l'`.env` du projet
sur le serveur (`/opt/lab/apps/<projet>-<env>/.env`). À terme la plateforme pourra le
générer/persister automatiquement par projet (un secret stable par environnement). Générer une
valeur : `openssl rand -base64 32`.

## Déployer

`git push` sur une branche → preview `https://<projet>-<branche>.lab.avqn.ch`. Merge de la PR
→ prod `https://<projet>.lab.avqn.ch`. Jamais de commit sur `main`.
