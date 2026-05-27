# hello

Projet témoin de l'atelier : un serveur HTTP minimal qui répond `hello from hello @ <env>`.
Sert de **template** (copie ce dossier pour démarrer un nouveau projet).

- **Déployer** : `git push`. `main` → https://hello.lab.avqn.ch ; autre branche →
  https://hello-<branche>.lab.avqn.ch. Le build se fait sur la CI ; suivre avec `gh run watch`.
- **Forme** : `server.js` (app), `Dockerfile` (image, buildée sur la CI), `compose.yml`
  (service `app` sur le réseau Docker `lab`, écoute 8080, exposé par Caddy via l'alias `${UPSTREAM}`).
- **Logs sur lab** : `docker logs hello-<env>-app-1` (accès SSH au serveur `lab`).
- Pas de base de données (chemin minimal). Pour ajouter Postgres/Redis : voir plan 2b.
