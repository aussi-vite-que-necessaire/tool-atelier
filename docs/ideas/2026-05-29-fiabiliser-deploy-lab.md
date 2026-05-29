# Fiabiliser l'étape `deploy` (pull + run sur le lab)

**Date.** 2026-05-29
**Statut.** À explorer

## Contexte

Rappel d'archi : **tout le build se fait en CI** (GitHub runners) → push sur **GHCR** → le **lab ne fait que `docker pull` + lancer le conteneur** (il ne compile jamais).

Lors du merge de la PR #77 (AppShell), le job `deploy` a **planté pour les 3 projets en prod** alors que les **3 builds CI avaient réussi** (images bien présentes sur GHCR, taguées `:prod`). Un re-run a rattrapé `cast` + `media` ; `ressources` est resté bloqué sur l'ancienne image et a dû être terminé **à la main** via `bash /opt/lab/deploy.sh ressources prod …` (chemin opérateur). Même symptôme observé plus tôt sur les previews de la même session (échec du `docker pull` sur 3 des 4 deploys concurrents, le 4ᵉ passant).

Cause probable : **`docker pull` GHCR flaky** et/ou **pression mémoire du lab** (~300 Mo libres / 3,7 Go au moment des faits) pendant des deploys **concurrents** (pull de gros layers + conteneur one-shot `migrate` + démarrage des conteneurs app/worker en parallèle, pour plusieurs projets à la fois).

## L'idée

Rendre l'étape `deploy` (côté lab) robuste aux hoquets transitoires :
- **Retry avec backoff** sur `docker pull` dans `scripts/deploy.sh` (2-3 tentatives, 2s/4s/8s) — le cas le plus fréquent.
- Éventuellement **sérialiser / limiter le parallélisme** des deploys quand plusieurs projets partent ensemble (ex. `max-parallel: 1` sur le job `deploy`, ou un verrou côté lab), pour ne pas saturer la RAM du serveur.
- **Surveiller la RAM** du lab (alerte / log) pour objectiver la pression mémoire.

## Tradeoffs

- **Gain.** Des deploys prod fiables du premier coup ; plus de rattrapage manuel ni de re-run. Filet déjà partiel : le job `deploy` dépend de `build`+`test`, donc un build cassé ne déploie jamais — reste à durcir le `pull`/`run`.
- **Coût.** Sérialiser les deploys les ralentit (acceptable, ils sont courts — ~45 s). Le retry ajoute un peu de complexité à `deploy.sh`.
- **Inconnue.** Part GHCR (réseau/registry) vs part RAM lab pas tranchée — commencer par le retry (cheap, couvre le cas le plus probable) avant d'investir dans la sérialisation/supervision.
- Recoupe l'idée du **palier d'intégration preview** (build de toute la suite ensemble) : ce palier amplifierait la concurrence des deploys → cette fiabilisation devient plus utile à ce moment-là.

## Quand y revenir

**Dès qu'un `deploy` reflanche** sur un `docker pull` GHCR ou une pression mémoire du lab (récurrence confirmée). Ou plus tôt si on met en place le palier d'intégration `preview.contentos.ch` (build de toute la suite → deploys concurrents systématiques).
