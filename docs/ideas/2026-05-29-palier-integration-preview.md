# Palier d'intégration `preview.contentos.ch` — idée en backlog

Née de la décision de centraliser les MCP (ADR-0003). La passerelle `mcp.contentos.ch` enjambe
plusieurs outils ; le modèle de preview par-branche (un seul outil isolé) ne permet pas de la
tester de façon réaliste. D'où l'idée d'un **3ᵉ palier d'environnement** où toute la suite est
buildée ensemble. Recoupe fortement le « staging continu » déjà esquissé dans
`2026-05-28-e2e-mutualises.md` — à fusionner le moment venu.

## Contexte (29/05/2026)

L'atelier a deux paliers :

1. **preview** — par branche, `<projet>-<branche>.preview.contentos.ch`. Un push = une preview
   d'**un seul** outil, isolée. Boucle d'itération courte, dev localisé.
2. **prod** — merge de PR, `<projet>.contentos.ch` (cas `www` → apex).

Rien entre les deux où la suite tourne **assemblée**. Or certaines choses ne se testent qu'au
niveau suite : la passerelle MCP (cross-outils), le SSO cross-subdomain de bout en bout, les
e2e lourds (cf. idée e2e).

## L'idée — `preview.contentos.ch`, palier d'intégration

Un environnement intermédiaire où **toute la suite est rebuildée ensemble**, sous le wildcard
`*.preview.contentos.ch` déjà en place (les outils y vivraient en `<projet>.preview.contentos.ch`
côté intégration, et la passerelle en `mcp.preview.contentos.ch`).

- Les **branches restent du dev localisé** (preview par-branche, un outil) — on ne change rien
  là.
- Le **test d'intégration réaliste** (MCP complet, SSO, e2e) se fait **uniquement** sur ce
  palier, sur l'état consolidé de la suite.
- **prod devient une promotion explicite** depuis l'intégration validée, plutôt qu'un envoi
  auto-magique au merge.

## Tradeoffs

- **Un palier de plus à maintenir** : bases `<projet>_integration` (convention `<projet>_<env>`),
  build de toute la suite, déploiement, teardown. Coût infra réel.
- **Alimentation non triviale** — c'est la vraie question ouverte (ci-dessous). « Toutes les
  branches de preview se mergent automatiquement » est séduisant mais ingérable tel quel
  (conflits, quelles branches, quand). Une branche `staging`/`integration` qu'on **promeut**
  semble plus sain.
- **Gain** : la passerelle MCP et les flows cross-outils deviennent testables sans bricoler des
  previews par-branche ; prod gated par une intégration verte.

## Questions ouvertes

- **Alimentation.** Branche `integration` dédiée qu'on push (merge des branches prêtes) ? Un
  build de toute la suite à chaque merge sur `main`, nommé `integration` au lieu de `prod`, prod
  devenant une promotion explicite ? (même fourche que l'idée e2e — à trancher une seule fois
  pour les deux).
- **Données.** DB séparée par palier (`<projet>_integration`), seed dédié — cohérent avec la
  convention actuelle. Pas de partage avec prod.
- **Périmètre.** Tous les outils à chaque build, ou seulement ceux touchés ? (un build complet
  est plus simple et c'est le but : tester l'assemblage).
- **Échec.** Une intégration rouge bloque-t-elle la promotion vers prod (probable) et/ou les
  merges suivants ?
- **Héritage.** Opt-in via `lab.json` ou automatique pour tout outil de la suite ?

## Triggers pour revisiter

- **Quand on implémente la passerelle MCP** (ADR-0003) et qu'on veut la tester en conditions
  réelles cross-outils — c'est le déclencheur immédiat.
- **Quand un 2ᵉ besoin de test « niveau suite » apparaît** (e2e mutualisés, SSO de bout en bout) :
  deux consommateurs concrets pour modeler le palier sans abstraire à l'aveugle.

## Décision actuelle (29/05/2026)

**Design validé** → `docs/superpowers/specs/2026-05-29-palier-integration-preview-design.md`
(modèle : `main` = intégration, prod = promotion d'artefact ; découpé en 4 phases). Reste en
backlog ci-dessous le contexte d'origine.

Backlog. La passerelle MCP (ADR-0003) se développe d'abord en pointant ses backends vers les
endpoints internes de **prod** depuis sa branche ; le palier d'intégration est le bon cadre pour
le test réaliste, à construire quand on l'attaque pour de vrai. À fusionner avec l'idée e2e
(`2026-05-28-e2e-mutualises.md`) qui décrit le même « staging continu » sous un autre angle.
