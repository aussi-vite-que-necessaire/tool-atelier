# Bras visuel du skill content-os-redaction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rapatrier le skill `content-os-redaction` dans `content-os-v2/skills/` et l'étendre d'un bras visuel qui propose, produit et attache le visuel d'accompagnement d'un post LinkedIn.

**Architecture:** Skill-only (aucun code applicatif modifié). Le skill porte la méthode ; la marque (templates/styles visuels) vit dans ContentOS et est lue via MCP. Nouveau dossier de bricks `visuel/` à trois fichiers, branché depuis `SKILL.md` après le push du draft. Suppression de l'ancien repo `content-os-skills` en fin de course.

**Tech Stack:** Markdown (skill Claude), connecteur MCP ContentOS (tools déjà exposés : `generate_image`, `list_gallery_images`, `render_visual`, `attach_media_to_post`, `list_visual_templates`, `get_visual_template`, `list_visual_styles`, `edit_image`, `detach_media`).

**Vérification (pas de TDD code) :** chaque brique est vérifiée sur deux critères — (1) **neutralité de marque** : aucun nom de couleur, police, ou spécificité AVQN ; remplaçable pour un autre auteur sans réécriture ; (2) **exactitude des tools** : chaque tool cité existe avec la signature réelle (`src/lib/mcp/tools/media.ts`, `src/lib/mcp/tools/visuals.ts`). Plus une relecture finale : aucun cadrage par contraste (état cible uniquement).

---

## File Structure

- Create: `skills/content-os-redaction/SKILL.md` (rapatrié puis modifié)
- Create: `skills/content-os-redaction/production/*.md` (rapatriés tels quels, 5 fichiers)
- Create: `skills/content-os-redaction/relecture/*.md` (rapatriés tels quels, 3 fichiers)
- Create: `skills/content-os-redaction/visuel/proposer-le-visuel.md`
- Create: `skills/content-os-redaction/visuel/choisir-template-et-remplir.md`
- Create: `skills/content-os-redaction/visuel/produire-et-attacher.md`
- Create: `skills/README.md`

---

## Task 1 : Rapatrier le skill existant

**Files:**
- Create: `skills/content-os-redaction/` (copie de `/Users/ManuAVQN/Code/content-os-skills/content-os-redaction/`, sans `.DS_Store`)

- [ ] **Step 1 : Copier le dossier du skill (hors .DS_Store)**

```bash
mkdir -p skills
cp -R /Users/ManuAVQN/Code/content-os-skills/content-os-redaction skills/content-os-redaction
find skills/content-os-redaction -name '.DS_Store' -delete
```

- [ ] **Step 2 : Vérifier l'arborescence rapatriée**

Run: `find skills/content-os-redaction -type f | sort`
Expected (9 fichiers) :
```
skills/content-os-redaction/SKILL.md
skills/content-os-redaction/production/architecturer-narration.md
skills/content-os-redaction/production/choisir-angle.md
skills/content-os-redaction/production/choisir-hook.md
skills/content-os-redaction/production/creuser-sujet.md
skills/content-os-redaction/production/mettre-en-forme-linkedin.md
skills/content-os-redaction/relecture/relire-logique.md
skills/content-os-redaction/relecture/relire-tension-narrative.md
skills/content-os-redaction/relecture/relire-voix.md
```

- [ ] **Step 3 : Vérifier que le frontmatter du SKILL.md est intact**

Run: `head -4 skills/content-os-redaction/SKILL.md`
Expected : un frontmatter YAML valide avec `name: content-os-redaction` et une `description:`.

- [ ] **Step 4 : Commit**

```bash
git add skills/content-os-redaction
git commit -m "$(cat <<'EOF'
🤖 chore(spec-23): rapatrie le skill content-os-redaction dans le repo plateforme

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2 : README du dossier skills/

**Files:**
- Create: `skills/README.md`

- [ ] **Step 1 : Écrire `skills/README.md`**

```markdown
# Skills ContentOS

Skills agents pour ContentOS. Chaque skill est un cerveau éditorial ou métier conçu pour fonctionner avec la plateforme via son connecteur MCP. Le code des skills est versionné ici ; à l'exécution, le skill est installé dans le chat de l'utilisateur et reste le cerveau qui pilote la plateforme par-dessus les tools.

## content-os-redaction

**Rôle.** Produit, réécrit et relit du contenu éditorial signé Manu — posts LinkedIn, emails, pages, messages — et accompagne le post LinkedIn de son visuel. Le skill porte la méthode ; l'état (idées, voix, writing-templates, templates et styles visuels) vit dans ContentOS et est lu via MCP.

