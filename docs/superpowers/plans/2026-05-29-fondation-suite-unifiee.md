# Fondation suite unifiée — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).

**Goal:** Mettre debout `projects/app`, l'app Next.js unique de la suite Contentos, déployée en preview de branche, prête à accueillir les verticales en modules.

**Architecture:** Une app Next.js (App Router) avec design system maison, AppShell + navbar suite, BetterAuth (rôles, auto-login preview), schéma Drizzle modulaire (`src/modules/<domaine>/schema.ts` agrégés), worker BullMQ, endpoint MCP in-app. Config/plomberie réutilisées de `cast` (Dockerfile web+worker, drizzle, vitest, biome) ; produit réécrit proprement.

**Tech Stack:** Next 16.2.6, React 19, TypeScript, Tailwind v4, drizzle-orm 0.45 + drizzle-kit, better-auth 1.6, bullmq 5 + ioredis, @modelcontextprotocol/sdk 1.26, vitest 4, biome, tsx. Node 22. `output: standalone`.

Source d'inspiration : `legacy` (branche) — `projects/cast` (seed le plus complet : web+worker+redis+db+auth+mcp), `projects/media`, `projects/ressources`, `projects/www` (landing), `projects/styleguide` (design system).

---

## File Structure (cible `projects/app/`)

```
projects/app/
  package.json            scripts dev/worker/build/test/db:*; deps ci-dessus
  next.config.ts          output: standalone; rewrites host docs.* → (docs)
  tsconfig.json  biome.json  vitest.config.ts  drizzle.config.ts
  Dockerfile              multi-stage, targets web + worker (repris de cast)
  compose.yml             services web + worker (repris/généralisé de cast)
  lab.json                { db, redis, browser, email, images:[web,worker], migrate, seed, apex:true }
  .env.test               postgres://app:app@localhost/app_test (convention atelier)
  playwright.config.ts    e2e (smoke)
  scripts/
    migrate.ts  seed.ts  db-test-prepare.ts
  src/
    app/
      (public)/page.tsx          landing
      (docs)/...                 espace public lecture
      (app)/layout.tsx           AppShell + navbar suite (auth requise)
      (app)/cast|media|ressources|skills|styleguide/...
      (auth)/sign-in/...
      api/auth/[...all]/route.ts
      api/mcp/route.ts           endpoint MCP fédéré
      healthz/route.ts
    db/
      client.ts                  drizzle(postgres-js|pg)
      schema.ts                  ré-exporte tous les modules/*/schema
    lib/
      auth.ts                    BetterAuth (rôles) + helpers session
      env.ts                     validation zod des env
      queue/                     BullMQ client + helpers (repris cast)
      mcp/                       registre d'outils + handler
    components/
      ui/                        primitives design system
      app-shell/                 AppShell, SuiteNav, MobileDrawer
    modules/
      <domaine>/{schema.ts, mcp.ts, ...}   rempli aux phases 2-5
    worker/
      index.ts                   runner BullMQ (repris cast)
```

## Phase 0 — Reset

- [ ] **Retirer les anciens projets applicatifs.** `git rm -r projects/{auth,cast,counter,docs,hello,mcp,media,ressources,skills,styleguide,www} packages starters` (le code reste sur `legacy`). Garder `bin/`, `scripts/`, `secrets/`, `docs/`, `test/`, `tools/`, `.github/`, `CLAUDE.md`.
- [ ] **Scaffolder `projects/app`** avec le squelette ci-dessus (configs depuis cast, généralisées). `name: "contentos"`.
- [ ] **Commit** : `🧹 reset : legacy archivée, squelette projects/app`.

## Phase 1 — Fondation

Tranches TDD (chacune : test rouge → impl → vert → commit). Détail des comportements :

- [ ] **env + db client** — `lib/env.ts` valide `DATABASE_URL, APP_URL, BETTER_AUTH_SECRET, REDIS_URL?`. `db/client.ts` expose `db`. Test : env manquant → throw ; db importable.
- [ ] **schéma + migrate** — `db/schema.ts` agrège (vide au départ + tables auth). `drizzle.config.ts` + `scripts/migrate.ts` idempotent. Test d'intégration : migrate sur `app_test` crée les tables auth.
- [ ] **auth** — `lib/auth.ts` BetterAuth (email/password + champ `role`), `api/auth/[...all]`. `baseURL = APP_URL`. Helper `requireUser()` (redirige vers sign-in). En env non-prod, seed d'un opérateur + **auto-login preview** (cookie de session posé pour l'opérateur de test). Tests : session anonyme refusée sur `(app)`, opérateur accepté.
- [ ] **design system** — tokens (couleurs, typo, rayons) en CSS vars + Tailwind v4 ; primitives `ui/` (Button, Input, Card, …) via le skill frontend-design. Route `/styleguide` les liste.
- [ ] **AppShell + navbar suite** — `components/app-shell/` : barre supérieure avec entrées cast/media/ressources/skills (état actif par segment), drawer mobile, slot user/déconnexion. `(app)/layout.tsx` l'utilise et exige l'auth.
- [ ] **pages placeholder par domaine** — `/cast /media /ressources /skills` rendent un écran « bientôt » sous l'AppShell (remplis aux phases suivantes). `(public)/page.tsx` = landing simple. `healthz` → 200 JSON.
- [ ] **MCP endpoint** — `api/mcp/route.ts` + `lib/mcp/registry.ts` : registre vide au départ, handshake MCP ok, authentifié. Test : liste d'outils vide servie.
- [ ] **worker** — `worker/index.ts` runner BullMQ qui se connecte à Redis et log « prêt ». Pas de job encore.
- [ ] **seed** — `scripts/seed.ts` : opérateur(s) de test + données minimales. Idempotent.
- [ ] **dev-db** — vérifier `scripts/dev-db.sh up app` : crée `app_dev`/`app_test`, migrate+seed, écrit `.env`. `npm run dev` et `npm test` passent.

## Phase 1 — Infra (plomberie atelier)

- [ ] **deploy.sh** : apex → `app` (au lieu de `www`) ; retirer l'injection `AUTH_URL` (auth in-app).
- [ ] **deploy.yml** : retirer `shared_guard` et `www_tools_guard` (caducs) ; le reste inchangé (un seul projet `app` détecté).
- [ ] **CLAUDE.md** : réécrire pour l'état cible (une app `projects/app`, docs = route publique, plus de multi-projets/SSO/passerelle). Mettre à jour les skills atelier impactées.
- [ ] **secrets** : scope projet `app` (renommer/poser les clés requises : GEMINI, LINKEDIN, ANTHROPIC… aux phases concernées).

## Critère d'acceptation Phase 1

`git push` → CI verte → `https://app-refonte-suite-unifiee.preview.contentos.ch` répond : landing publique, `/sign-in`, auto-login opérateur → AppShell avec navbar suite, `/healthz` 200, `/styleguide` rendu. `npm test` vert en CI.

## Self-review

Couverture spec : app unique ✓, docs route publique (squelette, rempli ph.4) ✓, auth in-app rôles ✓, schéma modulaire userId ✓, AppShell+navbar ✓, MCP in-app ✓, worker ✓, pipeline preuve preview ✓, intégration/promote → Phase 6. Pas de placeholder de code (greenfield : tranches décrites au comportement, impl via sous-agents + frontend-design). Types cohérents (requireUser, db, registry).
