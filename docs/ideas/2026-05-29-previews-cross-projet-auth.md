# Previews cross-projet : dépendance `auth` par-branche — idée en backlog

Née d'un incident concret (29/05/2026, PR #86 « calendrier full-bleed ») : la preview cast
affichait **« A server error occurred »** sur toute page authentifiée. Cause = infra, pas le
code de la feature.

## Le bug observé

`scripts/deploy.sh` (≈ lignes 152-161) force, en preview, pour **tout** projet client de l'auth :

```sh
AUTH_URL=https://auth-<branche>.preview.contentos.ch
```

…en supposant qu'une **preview du service `auth` existe pour la même branche**. Mais les
previews ne déploient **que les projets modifiés**. Une branche qui ne touche que `cast` n'a
donc **aucune** preview `auth-<branche>` → ce sous-domaine n'a aucun site sur le lab → le
terminateur TLS répond une **alerte 80** (`tlsv1 alert internal error`) → `fetch failed` dans
`requireUserId()` → **500 sur chaque page authentifiée**.

Reproduit aussi sur d'autres branches (ex. `lucid-davinci`) → **systémique**, touche toutes les
previews cast (et tout client de l'auth) qui ne modifient pas `auth`. La prod est saine.

## L'asymétrie de fond

- `MEDIA_ENGINE_URL` vide → `media` retombe sur **prod** (`media.contentos.ch`) → marche en
  preview.
- `AUTH_URL` est **forcé par-branche** → casse quand la branche n'a pas d'auth preview.

`media` est traité comme « dépendance partagée stable », `auth` comme « dépendance par-branche »
(parce que `user1/2/3` y sont seedés et que le cookie auto-login preview en dépend). C'est cette
incohérence qui pique.

## Options (du plus léger au plus lourd)

1. **Auth preview « de base » persistante.** Une seule preview `auth` durable, seedée
   user1/2/3, cible **par défaut** de toutes les previews clientes ; on ne déploie une
   `auth-<branche>` que si la branche **touche** `auth` (routage `auth-<branche>` → base au
   proxy, ou résolu dans `deploy.sh`). Calque le traitement de `media`. Garde la modularité,
   **zéro build auth** pour une PR cast, préserve les users seedés. *Reco à explorer.*
2. **Toujours co-déployer `auth`** (et autres deps runtime) à chaque preview. Simple et robuste,
   mais érode le « on ne build que ce qui change » (une virgule CSS dans cast rebuild auth).
3. **Fallback `AUTH_URL` → prod.** Léger, **mais mauvaise idée** : l'auto-login preview irait
   contre la **prod**, les users seedés ne correspondent plus, mélange test/prod. À éviter.
4. **Monorepo : rapatrier tous les projets dans un projet central.** Supprime toute la classe de
   problème (plus de câblage cross-projet en preview), mais migration douloureuse et perte de la
   modularité « un service par capacité ». Arbitrage DX stratégique, pas un fix.

## Déclencheur

**La prochaine fois qu'une preview casse faute de dépendance cross-projet sur la branche**
(ou quand l'agacement DX dépasse le coût d'un fix), trancher entre (1) auth-base persistante et
(2) co-déploiement systématique — avant d'envisager (4).
