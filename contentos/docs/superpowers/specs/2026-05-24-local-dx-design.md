# DX locale : base de test isolée + seed dev — Design

**Objectif** : arrêter d'effacer la donnée de dev à chaque `npm test`, et pouvoir repeupler un compte de dev en une commande.

## Problème (cause racine)

`vitest.config.ts` charge `.env` (donc `DATABASE_URL=…/contentos`, la base de dev) et `test/setup-integration.ts` vide **toutes** les tables (`user`, `session`, `socialAccounts`, `posts`, `ideas`, `visualTemplates`…) en `beforeEach`. Conséquence : chaque `npm test` / `test:integration` / `test:worker` détruit la donnée locale → il faut se reconnecter (re-signin + reconnexion LinkedIn) et tout regénérer.

Le volume Docker `postgres_data` persiste correctement : ce ne sont pas les restarts, ce sont les tests qui partagent la base de dev.

## Périmètre

Deux chantiers, un seul PR.

1. **Base de test isolée** — les tests locaux tapent sur `contentos_test`, jamais sur `contentos`.
2. **Seed dev (`npm run db:seed`)** — peuple un compte avec un jeu d'exemple complet, idempotent.

Hors périmètre : connexion LinkedIn seedée (le token réel persiste ~60 j une fois l'isolation en place), session de dev longue (devient inutile une fois la base de test isolée). À reconsidérer plus tard si besoin.

## 1. Base de test isolée

### État cible

- Les runs de test (vitest **et** Playwright) utilisent `DATABASE_URL=postgres://app:app@localhost:5432/contentos_test`.
- Le dev (`npm run dev`, `npm run worker`) continue d'utiliser `contentos` via `.env`.
- CI inchangé : il injecte déjà `DATABASE_URL=…/contentos_test` dans `process.env` (sauf le job `unit` qui ne touche pas la DB).

### Mécanisme

Fichier `.env.test` **committé** (localhost, mot de passe `app`, aucun secret) contenant uniquement :

```
DATABASE_URL=postgres://app:app@localhost:5432/contentos_test
```

`vitest.config.ts` et `playwright.config.ts` chargent `.env` puis `.env.test` en `override` :

```ts
loadEnv();
loadEnv({ path: '.env.test', override: true });
```

- En **local** : `.env.test` existe → `DATABASE_URL` passe à `contentos_test` pendant les tests uniquement (ces configs ne sont chargées que par les runners de test, pas par `next dev`/`worker`).
- En **CI** : `process.env.DATABASE_URL` est déjà posé par le job. dotenv `override:true` le réécrit avec la valeur de `.env.test` — **identique** (`contentos_test`, même hôte, mêmes creds) pour integration/worker/e2e. Le job `unit` voit `contentos`→`contentos_test`, sans effet (les tests unit ne se connectent pas à la DB).

`.env.test` ne contient **que** `DATABASE_URL` : `REDIS_URL` et `BETTER_AUTH_SECRET` fournis par CI ne sont jamais écrasés. Redis reste partagé avec le dev (jobs BullMQ éphémères, hors périmètre).

Pour Playwright, `webServer.env` doit aussi recevoir `DATABASE_URL` (le serveur `npm run start` et le worker spawné dans `global-setup` héritent de `process.env` du runner, donc charger `.env.test` en tête de `playwright.config.ts` suffit ; on propage explicitement `DATABASE_URL` dans `webServer.env` pour être sûr).

### Préparation de la base de test (une fois en local)

Nouveau script `npm run db:test:prepare` :
1. Crée `contentos_test` si absente (via le container Postgres, idempotent).
2. Applique les migrations sur `contentos_test`.

Pas de hook `pretest` (CI crée déjà sa base via les services + `db:migrate` ; un hook docker casserait CI). La commande est documentée dans `.env.example`.

Helper pur testable : une fonction `adminUrl(testUrl)` qui dérive l'URL de connexion d'admin (base `postgres`) à partir de l'URL cible, en remplaçant le nom de base. Le script s'appuie dessus puis `CREATE DATABASE` (en ignorant « already exists ») et lance les migrations Drizzle.

## 2. Seed dev (`npm run db:seed`)

### État cible

```
npm run db:seed -- manu.avqn@gmail.com
```

- Charge `.env` automatiquement (`tsx --env-file-if-exists=.env`), donc plus besoin de passer `--env-file` à la main.
- Argument = email (résolu en `userId`) ou `userId` direct. Le user doit s'être connecté une fois (signin magic link) ; sinon message clair et sortie.
- **Idempotent** : chaque entrée est vérifiée avant insertion (skip si déjà présente), comme le seed visual actuel.

### Contenu seedé

1. **Défauts user** : `seedUserDefaults(userId)` (settings, voice, visual-briefing, template d'écriture « Post LinkedIn standard »). Rendu idempotent (le template d'écriture est vérifié par slug avant création).
2. **Templates visuels** : les `VISUAL_TEMPLATE_SEEDS` existants (idempotent par slug). La boucle de seed visuel est extraite dans une fonction réutilisable partagée avec `scripts/seed-visual-templates.ts` (DRY).
3. **Ideas d'exemple** : 2-3 ideas (`{ idea, brief }`), idempotent par texte d'idée.
4. **Posts d'exemple** : 2-3 posts en `draft` rattachés aux ideas seedées (un post requiert `ideaId`), idempotent par contenu/idea.

### Découpage fichiers

- `scripts/seed-dev.ts` — orchestrateur : résout l'email, appelle les briques de seed, log un récap `created/skipped`.
- `src/lib/db/seeds/dev-sample.ts` — données d'exemple (ideas, posts) + fonctions de seed idempotentes réutilisables.
- Fonction `seedVisualTemplates(userId)` extraite (depuis `scripts/seed-visual-templates.ts`) vers `src/lib/db/seeds/` et réutilisée par les deux scripts.

## Tests

- **Unit** : `adminUrl()` dérive correctement l'URL d'admin (swap du nom de base, conserve creds/host/port).
- **Integration** : `seedDev(userId)` est idempotent — deux appels successifs ne créent pas de doublons (compte stable de ideas/posts/templates) ; vérifie que settings/voice/template/ideas/posts existent après le premier appel.
- **Manuel** : `npm run db:test:prepare` puis `npm test` ne touche pas `contentos` (la donnée de dev survit) ; `npm run db:seed -- <email>` peuple le compte.

## Risques

- **Override dotenv en CI** : maîtrisé car `.env.test` ne porte que `DATABASE_URL` à une valeur identique à celle de CI pour les jobs DB. À valider : CI vert après le changement.
- **Première exécution locale** : si `contentos_test` n'existe pas, `npm test` échoue à la connexion. Mitigation : `db:test:prepare` documenté, message d'erreur clair attendu de Postgres.
