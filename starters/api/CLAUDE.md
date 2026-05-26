# api starter

Service HTTP/JSON. Routes dans `server.js` (`/healthz`, `/`, `/api`). Sans base par défaut.
Pour ajouter Postgres : mets `"db": true` (+ `"migrate"`/`"seed"`) dans `lab.json` → `DATABASE_URL`
est injecté ; lis-le dans `server.js` (ex. via le module `pg`). Déploie : push branche = preview, merge PR = prod.
