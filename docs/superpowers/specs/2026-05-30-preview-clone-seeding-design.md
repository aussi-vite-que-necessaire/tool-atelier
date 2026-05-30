# Seeding des previews par clone de prod + restore prod + rôle DB — design

**Date.** 2026-05-30
**Statut.** Approuvé (brainstorm)

Trois chantiers liés autour des bases Postgres de la suite (`app_<env>`).

## A — Restaurer les posts en prod (one-shot)

`app_prod` est vide (0 user). On y remet les données réelles depuis le backup vérifié
`~/contentos-backups/2026-05-30/cast_prod.dump` (ancien schéma `cast_prod`).

**Opérateur prod.** On provisionne un compte : `user` (role `operator`, email de Manu) +
`account` credential (mot de passe temporaire, à changer ensuite). Nouveau `userId` = cible
de tout le data restauré.

**Mapping (ancien `cast_prod` → nouveau `app_prod`), tout rattaché au nouvel `userId` :**

| Table | Lignes | Règle |
| --- | --- | --- |
| `voice` | 2 | colonnes identiques → copie 1:1 |
| `posts` | 11 | 1:1 **sauf** `status` (colonne supprimée du nouveau schéma) |
| `social_accounts` | 1 | colonnes identiques → 1:1 (token LinkedIn réel inclus) |
| `publications` | 9 | colonnes identiques ; `status` ∈ enum cible (`scheduled`×7, `published`×2) |
| `settings` | 1 | identité de marque **vide** → ignorée |
| `writing_templates` | 2 | pas d'équivalent (≠ `publication_formats`) → ignorées, à recréer en UI |

**Sécurité.** La planification se fait par **job BullMQ retardé** (enfilé à la planif), pas par
un scan DB. Restaurer des lignes `publications` ne crée aucun job → **aucune auto-publication**.
Ordre d'insertion (FK) : `user` → `social_accounts` → `posts` → `publications` ; `voice` libre.

**Exécution.** Restore backup → base temp `_oldcast` → `INSERT … SELECT` mappé vers `app_prod`
en transaction → vérif des comptes → drop `_oldcast`. Idempotent (truncate+redo possible, prod
vide). Opération directe sur le lab (pas dans le déployable).

## B — Rôle prod least-privilege

Aujourd'hui l'app prod se connecte en **superuser `postgres`** (`deploy.sh`), alors que dev/CI
utilisent un rôle `app`. On aligne : `deploy.sh` garantit (idempotent) un rôle `app`
(LOGIN, mot de passe = secret), le rend **owner** de `app_<env>` (`ALTER DATABASE … OWNER`,
reassign des objets existants), et écrit `DATABASE_URL=postgres://app:…@postgres:5432/app_<env>`.
S'applique à tous les paliers (preview/intégration/prod). Le superuser `postgres` reste réservé
aux opérations admin (createdb, createrole, clone).

## C — Seeding des previews par clone de prod

`deploy.sh` gagne un mode **clone** qui remplace le seed synthétique hors-prod. Même serveur
Postgres → clone interne instantané (`pg_dump app_prod | psql app_<env>`), aucun transfert.

**Décision par palier :**

- **prod** : ni clone ni seed (inchangé).
- **intégration** (`app.preview.contentos.ch`) : **clone complet** de `app_prod` à chaque merge,
  données réelles. Rafraîchi depuis la prod à chaque déploiement (l'intégration n'est plus
  « persistante » : c'est un miroir de prod). Gardes : voir ci-dessous.
- **preview par-branche** : **clone scrubbé** de `app_prod` (anonymisé).

**Mécanique commune (dans `deploy.sh`, à la place du `seed`) :**
1. Si `app_prod` absente ou vide → fallback `seed-preview.mjs` (bootstrap, ex. avant le restore A).
2. Sinon : `dropdb app_<env>` puis recrée, `pg_dump app_prod | psql app_<env>` (schéma + data +
   journal drizzle), puis `migrate` (applique les migrations plus récentes que la prod), puis
   **scrub** si branche.
3. Le clone se fait avant le `compose up` (mêmes étapes que le provisioning actuel).

**Scrub (branches uniquement), SQL idempotent :**
- `user.email` → `op+<id>@contentos.test`, `user.name` → anonyme ;
- `social_accounts.access_token` → chaîne neutre, `expires_at` → passé (token inutilisable) ;
- `account.password` → hash connu (mot de passe `password`) sur l'opérateur, pour `/preview-login`.

**Gardes (intégration, clone complet) :**
- **Basic-auth Caddy** sur `app.preview.contentos.ch` : `deploy.sh` écrit la route avec
  `basicauth` (identifiant partagé, hash bcrypt en secret `sysadmin/INTEGRATION_BASICAUTH`).
  Ferme l'exposition publique du clone réel.
- **`LINKEDIN_STUB=1` forcé** en intégration ET sur les branches : les tokens existent mais
  aucune publication réelle ne part. Injecté par `deploy.sh` (hors prod).

**`/preview-login` :**
- branche : le scrub pose un mot de passe connu sur l'opérateur cloné ; l'auto-login pointe sur
  son `userId` (résolu dynamiquement, plus de `preview-op-1/2` en dur).
- intégration : derrière basic-auth, connexion via `/signin` avec les creds prod (pas d'auto-login).

## Nomenclature DB — verdict d'audit

Convention `app_<env>` saine et cohérente (dev/test/preview/intégration/prod). Deux correctifs
inclus ici : le rôle prod (B) ; et un **garde de longueur** sur le slug de branche (si
`app_<slug>` dépasse 63 car., suffixer par un hash court) dans `deploy.sh` + `dev-db.sh`.

## Tests

- `deploy.sh` : fonctions pures testées en `test/*.sh` (décision clone-vs-seed par env, génération
  du SQL de scrub, route Caddy avec/sans basicauth, longueur de nom de base).
- Restore A : vérifié par comptes (11 posts, 9 publications, 2 voix, 1 compte social) après insert.
