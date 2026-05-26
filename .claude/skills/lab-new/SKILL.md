---
name: lab-new
description: Créer un nouveau projet dans l'atelier à partir d'un starter (ou vierge). À utiliser quand Manu veut démarrer un nouveau projet, une app, un service, un site, un MCP, etc.
---

# /lab-new <nom> — créer un projet

1. **Cadre le projet** (demande ce qui manque) :
   - **nom** en kebab-case (ex. `mon-app`) — demande en prose.
   - **starter** — choix énumérable, utilise `AskUserQuestion`. Disponibles dans `starters/` :
     - `static` — page/site simple, sans base.
     - `api` — service HTTP/JSON (base Postgres optionnelle).
     - `flagship` — **Next.js + Drizzle + BetterAuth + Tailwind** (avec base). La stack de base de Manu.
     - *vierge* — copie de `hello/` (serveur minimal).
   - **besoins** — base Postgres ? Redis ? Email (Resend) ? (oriente le `lab.json`).
2. Vérifie que `<nom>/` n'existe pas.
3. **Branche** (jamais main) : `git switch -c new/<nom>`.
4. **Copie le starter** : `cp -r starters/<starter> <nom>` (ou `cp -r hello <nom>` pour vierge). Nettoie ce qui ne sert pas.
5. **Renseigne `<nom>/lab.json`** : `description` (demande une phrase à Manu) + `db`/`redis`/`email`/`migrate`/`seed` selon les besoins et le starter. (Un starter avec base a déjà ses `migrate`/`seed`.)
6. Adapte le `CLAUDE.md` du projet (nom + but).
7. Commit sur la branche, **ouvre une PR** : `gh pr create --fill` (ou titre « ✨ nouveau projet <nom> »).
8. Pousse la branche → suis la CI (`gh run watch`) → annonce l'**URL preview**. Le **merge de la PR** déploiera la **prod** `<nom>.lab.avqn.ch`.
9. Rappelle que le projet est **déviable** : Manu peut tout modifier ensuite, le starter n'est qu'un point de départ — il n'enferme pas dans une stack.

Pas de DNS à créer (le wildcard `*.lab.avqn.ch` couvre). Build uniquement sur la CI.
