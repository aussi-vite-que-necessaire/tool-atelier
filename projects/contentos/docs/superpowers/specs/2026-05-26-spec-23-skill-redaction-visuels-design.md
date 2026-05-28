# Spec 23 — Bras visuel du skill content-os-redaction

## Contexte

Le skill `content-os-redaction` vit dans le repo `content-os-v2`, sous `skills/content-os-redaction/`. Il accompagne l'agent IA sur toute la création d'un post LinkedIn signé Manu : creuser le sujet, choisir l'angle et le hook, architecturer la narration, relire, mettre en forme, pousser le draft via `create_post` — puis **produire et attacher le visuel d'accompagnement**.

La méthode vit dans le skill ; l'état (idées, voix, writing-templates, **templates visuels, styles d'image**) vit dans ContentOS et est lu via le connecteur MCP. Cette frontière reste intacte pour le bras visuel : aucune couleur, police ni mise en page de marque dans le skill — elles vivent dans les `visual-template` et `visual-style` de ContentOS.

## Objectif

Étendre le skill pour qu'après la rédaction d'un post, l'agent **propose** un visuel et **accompagne** Manu dans le choix (habillage + source d'image + texte), le produise via les tools média de ContentOS et l'attache au post — au standard de la marque, sans connaissance de marque codée en dur.

Hors périmètre : le carousel (pas d'outil MCP `create_carousel` exposé aujourd'hui). Le bras visuel couvre le **média simple** : carte de marque texte, template + image, ou image nue — l'image étant générée ou réutilisée depuis la galerie.

## Outils MCP exploités (déjà exposés par la plateforme)

- `list_visual_templates` — les templates de marque (HTML+CSS+variables), avec `label` et `platform`.
- `get_visual_template` — un template + ses specs de variables parsées : pour chaque variable, `name`, `label`, `type` (`string` | `image`), `min`/`max`, `description`, `optional`. Plus `sampleVars` (un exemple calibré).
- `list_visual_styles` — les styles d'image IA (`name` + `prompt`).
- `generate_image` — `prompt`, `aspectRatio?`, `styleId?` → renvoie un `mediaId` + URL.
- `list_gallery_images` — les images déjà produites (`mediaId`, dimensions, URL), pour en réutiliser une.
- `render_visual` — `templateId`, `vars`, `postId` → rend le template en image **et l'attache au post**. Les variables de type `image` se remplissent avec un `mediaId`.
- `attach_media_to_post` — `postId`, `mediaId` → attache une image existante.
- `edit_image` — `sourceMediaId`, `prompt` → variante image-to-image (retouche).

Le `postId` est requis par `render_visual` et `attach_media_to_post` : la phase visuelle s'exécute donc **après** `create_post`.

## Architecture du skill (méthode / état)

Structure de bricks existante : `production/`, `relecture/`. On ajoute un dossier **`visuel/`** à trois bricks, chacune neutre et à responsabilité unique, paramétrée par les templates/styles chargés depuis ContentOS.

