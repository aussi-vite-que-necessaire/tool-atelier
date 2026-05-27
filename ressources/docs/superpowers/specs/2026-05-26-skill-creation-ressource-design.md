# Skill « créer une ressource via MCP » — design

## Contexte & objectif

Produire un **skill** (au sens Claude : un dossier avec `SKILL.md`) qui guide un agent
dans la création d'une nouvelle ressource (lead magnet / cours) sur la plateforme
lab-ressources, via le serveur MCP `avqn_res`.

Le skill n'est **pas** destiné à être installé dans ce projet. C'est une **source** :
on le zippe et on le téléverse sur claude.ai (« téléverser une compétence »), pour
l'utiliser depuis n'importe quel contexte où le MCP `avqn_res` est connecté.

Le skill guide de l'**idée** jusqu'à la **publication** : il questionne, raffine,
recherche au besoin, propose un plan, crée la ressource et sa cover, relit, puis
propose de publier.

## Sortie attendue

Un dossier zippable, autonome :

```
skills/                         ← dossier-source racine (hors .claude/, jamais auto-chargé)
  creer-une-ressource/          ← LE skill = ce qu'on zippe pour claude.ai
    SKILL.md                    ← orchestre le flow, court, oriente vers les références
    references/
      modules.md                ← les 14 types de module : shape `content` exacte + usage
      outils-mcp.md             ← catalogue des outils avqn_res (params, retour, quand)
      verification.md           ← checklist de relecture finale
```

Sur claude.ai, un skill téléversé = un dossier avec `SKILL.md`. Les fichiers de
`references/` sont chargés **à la demande** par le `SKILL.md` (progressive disclosure),
au moment où la phase concernée en a besoin. Ce ne sont pas des skills enregistrés
séparément.

## Frontmatter

```yaml
name: creer-une-ressource
description: >
  Crée une ressource (lead magnet / cours) AVQN via le MCP avqn_res, en guidant de
  l'idée à la publication. À utiliser quand on veut concevoir un nouveau cours ou une
  ressource sur la plateforme. Nécessite le MCP avqn_res connecté.
```

## Flow encodé dans SKILL.md (4 phases)

### Phase 0 — Préalable
Vérifier que le MCP `avqn_res` répond (un appel léger type `list_resources`). S'il
n'est pas connecté : s'arrêter net et demander de connecter `avqn_res`. Le skill ne
fait rien sans lui.

### Phase 1 — Thème & raffinage
À partir de l'idée fournie :
- Poser des questions **une à une** via l'outil natif `AskUserQuestion` : public visé,
  promesse / objectif du lead magnet, périmètre, format (multi-pages vs article unique),
  ton.
- Si l'idée a besoin d'être nourrie ou vérifiée, faire des recherches web
  (`WebSearch` / `WebFetch`).
- Faire des suggestions concrètes plutôt que des questions ouvertes vagues.

### Phase 2 — Plan high-level
Rédiger un plan **dans le chat, sans rien créer dans le MCP** :
- titre, slug proposé, description, public ;
- arborescence des pages ;
- pour chaque page, les modules envisagés (par type) ;
- piste pour la cover.

Puis **demander validation du plan** à l'utilisateur.

### Phase 3 — Affinage final & création
Après validation du plan :
- Dernières questions ciblées si nécessaire (via `AskUserQuestion`).
- Création via MCP :
  - petite ressource → `create_resource` avec tout l'arbre (`rootModules` + `pages`) ;
  - grosse ressource → coquille via `create_resource`, puis `add_page` /
    `add_modules` **page par page** (un appel par page).
- Cover : générer via le MCP Media Studio si disponible (`generate_image` → URL
  publique) et la poser via `update_resource.coverImageUrl`. Si Media Studio n'est pas
  connecté : demander une URL ou proposer de sauter.
- La ressource est créée en **brouillon** (`published: false`),
  `visibility: public` par défaut (de toute façon gatée OTP).

### Phase 4 — Relecture & vérification
- Relire la ressource via `get_resource` / `get_outline`.
- Dérouler `verification.md` : sections non vides, sommaire propre, cohérence avec le
  plan validé, cover présente, slug propre, modules valides.
- Donner l'URL finale + un récap, proposer les ajustements éventuels.
- **Proposer explicitement de publier** : si l'utilisateur valide,
  `update_resource` → `published: true`.

## Contenu des fichiers de référence (factuels, légers)

### modules.md
Les 14 types avec leur shape `content` exacte et une ligne « quand l'utiliser » :
`markdown`, `callout` (variant info/warn/success), `image`, `video`, `file`, `embed`,
`code`, `prompt`, `accordion`, `steps` (≥1), `comparison` (2–3 colonnes), `quote`,
`cta` (primary/secondary), `gallery` (≥1).

### outils-mcp.md
Les outils `avqn_res` groupés, avec params clés et valeur de retour :
- ressource : `list_resources`, `get_resource`, `get_outline`, `create_resource`,
  `update_resource`, `delete_resource` ;
- pages : `add_page`, `update_page`, `delete_page`, `move_page`, `reorder_pages` ;
- modules : `add_module`, `add_modules`, `update_module`, `delete_module`,
  `reorder_modules` ;
- accès / stats : `grant_access`, `revoke_access`, `get_stats`.
Inclut la règle « petite ressource = tout en un appel / grosse = page par page ».

### verification.md
Checklist de relecture finale (Phase 4), orientée cohérence et complétude.

## Décisions

- **Langue** : français (cohérent avec le projet et les ressources produites).
- **Dossier-source racine** : `skills/`.
- **État par défaut à la création** : `published: false`, `visibility: public`.
- **Publication** : proposée explicitement à la fin de la Phase 4, jamais automatique.
- **Cover** : Media Studio si disponible, sinon demander une URL ou sauter — pas de
  dépendance dure à Media Studio.
- **Profondeur** : légère. Le `SKILL.md` porte le flow et la mécanique ; pas de
  dissertation pédagogique. Les références restent des catalogues factuels.

## Hors périmètre

- Pas de modification du code de l'application ni du MCP `avqn_res`.
- Pas d'installation du skill dans `.claude/` de ce projet.
- Pas de dépendance dure à un MCP de génération d'image.
- Pas d'opinion pédagogique longue (structure de cours « idéale », etc.).

## Critères de réussite

- Le dossier `skills/creer-une-ressource/` est autonome et zippable tel quel pour
  claude.ai.
- Le `SKILL.md` décrit sans ambiguïté les 4 phases et appelle les bons fichiers de
  référence au bon moment.
- Un agent qui suit le skill peut, MCP connecté, mener une idée jusqu'à une ressource
  relue et prête à publier, sans connaître le code du projet.
- Les références reflètent fidèlement les schémas réels des modules et les signatures
  des outils MCP.
