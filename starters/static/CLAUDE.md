# static starter

Page/site statique. `public/` contient les fichiers servis ; `server.js` les sert + expose `/healthz`.
Pas de base. Pour devenir dynamique : ajoute une route dans `server.js`, ou recompose un projet avec `/lab-new` (capacités `db`/`auth`/`mcp`).
Déploie : push de branche = preview, merge de PR = prod.
