# Palier d'intégration `*.preview.contentos.ch` — design

**Date.** 2026-05-29
**Statut.** Validé, prêt pour découpage en plans
**Idées sources.** `docs/ideas/2026-05-29-palier-integration-preview.md`,
`docs/ideas/2026-05-28-e2e-mutualises.md`
**Lié.** ADR-0003 (passerelle MCP centrale) ; spec deploy `2026-05-29-fiabiliser-deploy-lab-design.md`
(le verrou global est un prérequis : ce palier amplifie la concurrence des deploys).

## Problème

L'atelier a deux paliers : preview **par-branche** (`<projet>-<branche>.preview.contentos.ch`,
un seul outil isolé) et prod (merge → `<projet>.contentos.ch`). Rien entre les deux où la suite
tourne **assemblée**. Or certaines choses ne se testent qu'au niveau suite : passerelle MCP
(cross-outils), SSO cross-subdomain de bout en bout, e2e lourds. Conséquence visible : une
preview par-branche de `media` pointe son SSO vers `auth-<branche>.preview`, qui n'existe pas si
la branche ne déploie pas `auth` → SSO cassé en preview. Et « tester vraiment toutes les
fonctionnalités » n'a aujourd'hui **aucun lieu** (le smoke e2e CI est même dormant : plus aucun
projet n'a de `playwright.config.ts`).

## Décision de modèle (validée)

**`main` devient l'intégration ; prod devient une promotion explicite d'artefact.** Modèle
trunk-based : un seul point d'intégration (`main`), pas de branche longue-durée parallèle (qui
serait la ressource mutable partagée que l'Étoile polaire interdit). La suite n'est pas encore
live → l'inversion `merge = prod` → `merge = intégration` est sans risque et la doc peut être
réécrite librement.

| | Avant | Après |
| --- | --- | --- |
| Merge PR → `main` | deploy **prod** (projets changés) | deploy **intégration** (projets changés, suite debout) |
| prod | automatique au merge | **promotion manuelle** (`workflow_dispatch`) d'images déjà testées |
| branche `prod` | — | aucune (rien de neuf à garder dans `branch-guard`) |

## Architecture

### A. Env intégration = persistant et complet

L'intégration est un **déploiement persistant de toute la suite** sous `*.preview.contentos.ch`
avec les **noms propres** : `media.preview.contentos.ch`, `cast.preview.contentos.ch`,
`mcp.preview.contentos.ch`, `auth.preview.contentos.ch`. Tous les outils y tournent en
permanence → on teste **toujours la suite entière assemblée**.

**Rebuild incrémental, pas tout-rebuild.** Chaque merge sur `main` ne rebuild/redéploie que les
projets **changés** (même logique `detect` qu'aujourd'hui, ciblée sur `env=integration`) ; les
autres restent debout dans leur dernière version intégrée. Bootstrap initial = build de toute la
suite une fois.

**Pas de fan-out spécial pour le socle partagé.** `@contentos/ui` (vendored via `bin/ui-sync`)
et le contrat Drizzle (`scripts/sync-shared.sh`) sont **copiés dans `projects/<projet>/`** chez
chaque consommateur. Une modif du socle se matérialise donc comme un diff dans le projet
consommateur → `detect` le voit changé et le rebuild automatiquement. Le choix « vendor + sync »
rend le modèle incrémental correct sans logique additionnelle.

### B. Nommage & routage (`scripts/deploy.sh`)

Règle ajoutée, même nature que les cas spéciaux `www`→apex et prod/preview existants :

```
si ENV = "integration" :
  PRIMARY_HOST = "<projet>.preview.contentos.ch"   # sans suffixe de branche
  (cas mcp → "mcp.preview.contentos.ch" suit la même règle, PROJ=mcp)
  AUTH_URL     = "https://auth.preview.contentos.ch"
sinon si ENV != "prod" (preview par-branche) : inchangé (<projet>-<env>.preview…, auth-<env>.preview)
sinon (prod) : inchangé
```

Les previews par-branche gardent leur suffixe `-<branche>` → aucune collision avec les noms
propres de l'intégration.

### C. Slug d'env & detect (`.github/workflows/deploy.yml`)

`detect` : `ref = main` → `env = integration` (aujourd'hui `prod`). Le reste du calcul des
projets changés est inchangé (rebuild incrémental). Les autres branches → preview par-branche,
inchangé.

### D. Promotion prod sans rebuild (nouveau `workflow_dispatch`)

URLs lues au **runtime** depuis le `.env` injecté par compose (`APP_URL`/`AUTH_URL` via
`process.env`, vérifié). Les `ENV APP_URL=…` des Dockerfiles ne sont que des défauts écrasés par
`env_file`. **La même image se reconfigure par son `.env`** → promotion = re-tag + redeploy, pas
de rebuild.

Workflow `promote` (déclenché manuellement) :
1. Pour chaque projet (et chaque rôle d'image), **re-tag GHCR sans pull** :
   `docker buildx imagetools create --tag …:prod …:integration`.
2. SSH lab → `deploy.sh <projet> prod <images:prod>` (régénère `.env` prod : `APP_URL` propre,
   `AUTH_URL` retiré → défaut `auth.contentos.ch`, secrets prod).
3. Pose un **tag git** (`prod-YYYY-MM-DD-HHMM` ou le SHA) pour traçabilité/rollback.

**Invariant à garder** (option : guard CI) : aucune URL inlinée au build via `NEXT_PUBLIC_*`
(sinon figée à l'URL d'intégration et fausse en prod). Aucune aujourd'hui.

### E. Données

`<projet>_integration` sur le Postgres central (convention `<projet>_<env>` existante : `deploy.sh`
crée la base, joue `migrate` puis `seed` car `env != prod`). **Seed d'intégration dédié** : le
`seed` du projet pour démarrer ; une variante plus riche pourra être ajoutée. **Place réservée
pour un clone anonymisé de prod** (activable quand la suite sera live) : `pg_dump` prod →
scrubbing PII → restore *avant* `migrate` (teste les migrations contre des données réalistes).
Le scrubber lui-même est hors périmètre immédiat.

### F. e2e cross-suite

Tournent **contre l'intégration** (suite debout, SSO réel `auth.preview`, passerelle
`mcp.preview`). Companion de l'idée `e2e/` (projet dédié). Échec e2e → **bloque la promotion vers
prod**, sans bloquer les merges suivants (réparation en parallèle). Implémentation détaillée dans
sa propre phase (rejoint `e2e-mutualises.md`).

### G. Impacts transverses

L'inversion `merge = prod` → `merge = intégration` ripple dans la doc/skills, à réécrire (rien
n'est live) :
- `CLAUDE.md` — sections « Workflow & isolation », « Déployer », « Données » (« PR mergée = prod »
  → « PR mergée = intégration ; prod = promotion explicite »).
- skill `nouveau-projet` (déploiement « jusqu'en prod » → « jusqu'en intégration »).
- message du hook `session-start` (« PR mergée = prod »).
- `branch-guard` : **inchangé** (main reste protégé PR-only ; pas de branche `prod`).

## Découpage en plans (un par phase)

1. **Socle env intégration** — slug `main→integration` (`detect`), nommage/AUTH_URL
   `deploy.sh`, deploy persistant de la suite, base+seed `_integration`. *Livrable : la suite
   assemblée visible et navigable sur `*.preview.contentos.ch`.*
2. **Promotion prod** — workflow `promote` (`workflow_dispatch`), re-tag imagetools, deploy
   `:prod`, tag git. *Livrable : prod gated, promue depuis l'intégration validée.*
3. **Doc & garde-fous** — réécriture `CLAUDE.md`/`nouveau-projet`/`session-start` ; guard CI
   anti-`NEXT_PUBLIC`-URL. *Livrable : le nouveau modèle est la vérité documentée.*
4. **e2e cross-suite** — projet `e2e/`, specs cross-outils, gate de promotion. *Peut suivre plus
   tard ; rejoint `e2e-mutualises.md`.*

Chaque phase = sa propre spec/plan/impl si besoin. Les phases 1→3 forment le cœur cohérent ; la 4
est détachable.

## Hors périmètre

Scrubber d'anonymisation prod→intégration, projet `e2e/` complet (idée dédiée), supervision RAM
du lab (autre idée).
