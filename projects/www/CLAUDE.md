# www — page d'accueil de contentos.ch

Site statique servi sur **`contentos.ch`** et **`www.contentos.ch`** (deux hosts mappés sur
la même route Caddy par `deploy.sh`, cas spécial pour `www`).

Hello world pour l'instant : la vraie homepage de la suite contentos viendra plus tard.

## Structure

- `public/index.html` — la page.
- `server.js` — petit serveur Node qui sert `public/` et expose `/healthz`.
- Pas de base, pas d'auth, pas de Redis.

## Déployer

Push de branche → preview `https://www-<branche>.preview.contentos.ch`. Merge → prod sur
`https://contentos.ch` + `https://www.contentos.ch`. Jamais de commit sur `main`.