### `visuel/proposer-le-visuel.md`
- **Quoi** : une fois le draft validé, ouvrir la conversation visuelle. L'agent **propose** un visuel et **accompagne** le choix — il ne décide pas silencieusement de ne rien mettre. Il formule des directions concrètes que Manu valide ou ajuste : « je pense utiliser ce template… », « je générerais une image comme ça… », « on pourrait réutiliser cette image… », « ce template, avec une image qui exprime ça, et ce texte… ».
- **Raisonnement de valeur** (informe la recommandation, ne la supprime pas) : un visuel sert le plus quand il porte une idée que le texte ne porte pas mieux seul (chiffre frappant, affirmation-manifeste, capture de concept, illustration). L'agent le dit franchement quand un post se suffit en texte, mais laisse le choix à Manu.
- **Deux axes** combinés dans la proposition (le choix s'appuie sur les `label`/`description` des templates listés, pas sur une table codée dans le skill) :
  - **Habillage** : (a) **carte de marque texte** (template texte seul, ex. registres « big number », « manifeste », « commande ») · (b) **template + image** · (c) **image nue** attachée directement.
  - **Source de l'image** (pour b et c) : **générer** (`generate_image`) ou **réutiliser** une image existante (`list_gallery_images`).
- **Sortie** : une ou deux propositions concrètes (habillage + source + texte éventuel), soumises à Manu pour qu'il tranche.

### `visuel/choisir-template-et-remplir.md`
- **Quoi** : pour les registres (a) et (b), choisir le template et préparer ses variables.
- **Comment** : `list_visual_templates` → choisir celui dont le `label` colle au post → `get_visual_template` pour lire les specs → remplir chaque variable depuis le contenu du post en respectant son `type`, ses bornes `min`/`max` et sa `description`. Les variables `optional` se remplissent si elles renforcent, se laissent vides sinon. Les variables `image` reçoivent un `mediaId` (produit à l'étape suivante).
- **Règle de frontière** : si une `description` de variable contredit une intuition du skill, la `description` du template l'emporte (elle connaît le format).

### `visuel/produire-et-attacher.md`
- **Quoi** : l'orchestration des tools + les principes de forme visuelle LinkedIn.
- **Obtenir le `mediaId` de l'image** (pour les habillages b et c) : soit **générer** — `list_visual_styles` pour choisir un style, puis `generate_image(prompt, aspectRatio, styleId)` ; soit **réutiliser** — `list_gallery_images` et reprendre le `mediaId` d'une image existante.
- **Séquences selon l'habillage** :
  - (a) carte texte → `render_visual(templateId, vars, postId)` (rend + attache).
  - (b) template + image → obtenir le `mediaId` (générer ou réutiliser) → l'injecter dans la variable `image` du template → `render_visual(templateId, vars, postId)`.
  - (c) image nue → obtenir le `mediaId` (générer ou réutiliser) → `attach_media_to_post(postId, mediaId)`.
  - retouche éventuelle d'une image → `edit_image(sourceMediaId, prompt)`.
- **Principes de forme LinkedIn** (valables pour tout visuel, portés par le skill) : le format portrait 4:5 (1080×1350) domine le feed mobile ; une seule idée par visuel ; texte lisible au pouce (pas de paragraphe dans une image) ; cohérence avec le ton du post. Les contraintes fines (dimensions exactes, variables) viennent du template.

## SKILL.md — modifications

- **Prérequis** : ajouter les tools média à la liste des tools requis (`list_visual_templates`, `get_visual_template`, `list_visual_styles`, `generate_image`, `render_visual`, `attach_media_to_post`, `edit_image`), en signalant que sans eux l'agent peut rédiger mais pas produire de visuel.
- **Nouvelle « Étape 5 : le visuel d'accompagnement »** après l'étape 4 (push du draft) : `visuel/proposer-le-visuel.md` ouvre la conversation et propose des directions concrètes → une fois Manu décidé, `visuel/choisir-template-et-remplir.md` (habillages a/b) → `visuel/produire-et-attacher.md`. L'agent propose toujours, accompagne le choix, et valide dans le chat avant de finaliser.
- **Description du frontmatter** : élargir pour couvrir l'accompagnement visuel du post (sans changer le déclencheur principal, qui reste la rédaction signée Manu).

## Logistique de rapatriement

1. Copier `content-os-skills/content-os-redaction/` → `content-os-v2/skills/content-os-redaction/` (sans les `.DS_Store`).
2. Créer `content-os-v2/skills/README.md` : rôle du skill, prérequis (connecteur MCP), comment l'installer comme skill Claude (pointer `skills/content-os-redaction/`, point d'entrée `SKILL.md`), frontière méthode/état, et le seed des entités (`npm run seed:redaction`, `npm run seed:visual`).
3. Commit du rapatriement + du bras visuel.
4. Supprimer le repo GitHub `ManuAVQN/content-os-skills` (`gh repo delete`) et le clone local `/Users/ManuAVQN/Code/content-os-skills`. Irréversible côté GitHub — exécuté après confirmation que le contenu est bien dans `content-os-v2`.

## Vérification

Pas de code applicatif modifié : la vérification est éditoriale et structurelle.
- Le skill s'installe et se charge (frontmatter `name`/`description` valides).
- Les bricks `visuel/` (`proposer-le-visuel.md`, `choisir-template-et-remplir.md`, `produire-et-attacher.md`) ne contiennent aucune spécificité de marque (test : remplaçables pour un autre auteur sans rien réécrire).
- Chaque séquence de tools décrite correspond aux signatures réelles exposées par MCP (vérifié contre `src/lib/mcp/tools/media.ts` et `visuals.ts`).
- Relecture finale : aucun cadrage par contraste dans le SKILL.md ni les bricks (état cible uniquement).

## Mémoire à mettre à jour (post-merge)

- `reference_content_os_skills_repo.md` : le skill vit désormais dans `content-os-v2/skills/content-os-redaction/` ; le repo `content-os-skills` n'existe plus.
- `project_direction_os_for_agents.md` : le pilier `content-os-skills` est replié dans le repo plateforme (le skill reste « le cerveau dehors » à l'exécution, mais son code est versionné avec la plateforme).