**Prérequis.** Le connecteur MCP ContentOS doit être configuré et actif. Sans lui, le skill peut raisonner mais ne peut ni lire l'état, ni pousser de draft, ni produire de visuel.

**Voix, formats, marque visuelle.** La voix de Manu, les writing-templates (post-thèse LinkedIn…), les visual-templates et visual-styles vivent comme entités dans ContentOS. Ils sont seedés côté plateforme avant la première utilisation :
- `npm run seed:redaction -- <email>` — voix + writing-templates.
- `npm run seed:visual -- <email>` — templates de marque visuels.

**Installer comme skill Claude.** Pointer le répertoire `skills/content-os-redaction/` comme skill (point d'entrée `SKILL.md`) : symlink dans `~/.claude/skills/`, ou via la config Claude Code. Les tools MCP se chargent au démarrage de la session, pas à chaud.

## Frontière méthode / état

Le skill porte uniquement la méthode générique — applicable à tout auteur, tout format. Aucune information spécifique à Manu, à un format, ou à une marque visuelle. Ces spécificités vivent dans ContentOS sous forme d'entités (`voice`, `writing-template`, `visual-template`, `visual-style`) chargées dynamiquement via MCP. Cette frontière permet de faire évoluer voix, formats et marque sans toucher au skill, et de le réutiliser pour d'autres auteurs.
```

- [ ] **Step 2 : Vérifier les commandes de seed**

Run: `grep -E '"seed:(redaction|visual)"' package.json`
Expected : les deux scripts existent. Les usages dans le README (`-- <email>`) doivent matcher (`scripts/seed-redaction.ts` et `scripts/seed-visual.ts` lisent `process.argv[2]`).

- [ ] **Step 3 : Commit**

```bash
git add skills/README.md
git commit -m "$(cat <<'EOF'
🤖 docs(spec-23): README du dossier skills (rôle, prérequis, install, seed)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3 : Brique `visuel/proposer-le-visuel.md`

**Files:**
- Create: `skills/content-os-redaction/visuel/proposer-le-visuel.md`

- [ ] **Step 1 : Écrire la brique**

```markdown
# proposer-le-visuel

Une fois le draft texte validé et poussé, ouvrir la conversation visuelle. Proposer un visuel et accompagner le choix — ne jamais décider seul de ne rien mettre, ni livrer un visuel sans validation.

## Principe

Sur LinkedIn, un visuel pertinent augmente l'arrêt sur image et la portée. Un visuel décoratif, qui répète le texte sans rien ajouter, dilue le message. Cette brique sert à dire franchement si un visuel renforce ce post précis, et à proposer des directions concrètes que Manu tranche.

## Quand un visuel renforce

Un visuel sert le plus quand il porte une idée que le texte ne porte pas mieux seul :

- un **chiffre frappant** (résultat, gain, proportion) ;
- une **affirmation-manifeste** (une phrase-thèse isolée) ;
- la **capture d'un concept** (un schéma, une commande, un avant/après) ;
- une **illustration** qui plante une scène ou une ambiance.

Si le post se suffit en texte, le dire — et laisser Manu décider quand même.

## Proposer, pas exécuter

Formuler une ou deux directions concrètes, pas une question ouverte. Chaque direction combine deux axes :

- **Habillage** :
  - (a) **carte de marque texte** — un template texte porte le message (registres « big number », « manifeste », « commande »…).
  - (b) **template + image** — un template dont une zone image reçoit une image.
  - (c) **image nue** — une image attachée directement, sans template.
- **Source de l'image** (pour b et c) : **générer** une nouvelle image, ou **réutiliser** une image existante de la galerie.

Le choix du registre s'appuie sur les `label` des templates réellement disponibles (`list_visual_templates`), pas sur une liste figée. Formuler comme une intention : « Je verrais bien une carte "big number" avec le chiffre X », « Une image générée façon Y en pleine largeur », « On pourrait réutiliser l'image Z de la galerie », « Ce template, avec une image qui exprime W, et ce texte ».

## Sortie

La direction retenue par Manu (habillage + source + texte éventuel). Enchaîner sur `choisir-template-et-remplir.md` (habillages a/b), puis `produire-et-attacher.md`.
```

- [ ] **Step 2 : Vérifier neutralité + tools**

Run: `grep -nE 'list_visual_templates' skills/content-os-redaction/visuel/proposer-le-visuel.md`
Expected : le seul tool cité est `list_visual_templates` (existe dans `visuals.ts`). Relire : aucune couleur/police/spécificité AVQN ; aucun « désormais / au lieu de / contrairement à ».

- [ ] **Step 3 : Commit**

```bash
git add skills/content-os-redaction/visuel/proposer-le-visuel.md
git commit -m "$(cat <<'EOF'
🤖 feat(spec-23): brique visuel/proposer-le-visuel (proposition accompagnée)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4 : Brique `visuel/choisir-template-et-remplir.md`

**Files:**
- Create: `skills/content-os-redaction/visuel/choisir-template-et-remplir.md`

- [ ] **Step 1 : Écrire la brique**

```markdown
# choisir-template-et-remplir

Pour les habillages qui utilisent un template de marque (carte texte, ou template + image), choisir le template et préparer ses variables. Brique sautée pour l'image nue.

## Choisir le template

`list_visual_templates` → choisir celui dont le `label` colle à l'intention validée. En cas de doute entre deux, montrer les options à Manu.

`get_visual_template(id)` → lire les **specs de variables** : pour chaque variable, son `name`, `label`, `type` (`string` ou `image`), ses bornes `min`/`max`, sa `description` et `optional`. Le `sampleVars` renvoyé donne un exemple calibré du registre attendu.

## Remplir les variables

Remplir chaque variable depuis le contenu du post :

- respecter le `type` : texte court pour `string`, `mediaId` pour `image` ;
- respecter les bornes `min`/`max` (un texte trop long est tronqué au rendu) ;
- suivre la `description` de la variable — elle dit ce que le format attend (« court et frappant : un chiffre + son unité ») ;
- les variables `optional` se remplissent si elles renforcent, se laissent vides sinon.

Les variables `image` reçoivent un `mediaId`, obtenu à l'étape `produire-et-attacher.md` (génération ou galerie). Ne pas inventer de `mediaId`.

## Règle de frontière

Si la `description` d'une variable contredit une intuition de forme, la `description` du template l'emporte : elle connaît le format. Le skill ne réécrit pas les contraintes du template.

## Sortie

Le `templateId` choisi + le dictionnaire de variables `string` prêtes. Les variables `image` restent à compléter avec le `mediaId` produit à l'étape suivante.
```

- [ ] **Step 2 : Vérifier neutralité + tools**

Run: `grep -nE 'list_visual_templates|get_visual_template' skills/content-os-redaction/visuel/choisir-template-et-remplir.md`
Expected : `list_visual_templates` et `get_visual_template` cités, tous deux exposés (`visuals.ts`). `get_visual_template` renvoie bien `variableSpecs` (avec `name`/`label`/`type`/`min`/`max`/`description`/`optional`) + `sampleVars` (`visualImpl.getTemplate`). Relire : pas de spécificité de marque ; pas de cadrage par contraste.

- [ ] **Step 3 : Commit**

```bash
git add skills/content-os-redaction/visuel/choisir-template-et-remplir.md
git commit -m "$(cat <<'EOF'
🤖 feat(spec-23): brique visuel/choisir-template-et-remplir

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5 : Brique `visuel/produire-et-attacher.md`

**Files:**
- Create: `skills/content-os-redaction/visuel/produire-et-attacher.md`

- [ ] **Step 1 : Écrire la brique**

```markdown
# produire-et-attacher

Produire l'image si besoin, rendre le visuel et l'attacher au post. Le `postId` vient de `create_post` (étape 4 du SKILL).

## Obtenir le mediaId de l'image (habillages b et c)

Deux sources :

- **Générer** : `list_visual_styles` pour choisir un style cohérent (chaque style porte un `id` et un `prompt` de rendu) → `generate_image(prompt, aspectRatio, styleId)`. Le `prompt` décrit la scène ; le style porte le rendu. Récupérer le `mediaId` renvoyé.
- **Réutiliser** : `list_gallery_images` → reprendre le `mediaId` d'une image existante.

Pour retoucher une image plutôt que repartir de zéro : `edit_image(sourceMediaId, prompt)`.

## Rendre et attacher selon l'habillage

- (a) **carte texte** : `render_visual(templateId, vars, postId)` — rend le template et l'attache au post.
- (b) **template + image** : injecter le `mediaId` dans la variable `image` du template, puis `render_visual(templateId, vars, postId)`.
- (c) **image nue** : `attach_media_to_post(postId, mediaId)`.

`render_visual` attache lui-même son résultat ; `attach_media_to_post` attache une image directement. Un post porte un seul visuel : `detach_media(postId)` avant d'en attacher un autre si on remplace.

## Principes de forme visuelle LinkedIn

Valables pour tout visuel, indépendamment du template :

- **Format portrait 4:5 (1080×1350)** : il occupe le plus de hauteur dans le feed mobile. Défaut pour une image générée si rien n'impose un autre ratio.
- **Une seule idée par visuel** : pas de paragraphe dans une image. Si le message demande plusieurs idées, c'est le signe qu'il faut plusieurs visuels ou rester en texte.
- **Lisible au pouce** : texte large, contraste fort, peu de mots.
- **Cohérent avec le ton du post** : le visuel prolonge la voix, il ne la contredit pas.

## Validation

Montrer le visuel rendu à Manu avant de considérer le post fini. S'il ajuste, reprendre à l'étape concernée (autre template, autre image, variables retouchées).
```

- [ ] **Step 2 : Vérifier neutralité + tools**

Run: `grep -noE 'generate_image|list_gallery_images|list_visual_styles|render_visual|attach_media_to_post|detach_media|edit_image' skills/content-os-redaction/visuel/produire-et-attacher.md | sort -t: -k2 -u`
Expected : tous les tools cités existent avec ces signatures (`media.ts`) :
- `generate_image(prompt, aspectRatio?, styleId?)`
- `list_gallery_images()` → `mediaId` + url
- `render_visual(templateId, vars, postId)` (rend + attache)
- `attach_media_to_post(postId, mediaId)`
- `detach_media(postId)`
- `edit_image(sourceMediaId, prompt)`
- `list_visual_styles()` → `id` + `name` + `prompt` (`visuals.ts`)

Relire : pas de spécificité de marque ; pas de cadrage par contraste.

- [ ] **Step 3 : Commit**

```bash
git add skills/content-os-redaction/visuel/produire-et-attacher.md
git commit -m "$(cat <<'EOF'
🤖 feat(spec-23): brique visuel/produire-et-attacher (tools + forme LinkedIn)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6 : Brancher le bras visuel dans SKILL.md

**Files:**
- Modify: `skills/content-os-redaction/SKILL.md`

- [ ] **Step 1 : Élargir la description du frontmatter**

Remplacer la fin de la ligne `description:` (juste avant la dernière phrase « Utiliser même si… ») en ajoutant une phrase sur le visuel. La description finit ainsi :

> … dès lors que le texte est censé sortir sous le nom de Manu. Couvre aussi la production du visuel d'accompagnement du post LinkedIn (carte de marque, image générée ou réutilisée).

(Une seule ligne `description:` — concaténer, ne pas créer de saut de ligne dans le frontmatter.)

- [ ] **Step 2 : Ajouter les tools média aux prérequis**

Dans la section « Prérequis : le connecteur ContentOS », remplacer la première phrase par :

```markdown
Ce skill lit et écrit via les tools MCP de ContentOS : `list_ideas`, `list_voices`, `list_writing_templates`, `create_post` (et `get_post`, `edit_post`, `set_post_status` au besoin). Pour le visuel d'accompagnement, il utilise aussi `list_visual_templates`, `get_visual_template`, `list_visual_styles`, `generate_image`, `list_gallery_images`, `render_visual`, `attach_media_to_post` (et `edit_image`, `detach_media` au besoin). Si le connecteur n'est pas disponible, le signaler à Manu avant de produire.
```

- [ ] **Step 3 : Ajouter une ligne de frontière visuelle dans « Principe d'architecture »**

À la fin de la section « Principe d'architecture », ajouter :

```markdown
De même, la spécificité visuelle (couleurs, polices, mise en page, style d'image) vit dans les `visual-template` et `visual-style` de ContentOS, pas dans le skill. Les bricks visuelles restent neutres, paramétrées par le template et le style chargés.
```

- [ ] **Step 4 : Recadrer l'Étape 4 et ajouter l'Étape 5**

Remplacer la section « ### Étape 4 : pousser le draft » (titre + paragraphe) par :

```markdown
### Étape 4 : pousser le draft

`create_post` avec `ideaId`, `content`, `writingTemplateId` (celui chargé) et statut `draft`. Récupérer le `postId` renvoyé — il est requis pour attacher un visuel.

### Étape 5 : le visuel d'accompagnement

Une fois le draft poussé, proposer un visuel et accompagner le choix :

1. `visuel/proposer-le-visuel.md` — ouvrir la conversation, dire si un visuel renforce ce post, proposer des directions concrètes (habillage + source d'image + texte).
2. Si une carte de marque ou un template + image est retenu : `visuel/choisir-template-et-remplir.md`.
3. `visuel/produire-et-attacher.md` — générer ou réutiliser l'image, rendre et attacher.

Toujours proposer ; ne jamais livrer un visuel sans validation dans le chat. Le carousel n'est pas couvert : l'agent ne dispose pas de l'outil pour assembler des slides.

Manu valide, planifie ou publie ensuite le post (texte + visuel) depuis l'UI ContentOS.
```

- [ ] **Step 5 : Vérifier la cohérence du SKILL.md**

Run: `grep -nE 'Étape 4|Étape 5|visuel/|list_visual_templates|postId' skills/content-os-redaction/SKILL.md`
Expected : Étape 4 mentionne le `postId` ; Étape 5 référence les 3 bricks `visuel/…` ; prérequis listent les tools média. Relire la totalité : aucun cadrage par contraste, état cible uniquement.

- [ ] **Step 6 : Vérifier que les bricks référencées existent**

Run: `ls skills/content-os-redaction/visuel/`
Expected : `proposer-le-visuel.md`, `choisir-template-et-remplir.md`, `produire-et-attacher.md`.

- [ ] **Step 7 : Commit**

```bash
git add skills/content-os-redaction/SKILL.md
git commit -m "$(cat <<'EOF'
🤖 feat(spec-23): branche l'étape visuelle dans SKILL.md (prérequis, étape 5, frontière)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7 : Supprimer l'ancien repo content-os-skills

**Préconditions (bloquantes) :** le rapatriement (Tasks 1–6) est mergé sur `main`, et Manu a confirmé la suppression. Action **irréversible** côté GitHub.

- [ ] **Step 1 : Confirmer que tout le contenu est dans content-os-v2**

Run: `diff -r <(cd /Users/ManuAVQN/Code/content-os-skills/content-os-redaction && find . -name '*.md' | sort) <(cd skills/content-os-redaction && find . -name '*.md' ! -path './visuel/*' | sort)`
Expected : aucune différence sur les fichiers rapatriés (les bricks `visuel/` sont en plus, normal).

- [ ] **Step 2 : Supprimer le repo GitHub**

```bash
gh repo delete ManuAVQN/content-os-skills --yes
```

- [ ] **Step 3 : Supprimer le clone local**

```bash
rm -rf /Users/ManuAVQN/Code/content-os-skills
```

- [ ] **Step 4 : Mettre à jour la mémoire persistante**

- `reference_content_os_skills_repo.md` : le skill vit désormais dans `content-os-v2/skills/content-os-redaction/` ; le repo `content-os-skills` n'existe plus.
- `project_direction_os_for_agents.md` : le pilier `content-os-skills` est replié dans le repo plateforme (le skill reste « le cerveau dehors » à l'exécution, son code est versionné avec la plateforme).

---

## Self-Review

**Spec coverage :**
- Frontière méthode/état → Tasks 3-6 (bricks neutres) + ligne de frontière SKILL.md (Task 6 Step 3). ✓
- Ordre pipeline (visuel après create_post) → Task 6 Step 4 (Étape 4 renvoie le postId, Étape 5 ensuite). ✓
- Tools MCP exploités → Tasks 3-5 citent exactement les tools du spec. ✓
- 3 bricks `visuel/` (proposer / choisir-remplir / produire-attacher) → Tasks 3, 4, 5. ✓
- Proposition accompagnée + 2 axes (habillage × source) → Task 3. ✓
- Réutilisation galerie → Tasks 3 et 5 (`list_gallery_images`). ✓
- SKILL.md (prérequis, Étape 5, frontmatter) → Task 6. ✓
- Logistique rapatriement + README → Tasks 1, 2. ✓
- Suppression repo + mise à jour mémoire → Task 7. ✓
- Hors périmètre carousel → noté dans Étape 5 (Task 6). ✓

**Placeholder scan :** aucun TBD/TODO ; chaque brique a son contenu complet ; chaque vérification a sa commande.

**Type consistency :** noms de tools constants entre tâches et conformes à `media.ts`/`visuals.ts` (`generate_image`, `list_gallery_images`, `render_visual(templateId, vars, postId)`, `attach_media_to_post(postId, mediaId)`, `detach_media(postId)`, `edit_image(sourceMediaId, prompt)`, `list_visual_templates`, `get_visual_template`, `list_visual_styles`). Noms de bricks constants entre SKILL.md (Task 6) et les fichiers créés (Tasks 3-5).
