# Preview clone seeding + restore prod + rôle DB — plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps en checkbox.

**Goal:** Remettre les posts en prod, faire seeder les previews par clone de prod (intégration = complet gardé, branches = scrubbé), et passer l'app prod sur un rôle DB least-privilege.

**Architecture:** Tout se joue dans `scripts/deploy.sh` (provisioning DB, exécuté sur le lab) + la route Caddy + un correctif `preview-login`. Le restore prod est une opération directe sur le lab. Fonctions bash pures testées en `test/*.sh`.

**Tech Stack:** bash, Postgres 16, Caddy, Next.js (preview-login TS), pg_dump/restore internes au lab.

---

## Task A : Restore des posts en prod (opération directe)

**Pré-requis** : base temp `_oldcast` déjà restaurée sur le lab depuis le backup.

- [ ] Provisionner l'opérateur prod dans `app_prod` : `INSERT user(role=operator, email, email_verified)` + `account(provider_id='credential', password=<hash temp>)`. Capturer le `userId` généré.
- [ ] Insérer en transaction depuis `_oldcast`, en remappant `user_id` → nouvel `userId`, dans l'ordre `social_accounts` → `voice` → `posts` (sans `status`) → `publications`.
- [ ] Vérifier : `SELECT count(*)` = posts 11, publications 9, voice 2, social_accounts 1.
- [ ] Drop `_oldcast`.
- [ ] (pas de commit — opération lab)

## Task B : Rôle prod least-privilege dans deploy.sh

**Files:** Modify `scripts/deploy.sh` (bloc DB), Modify `test/deploy-db.test.sh` (nouveau)

- [ ] Écrire le test : une fonction pure `app_role_sql <db>` retourne le SQL idempotent (CREATE ROLE app si absent, ALTER DATABASE OWNER, REASSIGN). Test `test/deploy-db.test.sh` source deploy.sh et vérifie la présence des clauses.
- [ ] Run `bash test/deploy-db.test.sh` → FAIL.
- [ ] Implémenter `app_role_sql` + l'appeler dans le bloc `db:true` ; `DATABASE_URL` passe sur `app:<pwd>@`. Le mot de passe `app` vient de `/opt/lab/platform/.env` (`LAB_APP_DB_PASSWORD`, posé une fois) avec fallback `LAB_POSTGRES_PASSWORD`.
- [ ] Run le test → PASS. `bash -n deploy.sh`.
- [ ] Commit.

## Task C1 : Décision clone-vs-seed (fonction pure)

**Files:** Modify `scripts/deploy.sh`, Modify `test/deploy-seed.test.sh` (nouveau)

- [ ] Test : `provision_mode <env>` → `none` (prod), `clone-full` (integration), `clone-scrub` (autres). 
- [ ] FAIL → implémenter → PASS.
- [ ] Commit.

## Task C2 : SQL de scrub (fonction pure)

**Files:** Modify `scripts/deploy.sh`, `test/deploy-seed.test.sh`

- [ ] Test : `scrub_sql` retourne du SQL contenant l'anonymisation email/name, `access_token` neutralisé + `expires_at` passé, et le hash mot de passe connu sur les comptes credential.
- [ ] FAIL → implémenter (constante `PREVIEW_PASSWORD_HASH` partagée avec seed-preview) → PASS.
- [ ] Commit.

## Task C3 : Mode clone dans deploy.sh

**Files:** Modify `scripts/deploy.sh`

- [ ] Remplacer le bloc seed par : selon `provision_mode`, soit fallback `seed` (si `app_prod` absente/vide), soit `dropdb+createdb app_<env>` → `pg_dump app_prod | psql app_<env>` → `migrate` → `scrub_sql` (si clone-scrub).
- [ ] Forcer `LINKEDIN_STUB=1` (+ `CONTENT_OS_LINKEDIN_STUB=1`) dans `.env` hors prod.
- [ ] `bash -n` + relancer tous les `test/*.sh`.
- [ ] Commit.

## Task C4 : Basic-auth Caddy sur l'intégration

**Files:** Modify `scripts/deploy.sh`, `test/deploy-hosts.test.sh`

- [ ] Test : `caddy_site <proj> <env> <hosts> <upstream>` inclut un bloc `basicauth` ssi `env=integration` et secret présent.
- [ ] FAIL → implémenter : si `env=integration` et `/opt/lab/secrets` fournit `INTEGRATION_BASICAUTH` (hash bcrypt), injecter `basicauth { <user> <hash> }` dans la route. Secret `sysadmin/INTEGRATION_BASICAUTH`.
- [ ] PASS. Commit.

## Task C5 : preview-login dynamique

**Files:** Modify `src/lib/auth/preview.ts` + `src/lib/auth/preview-users.ts`, Test associé

- [ ] Test : en mode clone-scrub, `/preview-login` résout l'opérateur cloné (1er user role=operator) au lieu des `preview-op-1/2` codés en dur ; en integration, pas d'auto-login.
- [ ] FAIL → implémenter la résolution dynamique (requête DB du 1er operator) avec fallback sur les ids seed. PASS.
- [ ] Commit.

## Task C6 : Garde longueur de nom de base

**Files:** Modify `scripts/deploy.sh` + `scripts/dev-db.sh`

- [ ] Test : `db_name app <slug>` ≤ 63 car. ; si dépassement, suffixe par hash court.
- [ ] FAIL → implémenter (fonction partagée) → PASS. Commit.

## Vérification finale

- [ ] Tous les `test/*.sh` verts, `bash -n` sur les scripts.
- [ ] Push branche → preview `app-feat-preview-clone-seeding.preview.contentos.ch` : vérifier que la preview a cloné+scrubbé la prod (posts présents, emails anonymisés, pas de token).
- [ ] PR + CI + récap.
