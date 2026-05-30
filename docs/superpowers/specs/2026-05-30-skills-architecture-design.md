# Architecture des skills + revue MCP — design

> 2026-05-30 · branche `claude/eager-dirac-7tL0G`

## Intention

Mettre l'architecture des skills agentiques de la suite au standard **Agent Skills**
d'Anthropic (déc. 2025), et poser un premier **workflow** réel — « rédige-moi un post » —
découpé en sous-étapes (« sous-skills »), avec un **pas de tir réservé pour des sous-agents**.
Mode MVP : squelettes minces, conformes, qu'on enrichit ensuite. On ne réécrit pas le MCP ;
on le **revue** et on documente les frottements.

## 1. Revue des endpoints MCP (état des lieux)

Registre unique `src/lib/mcp/registry.ts` (capture sans transport), servi par `/api/mcp`
(+ variante interne `/internal/tools`). **66 outils + `ping`.** Tous sont des opérations
d'état/CRUD : **aucun outil ne raisonne**. Conséquence d'architecture : tout le jugement
(rédactionnel, plan, critique) vit dans les **skills** et les **sous-agents**, jamais côté MCP.

### Inventaire par domaine

- **Cast — posts (5)** : `list_posts`, `get_post`, `create_post`, `edit_post`, `delete_post`
- **Cast — voices (4)** : `list_voices`, `create_voice`, `update_voice`, `delete_voice`
- **Cast — formats (4)** : `list_publication_formats`, `create_publication_format`,
  `update_publication_format`, `delete_publication_format`
- **Cast — publishing (6)** : `get_linkedin_connection`, `publish_post_now`, `schedule_post`,
  `cancel_scheduled`, `delete_publication`, `list_publications`
- **Media — images (6)** : `generate_image`, `edit_image`, `render_html`, `list_images`,
  `get_image`, `delete_image`
- **Media — pdf (1)** : `create_pdf`
- **Media — brand (2)** : `get_brand`, `update_brand`
- **Media — styles (4)** : `list/create/update/delete_visual_style`
- **Media — chartes (5)** : `list/get/create/update/delete_style_guide`
- **Media — templates (6)** : `list/get/create/update/delete_visual_template`, `render_template`
- **Media — attache (2)** : `attach_media_to_post`, `detach_media`
- **Ressources — resource (6)** : `list_resources`, `get_resource`, `get_outline`,
  `create_resource`, `update_resource`, `delete_resource`
- **Ressources — pages (5)** : `add_page`, `update_page`, `delete_page`, `move_page`, `reorder_pages`
- **Ressources — modules (5)** : `add_module`, `add_modules`, `update_module`, `delete_module`,
  `reorder_modules`
- **Ressources — accès (2)** : `grant_access`, `revoke_access`
- **Ressources — stats/liens (2)** : `get_resource_stats`, `tracking_link`

### Frottements observés (hors périmètre — à traiter plus tard)

1. **Casse des arguments incohérente** : `publish_post_now` → `postId` (camelCase) ;
   `attach_media_to_post` → `post_id` (snake_case). Harmoniser sur une convention unique.
2. **Drift `image` / `media`** : les outils sont nommés `*_image` mais désignent des « médias »
   (`list_images` titré « Lister les médias »). Renommer `*_media` ou aligner les titres.
