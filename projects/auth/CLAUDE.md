# auth — identity provider central de la suite contentos

SSO partagé entre tous les services de la suite (media, cast, ressources, www…). Une connexion
sur `auth.contentos.ch` ouvre la session pour `*.contentos.ch`. Pas de gestion des users ailleurs.

## Stack

- **Next.js 16** App Router (sortie `standalone`), écoute `:8080`.
- **BetterAuth** : `src/lib/auth.ts`, routes `app/api/auth/[...all]`.
- **Drizzle ORM** (Postgres) : schéma BetterAuth dans `src/db/schema.ts`.
- **Tailwind 4** thème sobre (`src/app/globals.css`).
- **Auth par OTP email** (Resend en prod ; code `000000` en preview).

## Stratégie SSO — cookie partagé

`src/lib/auth.ts` configure `advanced.crossSubDomainCookies.domain` selon le host :

| Environnement                          | Cookie domain          | Portée                                    |
|----------------------------------------|------------------------|-------------------------------------------|
| `auth.contentos.ch` (prod)             | `.contentos.ch`        | Tous les services prod de la suite        |
| `auth-<branche>.preview.contentos.ch`  | `.preview.contentos.ch`| Toutes les previews de la suite           |
| `localhost`                            | (default, par host)    | Local seulement, pas de SSO               |

En preview, **toutes les previews de tous les services partagent un seul cookie** — pratique pour
tester l'intégration cross-service, mais conscient que les previews ne sont pas étanches entre
elles (acceptable car bases preview seedées + droppées à chaque déploiement).

`trustedOrigins` autorise `contentos.ch`, `*.contentos.ch` et `*.preview.contentos.ch`.

## Preview — users de test, auto-login & déconnexion

En preview (jamais en prod), `auth` seede **3 utilisateurs de test** et expose deux routes
qui matérialisent une **vraie** session BetterAuth (cookie `.preview.contentos.ch` partagé) :

| Rôle | id | email | accountType | usage |
|------|----|-------|-------------|-------|
| Opérateur 1 | `preview-op-1` | `user1@avqn.ch` | `operator` | auto-login des apps admin (ressources/media/cast) |
| Opérateur 2 | `preview-op-2` | `user2@avqn.ch` | `operator` | second opérateur (test d'isolation) |
| Audience 3 | `preview-aud-3` | `user3@avqn.ch` | `audience` | auto-login de `docs`, abonné à op1+op2 |

- Constantes : `src/lib/preview-users.ts`. **À garder EN PHASE** avec `scripts/seed.mjs`
  (JS pur, ne peut pas importer le module) et avec les seeds clients (ressources/media/cast).
- `GET /preview-login?user=1|2|3&redirect=…` : ouvre la session du user (OTP `000000` joué
  côté serveur), pose le cookie, redirige (redirect whitelisté suite). Les clients y
  redirigent un visiteur sans session quand le marqueur de logout est **absent** → auto-login.
- `GET /preview-logout?redirect=…` : efface la session **et** pose le marqueur suite-wide
  `cos_preview_login=manual` (`.preview.contentos.ch`), puis renvoie sur `/sign-in` (chooser).
  Tant que le marqueur est là, les clients montrent le chooser (plus d'auto-login).
- `/sign-in` en preview : boutons de connexion rapide user1/2/3 (+ formulaire email + `000000`).
- Côté clients : `lib/auth/preview.ts` porte `loginRedirect()` (helper pur testé) qui choisit
  auto-login vs chooser selon le marqueur ; `signOutUrl()` pointe vers `preview-logout`.
- Câblage : `deploy.sh` injecte en preview `AUTH_URL=https://auth-<branche>.preview.contentos.ch`
  dans le `.env` des clients → ils parlent à l'auth de **leur** branche (qui doit donc être
  déployée sur la branche pour que le flux marche de bout en bout).

## Pour brancher un service client (media, cast, ressources…)

Le client lit la session via un appel HTTP à `auth.contentos.ch/api/auth/get-session`, en
**forwardant le cookie du browser**. Aucun secret partagé, aucune dépendance DB — découplage propre.

```ts
// src/lib/session.ts (dans le service client)
export async function getSession(headers: Headers) {
  const cookie = headers.get("cookie");
  if (!cookie) return null;
  const res = await fetch(`${process.env.AUTH_URL}/api/auth/get-session`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data?.user ? data : null;
}
```

`AUTH_URL` côté client : `https://auth.contentos.ch` en prod, `https://auth-<branche>.preview.contentos.ch`
en preview (ou un alias stable pour le SSO de preview — à arbitrer). En local, le SSO n'est pas testé.

Pour rediriger vers le login : `${AUTH_URL}/sign-in?redirect=${encodeURIComponent(currentUrl)}`.

## Secrets (`/lab-secret`, scope `auth`)

- `BETTER_AUTH_SECRET` — `openssl rand -base64 32`, ≥ 32 caractères. Sans lui, BetterAuth tourne
  sur un secret par défaut non sûr (warnings en logs).

Auto-injectés (ne pas gérer à la main) : `DATABASE_URL`, `RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`.

## Repères

- `src/lib/auth.ts` — config BetterAuth (cookie domain, trustedOrigins, OTP).
- `src/lib/auth-preview.ts` — code `000000` en preview, sans envoi mail.
- `src/lib/email.ts` — Resend.
- `src/app/api/auth/[...all]` — handler BetterAuth (signin, callback, getSession…).
- `src/app/sign-in/` — page de connexion OTP.
- `healthz/route.ts` — `GET /healthz` → 200.
- `docs/superpowers/specs/` — design doc SSO suite contentos.

## Déployer

`git push` sur une branche → preview `https://auth-<branche>.preview.contentos.ch`.
Merge de la PR → prod `https://auth.contentos.ch`. Jamais de commit sur `main`.

