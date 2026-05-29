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

## Options (du plus léger au plus structurant)

1. **Auth preview « de base » persistante.** Une seule preview `auth` durable, seedée
   user1/2/3, cible **par défaut** de toutes les previews clientes ; on ne déploie une
   `auth-<branche>` que si la branche **touche** `auth` (routage `auth-<branche>` → base au
   proxy, ou résolu dans `deploy.sh`). Calque le traitement de `media`. Garde la modularité,
   **zéro build auth** pour une PR cast, préserve les users seedés. *Fix le plus léger.*
2. **Toujours co-déployer `auth`** (et autres deps runtime) à chaque preview. Simple et robuste,
   mais érode le « on ne build que ce qui change » (une virgule CSS dans cast rebuild auth).
3. **Fallback `AUTH_URL` → prod.** Léger, **mais mauvaise idée** : l'auto-login preview irait
   contre la **prod**, les users seedés ne correspondent plus, mélange test/prod. À éviter.
4. **Big-bang : rapatrier tous les projets dans un seul Next.js central + une seule base.**
   Supprime *toute* la classe de problème (plus de câblage cross-projet en preview, plus de
   tunnels d'URL, plus d'auth par-branche : un seul déploiement, une seule session, une seule
   migration). Migration douloureuse en une fois, mais le résultat est **plus simple à
   maintenir** que le système multi-projet — c'est l'hypothèse à prendre au sérieux (cf. note
   d'architecte ci-dessous), pas le dernier recours.

## Note d'architecte (29/05/2026)

Réflexion de Manu, à garder telle quelle parce qu'elle réoriente le projet :

> « La migration big-bang vers une solution centralisée n'est pas forcément mauvaise. On joue à
> l'architecte. Avant je voulais des MCP séparés, etc., avant d'unifier derrière un *tools
> contentos* avec des sous-projets. La séparation n'a plus autant de sens qu'avant. Là je me dis
> qu'un bon projet Next.js, mais bien structuré, avec tout dans une seule base, finalement ce ne
> serait pas plus dur à maintenir que ce système multi-projet. »

Lecture : le découpage « un service par capacité » (MCP séparés → puis `contentos` unifié avec
sous-projets → puis monorepo de projets déployables indépendamment) répondait à un besoin
d'isolation/modularité **qui s'est érodé**. Les coûts qu'il génère aujourd'hui sont concrets :

- câblage cross-projet fragile en preview (le présent incident) ;
- N images, N déploiements, N bases, N migrations, N `CLAUDE.md` à tenir cohérents ;
- secrets et URLs synthétisés par environnement (`AUTH_URL`, `MEDIA_ENGINE_URL`, tunnels…) ;
- DX : ouvrir/raisonner sur 6 projets là où un seul, bien structuré (modules/dossiers + une
  base avec schémas par domaine), donnerait la même clarté sans la plomberie inter-services.

Ce qu'on perdrait à centraliser : déploiement indépendant par capacité, blast-radius réduit,
possibilité de stacks hétérogènes. À peser : ces bénéfices sont-ils encore *utilisés* ?

## Déclencheur

**À la prochaine douleur de preview cross-projet** (ou dès que l'agacement DX dépasse le coût
d'un fix) : trancher. Deux horizons distincts —
- **court terme / réversible :** (1) auth-base persistante, pour débloquer les previews sans
  rien casser ;
- **structurant :** instruire sérieusement (4) le big-bang « un Next.js + une base », avec un
  vrai spec de migration (inventaire des capacités → modules, schémas par domaine dans une base,
  stratégie de bascule). (2) et (3) ne sont que des rustines.

