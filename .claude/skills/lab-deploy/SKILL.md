---
name: lab-deploy
description: Déployer le projet courant de l'atelier (preview ou prod). À utiliser quand Manu veut mettre en ligne ses changements.
---

# /lab-deploy — déployer

Le déploiement est **piloté par git** : build sur la CI → image sur GHCR → SSH vers `lab` → `deploy.sh`.
Le serveur ne build jamais ; pas de build local non plus.

1. Identifie le **projet courant** (le dossier où l'on travaille) et la **branche** courante.
2. Si la branche est `main` → **STOP** : crée d'abord une branche (`git switch -c work/<projet>-...`). Jamais de commit/push sur main.
3. Commit les changements, puis `git push -u origin <branche>`.
   → déclenche une **preview** : `https://<projet>-<branche>.preview.contentos.ch`.
4. Suis la CI : `gh run watch "$(gh run list -L1 --json databaseId -q '.[0].databaseId')" --exit-status`, puis `curl` l'URL preview pour vérifier.
5. **Prod** : ouvre une PR (`gh pr create --fill`) ; après relecture, **merge** la PR → déploie `https://<projet>.contentos.ch`.
6. Si la CI échoue : `gh run view <id> --log-failed`, corrige, re-push.

Besoins data/email : déclarés dans `<projet>/lab.json` (`db`/`redis`/`email`) → `deploy.sh` provisionne et injecte tout seul (`DATABASE_URL`, etc.).
