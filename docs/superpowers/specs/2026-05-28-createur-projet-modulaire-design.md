# Créateur de projets modulaire — `/lab-new` v2

## Intention

Démarrer un projet de l'atelier en cochant des **capacités** (base de données, Redis, auth,
serveur MCP) plutôt qu'en partant d'un starter figé. Le wizard pose les options pas à pas,
laisse l'IA écrire le thème, **compose** le projet à partir d'une base et de modules additifs,
puis le pousse jusqu'en **prod** et renvoie le lien. Le cœur de la promesse : tout projet généré
est connectable à l'IA via un **MCP** (le pattern déjà éprouvé dans `media` et `contentos`).

## Vue d'ensemble — le flux

`/lab-new` est une skill conversationnelle : l'agent **est** le wizard.

1. **Nom** (kebab-case) + une phrase de description.
2. **Capacités** à cocher : `db` · `redis` · `auth` · `mcp`. La cascade de dépendances est
   appliquée et affichée automatiquement.
3. Si `auth` → **méthodes** : code OTP par email · email + mot de passe · magic-link (multi).
4. Si `mcp` → **nom du serveur** + description en langage naturel de ce qu'il doit faire →
   l'IA scaffolde 1-2 outils métier (+ un `ping`).
5. **Thème (IA)** → l'utilisateur décrit l'ambiance → l'IA écrit les **tokens Tailwind**
   (couleurs, polices) dans le bloc `@theme`. La landing reste un gabarit générique qui consomme
   ces tokens.
6. **Récap → go** : compose → contrôle de cohérence statique → branche → push (preview) →
   PR → attente CI verte → **merge auto (squash) → prod** → renvoi du **lien prod**.

Une fast-path court-circuite la composition pour deux besoins simples : **`static`** (site HTML
pur) et **`api`** (petit service JSON). Le wizard les propose comme raccourcis.

## La base — `starters/base/`

Next.js 16 (App Router, TypeScript) + Tailwind 4 (config CSS-first dans `globals.css`), sortie
`standalone`. Contient tout le squelette déployable indépendant des capacités :

```
base/
├── Dockerfile · .dockerignore · compose.yml · .gitignore
├── package.json            (next, react, react-dom, tailwind, typescript, types)
├── next.config.ts          output: "standalone"
├── postcss.config.mjs · tsconfig.json
├── .env.example            APP_URL (auto-injecté au déploiement)
├── lab.json                { "description": "…" }   (aucune capacité par défaut)
├── public/robots.txt
├── CLAUDE.md               gabarit (nom + but, rempli à la composition)
└── src/app/
    ├── layout.tsx · page.tsx (landing générique) · globals.css (bloc @theme rempli par l'IA)
    └── healthz/route.ts      GET /healthz → 200 "ok" (ne touche aucune ressource)
```

Sans aucun module = le résultat **« frontend only »** : une app Next.js stylée, déployable.

## Catalogue de modules — `starters/modules/<nom>/`

Chaque module est un dossier **additif** : un manifeste `module.json` + les fichiers à déposer.

### `module.json` (manifeste)

```json
{
  "name": "db",
  "requires": [],
  "labJson": { "db": true, "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs" },
  "deps":    { "drizzle-orm": "^0.45.2", "postgres": "^3.4.9" },
  "devDeps": { "drizzle-kit": "^0.31.10" },
  "scripts": { "db:generate": "drizzle-kit generate", "migrate": "node scripts/migrate.mjs", "seed": "node scripts/seed.mjs" },
  "env":     [],
  "files":   ["src/db/index.ts", "src/db/schema.ts", "drizzle.config.ts", "scripts/migrate.mjs", "scripts/seed.mjs", "drizzle/0000_init.sql"],
  "schemas": []
}
```

