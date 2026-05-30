# Promotion : déplacer le tag `:prod` après le smoke prod, pas avant — idée en backlog

Capturée pendant l'audit adversarial du pipe (it.3→it.4). Fragilité étroite, sans impact sur la
prod *en cours d'exécution* ; à durcir si la promotion devient plus fréquente / multi-mains.

## Contexte (30/05/2026)

`promote.yml` re-tague `:integration`→`:prod` sur GHCR **puis** lance `deploy.sh app prod`.
`deploy.sh` joue les migrations, déploie, et garde le déploiement par un smoke (web `/healthz` +
liveness worker) avec rollback du runtime vers le dernier artefact sain en cas d'échec.

Conséquence : si le smoke prod échoue, le **runtime** prod est protégé (il revient à l'image
précédente), mais le **tag GHCR `:prod`** a déjà été déplacé sur l'artefact non éprouvé-en-prod.
Un re-pull ultérieur de `:prod` (réexécution, redeploy manuel) ramènerait alors la mauvaise image.

Le risque est faible : la même image a déjà passé l'intégration de bout en bout (test + smoke),
donc un smoke prod rouge est rare (l'env ne diffère que par `APP_URL` + secrets).

## L'idée

Inverser l'ordre : déployer la prod d'abord (en passant à `deploy.sh` le **digest** de
l'artefact `:integration`, pas le tag `:prod`), et ne déplacer `:prod`→l'artefact qu'**au succès**
du smoke prod. Le tag `:prod` ne désignerait alors jamais qu'une image qui a passé la prod.

## Déclencheur

Quand les promotions deviennent fréquentes ou pilotées à plusieurs (le tag `:prod` devient une
source de vérité partagée pour les redeploys) — c'est là que le décalage tag/runtime peut mordre.
