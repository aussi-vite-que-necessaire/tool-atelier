# ressources (copie lab)

Plateforme de lead magnets d'AVQN — **copie lab** du produit `ressources`, tournant **en
parallèle de la prod** sur `https://ressources.lab.avqn.ch`. La prod (`ressources.avqn.ch`)
n'est jamais touchée par ce dossier : c'est un environnement d'itération isolé.

Une ressource = une arborescence de pages faites de modules typés, servie sur `/r/<slug>`
par un reader SSR. Accès gaté par OTP email. Pilotage par agent via serveur MCP.

## Stack

**Next.js 16** (App Router, sortie `standalone`) + **Drizzle ORM** (driver `postgres`,
postgres-js) + **better-auth** (email OTP + plugin MCP/OAuth) + **Tailwind 4** + **Resend**.
Schéma dans `db/schema/`, client paresseux dans `db/index.ts` (lit `DATABASE_URL` au runtime).
Migrations SQL committées dans `drizzle/`. Auth dans `lib/auth.ts`.

```
ressources/
├── Dockerfile        multi-stage : deps → build → runner (standalone, non-root, :8080)
├── compose.yml       service app sur le réseau lab (alias ${UPSTREAM}, image ${IMAGE})
├── lab.json          description + db:true + email:true + migrate
├── next.config.ts    output:"standalone"
├── drizzle/          migrations SQL committées (appliquées au déploiement)
├── scripts/migrate.mjs  applique drizzle/ à la base (migrator drizzle-orm/postgres-js)
├── app/              App Router (dont healthz/route.ts → GET /healthz : 200 "ok", sans DB)
├── db/ lib/ components/  schéma, accès données, auth, UI
```


## Skill agentique

Le skill `creer-une-ressource` (cerveau qui pilote `ressources` via MCP) vit maintenant dans le hub central de l'atelier : `skills/skills/creer-une-ressource/`. Téléchargeable sur `https://skills.lab.avqn.ch` après connexion OTP.

## Déployer

`git push` sur une branche → preview `https://ressources-<branche>.lab.avqn.ch`. Merge de la
PR → prod lab `https://ressources.lab.avqn.ch`. Jamais de commit direct sur `main`. La CI
build l'image (`docker build`) → GHCR → pull sur `lab` ; le serveur ne build jamais.

## Données & secrets

`lab.json` déclare `"db": true` → la plateforme crée la base `<projet>_<env>` (Postgres
central) et injecte **`DATABASE_URL`** automatiquement. Le one-shot **`migrate`** applique
`drizzle/` avant le démarrage. `"email": true` signale le besoin d'envoi d'emails (Resend).

Les autres secrets ne sont pas auto-injectés : ils viennent de
**`/opt/lab/secrets/ressources.env`** sur `lab` (posé hors dépôt, jamais committé) :

- `BETTER_AUTH_SECRET` — clé de signature des sessions (≥ 32 caractères, `openssl rand -base64 32`)
- `BETTER_AUTH_URL` — URL publique de l'app (ex. `https://ressources.lab.avqn.ch`)
- `APP_URL` — base des liens (MCP/partage), idem URL publique
- `RESEND_API_KEY` — clé Resend (sinon le code OTP est loggé côté serveur)
- `RESEND_FROM_EMAIL` — expéditeur, ex. `Ressources <noreply@…>`

`NEXT_PUBLIC_BETTER_AUTH_URL` est **inlinée au build** (figée à `https://ressources.lab.avqn.ch`
via l'ARG du Dockerfile). Faire évoluer le schéma : éditer `db/schema/`, `npm run db:generate`,
committer — le prochain déploiement applique la migration.

## Vérifier visuellement (dev local)

L'accès est gaté par OTP **même pour les ressources publiques** (`lib/access.ts`). Sans clé
Resend, le code OTP est **loggé dans la console du serveur** (`[OTP] <email> -> <code>`). Le
reader (`app/(public)/r/[slug]/`) adapte sa grille selon le nombre de pages / sections
(`components/reader/reader-shell.tsx`). Admin sous `app/admin/*` ; MCP sous
`app/api/[transport]/route.ts`.

<!-- redeploy: email réel (Resend) -->