- `requires` : modules pré-requis (le compositeur échoue si absents).
- `labJson` : clés fusionnées dans le `lab.json` du projet.
- `deps`/`devDeps`/`scripts` : fusionnés dans `package.json`.
- `env` : variables à ajouter à `.env.example` (les auto-injectées — `DATABASE_URL`, `REDIS_URL`,
  `RESEND_API_KEY`, `APP_URL` — ne sont **pas** listées : la plateforme les fournit).
- `files` : fichiers copiés tels quels dans le projet.
- `schemas` : fragments de schéma Drizzle (`src/db/schemas/<x>.ts`) ré-exportés par le barrel.

### Modules v1

- **`db`** — Drizzle + driver `postgres`. `lab.json: db:true` + `migrate`/`seed`. Client paresseux
  `src/db/index.ts` (lit `DATABASE_URL` au runtime), barrel `src/db/schema.ts`, dossier
  `drizzle/` + `drizzle.config.ts`. **Requiert** : rien.
- **`email`** — envoi via Resend (`src/lib/email.ts`). `lab.json: email:true`. **Requiert** : rien.
  Activé automatiquement par `auth` si OTP ou magic-link est choisi.
- **`redis`** — client Redis (`src/lib/redis.ts`) lisant `REDIS_URL`/`REDIS_PREFIX`.
  `lab.json: redis:true`. **Requiert** : rien. Indépendant.
- **`auth`** — BetterAuth (adaptateur Drizzle). Schéma auth (`src/db/schemas/auth.ts`), client
  navigateur (`src/lib/auth-client.ts`), routes `app/api/auth/[...all]/route.ts`, page
  `app/sign-in/page.tsx`. L'instance serveur `src/lib/auth.ts` est **rendue** par le compositeur
  (voir plus bas) selon les méthodes choisies. **Requiert** : `db` ; ajoute `email` si OTP ou
  magic-link.
- **`mcp`** — serveur MCP sur le pattern `media`/`contentos` : `mcp-handler` +
  `@modelcontextprotocol/sdk`, route `app/api/mcp/route.ts`, vérif du Bearer OAuth
  (`src/lib/mcp/auth.ts` via `auth.api.getMcpSession`), registre `src/lib/mcp/server.ts`
  (`registerAllTools`), helper `src/lib/mcp/result.ts`, métadonnées OAuth
  `.well-known/oauth-authorization-server` + `.well-known/oauth-protected-resource`, plus le
  plugin BetterAuth `mcp` ajouté à l'instance auth. Un outil `ping` d'exemple est livré ; les
  outils métier sont scaffoldés par l'IA. **Requiert** : `auth` + `db`.

### Graphe de dépendances (cascade appliquée par le wizard)

```
mcp ──requiert──▶ auth ──requiert──▶ db
auth (OTP|magic-link) ──ajoute──▶ email
redis  (indépendant)
```

Cocher `mcp` active donc `auth` (le wizard demande les méthodes) et `db`. Choisir OTP ou
magic-link ajoute `email`.

## Le compositeur — `scripts/compose-project.mjs`

Fonction **déterministe** : `compose({ name, description, modules, authMethods, mcp })` →
écrit le dossier `<name>/`.

1. Copie `starters/base/` → `<name>/`.
2. Résout la cascade (`requires` + ajouts auto) ; échoue si un pré-requis manque.
3. Pour chaque module sélectionné : fusionne `labJson`, `deps`/`devDeps`/`scripts` dans
   `package.json`, ajoute les `env` à `.env.example`, copie les `files`.