3. **CRUD asymétrique** : pas de `get_voice`, ni `get_publication_format`, ni `get_publication`
   (on peut lister mais pas lire l'unité par id pour certaines entités).

→ Ces points seront capturés en backlog (`/noter-idee`) si on veut les traiter ; ils ne
bloquent pas le travail skills.

## 2. Principes Agent Skills (Anthropic, déc. 2025)

- **Skill = dossier + `SKILL.md`** avec frontmatter YAML : `name` (≤64, `[a-z0-9-]`, sans mots
  réservés `claude`/`anthropic`) et `description` (≤1024, **3e personne**, « ce que ça fait
  ET quand l'utiliser » → déclencheur).
- **Divulgation progressive (3 niveaux)** : (1) name+description préchargés ; (2) corps de
  SKILL.md chargé si pertinent ; (3) fichiers bundlés lus **à la demande**. Corps **< 500 lignes** ;
  références **un seul niveau de profondeur** depuis SKILL.md.
- **« Concise is key »** : n'écrire que ce que le modèle ne sait pas déjà. Cadre exactement le
  ton « MVP mini » : squelettes courts, on enrichit par itération guidée par l'usage.
- **Skill vs sous-agent** : un skill = procédure/instructions (+ scripts) chargées dans le
  contexte de l'agent principal ; un **sous-agent** = contexte isolé, prompt/outils propres, pour
  le raisonnement lourd en isolation/parallèle. « Si ça doit réfléchir fort en isolation → agent ».
- **Workflows** : séquence d'étapes + **checklist copiable** ; sortir une étape lourde dans son
  fichier.

## 3. Architecture retenue

### Arborescence du skill `contentos` (kind `workflow`)

Tout vit dans **un** skill. Les « sous-skills » sont des fichiers d'étapes bundlés (niveau 3 de
divulgation progressive). Le pas de tir `agents/` est **réservé** (squelette minimal).

```
src/lib/skills/catalog/contentos/
  SKILL.md                 # frontmatter + vue d'ensemble + CHECKLIST du workflow
  steps/
    1-cadrer.md            # list_publication_formats + list_voices → menu ; l'humain choisit format + voix
    2-plan.md              # matière + structure(format) → plan ; boucle de challenge via agents/
    3-voix.md              # rédige selon le plan dans la voix choisie, SANS mise en page
    4-mise-en-page.md      # applique les writingRules (cosmétique) du format
    5-poser.md             # create_post → montre le post, confirme qu'il apparaît dans l'outil
  agents/
    critique-editoriale.md # pas de tir : sous-agent critique du plan (squelette)
  references/
    outils-mcp.md          # cheat-sheet des outils MCP par domaine (revue condensée pour l'agent)
```

### Le workflow « rédige-moi un post »

Déclencheur : l'humain demande un post **en fournissant la matière**.

1. **Cadrer** (`steps/1-cadrer.md`) — `list_publication_formats` + `list_voices`, présenter un
   **menu** ; l'humain choisit **un format** et **une voix**. L'étape ne fait que ça.
2. **Plan** (`steps/2-plan.md`) — lire la `structure` du format + la matière → bâtir un **plan**.
   **Boucle de challenge** : dispatcher le(s) sous-agent(s) de `agents/` qui critiquent le plan
   (angle marketing/éditorial), itérer jusqu'à un plan solide.
3. **Voix** (`steps/3-voix.md`) — rédiger le contenu en suivant le plan, dans la **voix** choisie
   (`content` de la voix). On garde la structure, on soigne les formules/le ton. **Pas de mise en page.**
4. **Mise en page** (`steps/4-mise-en-page.md`) — appliquer les `writingRules` du format
   (emojis, hashtags, puces, règles de présentation).
5. **Poser** (`steps/5-poser.md`) — `create_post` (title + content), montrer le post à l'humain,
   confirmer qu'il apparaît dans l'outil (visible côté Contentos).

### Sous-agents (pas de tir réservé)

`agents/critique-editoriale.md` : **squelette** d'un sous-agent qui challenge le plan à l'étape 2.
Format minimal (frontmatter `name`/`description` + rôle court). On garde le **contenu mince** ;
le but est de matérialiser le point d'extension, pas de finaliser les critiques. Étape 2 le
référence comme hook (« dispatcher le sous-agent `agents/critique-editoriale.md` »).

## 4. Métadonnées : frontmatter source unique

- `manifest.json` est **supprimé**. Le frontmatter de `SKILL.md` est la seule source :
  ```yaml
  ---
  name: contentos
  description: Rédige un post de bout en bout (LinkedIn) à partir d'une matière fournie… Use when the user asks to "rédige-moi un post"…
  metadata:
    kind: workflow            # workflow | atomic
    domain: suite             # suite | cast | media | ressources
    version: 2
    tagline: "…"
    requires_mcp: [contentos]
  ---
  ```
- **Mini-parseur frontmatter dédié** (`src/lib/skills/frontmatter.ts`), pas de dépendance YAML
  (cf. ethos repo : `archive.ts` écrit le ZIP à la main). Il gère : scalaires `clé: valeur`,
  un bloc `metadata:` indenté (scalaires + tableaux *inline* `[a, b]`), nombres et chaînes
  (guillemets optionnels). Strictement notre schéma, testé.
- `catalog.ts` lit le frontmatter au lieu de `manifest.json`. Le type expose :
  `name`, `description`, `kind`, `domain`, `version`, `tagline`, `requires_mcp`.
- **Test de conformité** : chaque skill du catalogue a un frontmatter valide
  (`name` `[a-z0-9-]` ≤64 sans mot réservé ; `description` non vide ≤1024).

## 5. Impacts

- `src/lib/skills/frontmatter.ts` — **nouveau** : mini-parseur + validation.
- `src/lib/skills/catalog.ts` — lit le frontmatter ; `SkillManifest` → `{ name, description,
  kind, domain, version, tagline, requires_mcp }` ; tri (`suite` d'abord) sur `domain`.
- `src/lib/skills/catalog/contentos/` — refonte : `SKILL.md` (frontmatter + checklist),
  `steps/*.md`, `agents/critique-editoriale.md`, `references/outils-mcp.md` ;
  suppression de `manifest.json`.
- `src/lib/skills/catalog/README.md` — documenter la convention (frontmatter, steps, agents,
  references, kind/domain).
- `src/app/(app)/skills/page.tsx` — utiliser `domain` (au lieu de `tool`) + badge `kind`.
- `src/lib/skills/archive.ts` — **inchangé** (zippe déjà tout le dossier → ZIP conforme).
- `src/app/(app)/skills/[name]/download/route.ts` — inchangé (utilise `name`/`version`).

## 6. Tests (TDD)

- `test/unit/skills-frontmatter.test.ts` — parse name/description, bloc metadata
  (scalaires, nombre `version`, tableau `requires_mcp`), guillemets, frontmatter absent → erreur.
- `test/unit/skills-catalog.test.ts` — mis à jour : `listSkills` renvoie `contentos`
  (`kind: workflow`, `domain: suite`, `version: 2`), champs issus du frontmatter ; tri
  `suite` d'abord ; nom invalide rejeté.
- `test/unit/skills-conformance.test.ts` — **nouveau** : tout skill a un frontmatter valide
  (contraintes `name`/`description` du standard) + un `SKILL.md`.
- `test/unit/skills-archive.test.ts` — **nouveau/étendu** : le ZIP de `contentos` contient
  `SKILL.md`, un fichier `steps/…`, `references/outils-mcp.md` (divulgation progressive bundlée).

## 7. Hors périmètre (itérations suivantes)

- Enrichir le **contenu** des steps et des sous-agents critiques.
- Faire « graduer » un step réutilisable en skill atomique de premier niveau.
- Harmoniser la casse des args MCP / le drift `image`↔`media` / compléter le CRUD (`get_*`).
- OAuth par utilisateur + sous-domaine `mcp.contentos.ch` (déjà en backlog).
