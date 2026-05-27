# counter

Projet témoin **avec base** : un compteur de visites persistant (Postgres central). Sert de
référence pour tout projet qui a besoin d'une base.

- **Déclare ses besoins** dans `lab.json` (`db: true` + commandes `migrate`/`seed`). Au
  déploiement, `deploy.sh` crée la base `counter_<env>`, injecte `DATABASE_URL`, lance
  `migrate` (table) puis `seed` (hors prod).
- **Déployer** : `git push`. `main` → https://counter.lab.avqn.ch ; preview →
  https://counter-<branche>.lab.avqn.ch (base isolée, vide + seed, détruite au teardown).
- **Forme** : `server.js` incrémente et renvoie le compteur ; `db.js` (pool), `migrate.js`,
  `seed.js`. `DATABASE_URL` est **auto-fourni** (pas à gérer).
- **Logs** : `docker logs counter-<env>-app-1` (accès SSH au serveur `lab`).