4. **Barrel Drizzle** : `src/db/schema.ts` ré-exporte chaque fragment des `schemas` collectés.
5. **Rend `src/lib/auth.ts`** depuis un gabarit borné : compose le tableau `plugins` selon les
   méthodes (`emailOTP(...)`, `magicLink(...)`) et ajoute `mcp({...})` si le module MCP est
   présent. C'est la seule partie « templatée » — bornée et déterministe parce que sensible
   (câblage d'auth).
6. Remplit `lab.json.description` et le `CLAUDE.md` du projet (nom + but + capacités).

Le **créatif** reste hors compositeur : les tokens de thème (étape 5) et le corps des outils MCP
(étape 4) sont écrits par l'agent.

## L'étape thème (IA — tokens seulement)

L'utilisateur décrit une ambiance ; l'agent écrit le bloc `@theme` de `globals.css` (palette via
`--color-*`, polices via `next/font` ou `<link>`). La landing générique consomme ces tokens. Pas
de génération d'image ni de copie marketing en v1.

## L'étape MCP (IA)

L'utilisateur nomme le serveur et décrit ses capacités en langage naturel. L'agent crée
`src/lib/mcp/tools/<outil>.ts` (schémas d'entrée zod + handler), les enregistre dans
`registerAllTools`, et rédige la chaîne `INSTRUCTIONS`. Un outil `ping` est toujours présent.

## Déploiement auto jusqu'à la prod

La skill tourne dans une session worktree isolée ; elle **n'effectue aucun `git switch`** (la
session est déjà sur sa branche). Séquence :

1. `git add <name>/` + commit (message `🤖 nouveau projet <name>`).
2. `git push` → la CI build l'image et déploie la **preview**
   `https://<name>-<branche>.lab.avqn.ch`.
3. `gh pr create --fill`.
4. `gh run watch` → attendre la CI **verte** sur la preview ; afficher le lien preview.
5. `gh pr merge <#> --squash` (la branche distante s'auto-supprime ; `--delete-branch` est inutile
   et échoue en contexte worktree).
6. Attendre la CI prod → renvoyer le **lien prod** `https://<name>.lab.avqn.ch`.

Le merge auto met en prod sans relecture humaine de la PR : assumé pour un starter fraîchement
généré. La PR + la CI restent l'entonnoir (deux runs : preview puis prod) — incompressible.

## Contrôle de cohérence (le filet de sécurité)

La justesse de la composition est garantie par des **tests** sur `compose-project.mjs` (TDD),
pas par un build local lourd. Le build complet reste le **gate CI** (principe remote-first de
l'atelier). Le compositeur fait un contrôle **statique** avant tout push : `package.json`/
`lab.json` JSON valides, modules `requires` satisfaits, fichiers référencés présents, barrel de
schéma cohérent.

Tests de composition (Node test runner) couvrant au moins :
- `frontend only` (aucun module) : base copiée, `lab.json` sans capacité.
- `db + redis` : flags `lab.json`, deps fusionnées, pas d'auth.
- `full` (`db + redis + auth[OTP+password+magic-link] + mcp`) : `auth.ts` contient les 3 plugins
  + `mcp()`, route `api/mcp` présente, `.well-known/*` présents, `email:true` auto.

## Livrables (ordre de construction)

1. `starters/base/` (Next.js + Tailwind, frontend-only déployable).
2. `scripts/compose-project.mjs` + schéma `module.json` + **tests de composition** (TDD d'abord).
3. Modules dans l'ordre des dépendances : `db`, `email`, `redis`, `auth`, `mcp`.
4. Réécriture de `.claude/skills/lab-new/SKILL.md` (wizard + thème IA + MCP IA + déploiement auto
   jusqu'à la prod).
5. Conserver `starters/static` et `starters/api` en raccourcis ; **retirer `starters/flagship`**
   (reproduit par base + `db` + `auth` OTP).
6. Ajuster les références dans le `CLAUDE.md` racine (la liste des skills mentionne déjà
   `/lab-new` ; préciser la composition par capacités).

## Hors périmètre (YAGNI)

- **GUI web déployée** : couche éventuelle ultérieure ; la v1 est la skill.
- **Auth social** (GitHub/Google) : non retenu.
- **Image hero / copie de landing par IA** : le thème se limite aux tokens.
- **Module `browser`** (Chromium partagé) : la plateforme le supporte (`lab.json: browser:true`) ;
  ajout trivial plus tard si besoin, hors v1.
