---
name: lab-new
description: Créer un nouveau projet dans l'atelier en composant une base Next.js + des capacités (base de données, Redis, auth, serveur MCP), avec thème écrit par l'IA, puis déploiement automatique jusqu'en prod. À utiliser quand Manu veut démarrer un projet, une app, un service, un site, un MCP.
---

# /lab-new — créer un projet par composition

Wizard guidé : tu poses les options, tu composes le projet depuis `starters/base` + les modules
de `starters/modules/`, tu écris le thème à l'IA, et tu déploies jusqu'en prod. La composition
est déterministe (`scripts/compose-project.mjs`) ; toi tu n'écris que le créatif (thème, outils
MCP).

Tu tournes dans une session worktree isolée, déjà sur sa branche : **aucun `git switch`**, tu
commites le projet sur la branche courante.

## 1. Cadre le projet

- **Nom** en kebab-case (`^[a-z][a-z0-9-]*$`, ex. `mon-app`) — demande en prose.
- **Description** — une phrase. Sert au `lab.json`, à la landing et au `CLAUDE.md`.
- Vérifie que `<nom>/` n'existe pas à la racine de l'atelier.

## 2. Choisis les capacités

`AskUserQuestion` (multi-sélection) parmi :

- **db** — base Postgres (Drizzle ORM).
- **redis** — cache/file Redis.
- **auth** — comptes utilisateurs (BetterAuth).
- **mcp** — serveur MCP connectable à l'IA (le connecteur OAuth de l'atelier).

Applique et **annonce la cascade** : `mcp` ⇒ `auth` + `db` ; `auth` ⇒ `db` ; une auth par
**OTP** ou **magic-link** ⇒ `email` (Resend). `redis` est indépendant. Le compositeur refait
cette résolution, mais explique-la à Manu pour qu'il comprenne ce qui est activé.

**Raccourcis** (hors composition) : pour un besoin simple, propose plutôt une copie directe de
`starters/static` (site HTML pur) ou `starters/api` (petit service JSON). Tu sautes alors les
étapes 3-5.

## 3. Si `auth` : méthodes

`AskUserQuestion` (multi) parmi : **OTP par email** · **email + mot de passe** · **magic-link**.
Au moins une. Le compositeur génère `src/lib/auth.ts` + `src/lib/auth-client.ts` selon ces choix
(et ajoute le plugin `mcp` si la capacité MCP est cochée). L'auto-login preview (code `000000`)
est inclus dès qu'OTP est choisi.

## 4. Si `mcp` : décris le serveur

Demande le **nom du serveur** et, en langage naturel, **ce qu'il doit permettre de faire**.
Le scaffold MCP (route, connecteur OAuth, outil `ping`) est posé par la composition ; **toi**,
après composition, tu écris dans `<nom>/src/lib/mcp/` :

- la constante `INSTRUCTIONS` de `server.ts` (décrit le serveur pour l'agent IA),
- un fichier `tools/<outil>.ts` par capacité décrite (schéma d'entrée `zod` + handler), enregistré
  dans `registerAllTools`.

Garde le pattern de l'outil `ping` (helper `jsonResult`).

## 5. Thème (IA)

Demande l'ambiance souhaitée (couleurs, ton, inspiration). Réécris **uniquement** le bloc
`@theme` de `<nom>/src/app/globals.css` : palette (`--color-brand-*`) et `--font-sans`. La landing
générique consomme ces tokens — pas besoin de la refaire.

## 6. Compose

```bash
node scripts/compose-project.mjs '{"name":"<nom>","description":"<phrase>","modules":[...],"authMethods":[...],"mcp":{"server":"<nom-serveur>"}}'
```

Puis applique tes touches créatives (étapes 4-5) dans `<nom>/`.

## 7. Smoke local (échoue vite avant la CI)

```bash
cd <nom> && npm install --no-audit --no-fund
npm run db:generate   # si db (génère drizzle/ depuis le schéma composé)
npm run build         # doit réussir (exit 0)
```

Corrige toute erreur de build avant de pousser. Reviens à la racine de l'atelier ensuite.

## 8. Déploie jusqu'en prod

```bash
git add <nom> && git commit -m "🤖 nouveau projet <nom>"
git push                                  # → preview https://<nom>-<branche>.lab.avqn.ch
gh pr create --fill                       # titre : ✨ nouveau projet <nom>
gh run watch                              # attendre la CI verte (build + deploy preview)
gh pr merge <#> --squash                  # → prod ; la branche distante s'auto-supprime
gh run watch                              # attendre la CI de prod
```

Renvoie à Manu le **lien prod** `https://<nom>.lab.avqn.ch`. Pour une app avec auth en prod,
`BETTER_AUTH_SECRET` doit exister (`/lab-secret`, scope `<nom>`, `openssl rand -base64 32`) ;
sans lui l'auth tourne sur un secret par défaut non sûr.

Le projet est **déviable** : Manu peut tout modifier ensuite, les modules ne sont qu'un point de
départ. Pas de DNS à créer (le wildcard `*.lab.avqn.ch` couvre). Build uniquement sur la CI.
