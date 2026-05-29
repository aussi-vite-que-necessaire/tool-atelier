# ADR-0003 : Passerelle MCP centrale (`mcp.contentos.ch`)

**Statut.** Accepted
**Date.** 2026-05-29

## Contexte

Trois outils exposent aujourd'hui un serveur MCP, chacun sur son propre sous-domaine, tous
bâtis sur le même patron (`mcp-handler` + `@modelcontextprotocol/sdk` + `withMcpAuth`) :

| Outil | Endpoint public | Données / compute derrière les tools |
| --- | --- | --- |
| `media` | `media.contentos.ch/api/mcp` | DB `media_*`, R2, Gemini, Chromium partagé (`browser`) |
| `cast` | `cast.contentos.ch/api/mcp` | DB `cast_*`, Redis + worker |
| `ressources` | `ressources.contentos.ch/api/[transport]` | DB `ressources_*` |

Et la capacité est déjà industrialisée (module `starters/modules/mcp/`, flag `mcp` dans
`lab.json`, `/nouveau-projet`) : tout futur outil exposera des tools de la même façon.

Le tool MCP n'est qu'une coquille fine au-dessus de la **logique métier locale** de chaque
outil (sa DB, ses secrets scopés, son R2, son Chromium, son worker). L'authentification, elle,
est **déjà centralisée** : `auth.contentos.ch` (plugin BetterAuth `mcp()` + OIDC + dynamic
client registration + PKCE) est l'unique serveur d'autorisation. Chaque outil ne fait que jouer,
en plus, le rôle de *ressource protégée* OAuth : il revérifie le bearer à sa porte
(`/api/auth/mcp/get-session`) et publie son propre `.well-known`.

Le coût de ce modèle « un MCP public par outil » : N points de connexion à configurer côté
client, N rôles de ressource protégée dupliqués, N audiences de token distinctes, pas de lieu
unique pour le catalogue / les logs / le rate-limiting. On veut **un seul point connectable**
pour piloter toute la suite depuis un agent.

> Prérequis de timing : la suite **n'est pas encore live**. On fait du *fresh*, sans
> rétrocompatibilité ni cohabitation — on remplace, on ne déprécie pas.

## Décision

**Un seul serveur MCP public — la passerelle `mcp.contentos.ch` — qui fédère les tools de tous
les outils. Les outils n'exposent plus de MCP public : ils exposent un endpoint de tools
*interne* sur le réseau lab, et la passerelle est le seul à parler OAuth.**

- **La passerelle est une façade thin, sans métier ni DB** (classe `hello`). Elle : valide le
  bearer, route l'appel vers le bon backend, fusionne les catalogues. Rien d'autre.
- **OAuth uniquement à la passerelle.** Elle est l'unique *ressource protégée* (`resource =
  https://mcp.contentos.ch`, un seul `.well-known`, un seul `verifyMcpToken`). L'AS reste
  `auth.contentos.ch`, inchangé. Les outils, devenus internes, **ne revérifient plus le token** :
  ils font confiance à la passerelle (service-key sur le réseau lab, précédent : l'API `/v1` de
  `media`) qui leur transmet le `userId` déjà résolu. → on *retire* du code (`withMcpAuth` +
  `.well-known` de chaque outil), on n'en ajoute pas.
- **Namespacing des tools** par outil (`media_generate_image`, `res_create_resource`, …) :
  l'union des catalogues doit être unique (deux outils ont des `list_*` homonymes). Non
  optionnel — c'est une contrainte du protocole, pas un choix de design.
- **Autorisation préservée par backend.** La passerelle reste agnostique ; chaque outil applique
  *sa* règle à partir du `userId` transmis. `ressources` continue d'exiger l'opérateur
  (ADR-0002) ; `media`/`cast` acceptent tout user. La passerelle n'unifie surtout pas ça.
- **Données binaires interdites sur le canal MCP.** Les tools renvoient des **URL** (R2 publiques
  et permanentes), jamais de base64 inline. Le rendu image inline de `media` (`imageResult`) est
  un leftover à supprimer. → la passerelle est un pur relais JSON.
- **Dégradation partielle.** Un backend indisponible ⇒ ses tools renvoient une erreur ; le
  `tools/list` global ne tombe pas.
- **Catalogue statique en v1.** La passerelle tient une liste de backends (URLs internes).
  L'enregistrement automatique via `lab.json` + `deploy.sh` est une amélioration différable.

## Conséquences

- **Un seul point de connexion** (une URL, une config OAuth, un consentement) pour Manu et les
  agents ; lieu unique pour catalogue, logs, métriques par tool, rate-limiting.
- Les outils **maigrissent** : plus de `/api/mcp` public, plus de `withMcpAuth`, plus de
  `.well-known`. Ils gardent leur code de tools + leurs données ; ils gagnent un endpoint interne
  service-key.
- Le **module starter `mcp` et `/nouveau-projet` changent de sens** : un nouvel outil ne
  scaffolde plus un MCP public OAuth mais un endpoint de tools interne + son entrée dans le
  catalogue de la passerelle.
- Nouveau **SPOF** : `mcp.contentos.ch` down = tous les tools down. Atténué par une passerelle
  stateless et légère, plus la dégradation partielle backend par backend.
- **Élargissement du blast-radius du token** : un token vaut désormais pour *tous* les tools de
  la suite, pas un seul outil. Assumé (c'est le but : une connexion) ; scoping fin reportable.
- **Inflation du catalogue** : un client voit l'union de tous les tools (50+) → coût de contexte
  pour l'agent. Acceptable ; filtrage/regroupement reportable.
- Les **références skills** aux noms de tools (`creer-une-ressource/references/outils-mcp.md`,
  `creer-un-visuel/references/outils.md`) passent aux noms namespacés. Comme on est *fresh*,
  c'est un renommage propre, pas une migration.

## Previews — renvoi

Le modèle de preview par-branche (`<projet>-<branche>.preview.contentos.ch`, un seul outil) ne
permet pas de tester une passerelle qui enjambe plusieurs outils. **Décision : on ne fédère pas
de previews par-branche.** Les branches restent du dev localisé ; le test MCP réaliste de toute
la suite se fait sur un **palier d'intégration dédié** (`preview.contentos.ch`), chantier séparé
documenté en idée (`docs/ideas/2026-05-29-palier-integration-preview.md`, recoupe l'idée
`2026-05-28-e2e-mutualises.md`). En attendant ce palier, la passerelle se développe et se teste
sur sa propre branche en pointant vers les endpoints internes de **prod**.

## Alternatives écartées

- **Monolithe : déplacer les implémentations + DB + secrets dans la passerelle.** Casse
  frontalement « un dossier = un outil = une base » : fusion des bases, des scopes de secrets, du
  Chromium, du Redis/worker, couplage des déploiements. Coût énorme, perte d'isolation.
- **Passerelle qui proxy le protocole MCP vers des backends gardant chacun leur OAuth.** Plus
  lourd et redondant : on garderait N rôles de ressource protégée + N `.well-known`, alors que le
  but est justement de n'en avoir qu'un. Contraire au « thin ».
- **Fédérer les previews par-branche.** Une branche n'a pas forcément de preview correspondante
  pour chaque outil ; sémantique ingérable. Remplacé par le palier d'intégration.
- **Garder les MCP publics par outil et n'ajouter qu'un agrégateur optionnel.** On traîne la
  dette (deux portes par outil) alors qu'on n'est pas encore live et qu'on peut faire propre.
