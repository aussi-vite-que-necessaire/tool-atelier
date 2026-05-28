---
name: content-os-redaction
description: Rédige, réécrit ou relit du contenu éditorial signé Emmanuel "Manu" Bernard (AVQN) — posts LinkedIn, emails, pages, messages — en s'appuyant sur l'état stocké dans ContentOS. Déclencher quand l'utilisateur dit "écris ça comme moi", "dans mon ton", "réécris dans ma voix", "fais-moi un post sur X", colle un brouillon à mettre au propre, ou veut produire un contenu à partir d'une idée de ContentOS. Utiliser même si "ton" ou "voix" n'est pas prononcé, dès lors que le texte est censé sortir sous le nom de Manu. Couvre aussi la production du visuel d'accompagnement du post LinkedIn (carte de marque, image générée ou réutilisée).
---

# content-os-redaction

Produit du contenu éditorial signé Manu. Le skill porte la **méthode** (creuser, choisir l'angle et le hook, architecturer, relire, mettre en forme, puis accompagner d'un visuel). L'**état** vit dans ContentOS : les idées, la voix, les templates d'écriture et la marque visuelle sont lus via MCP, et le résultat y est reposé.

## Prérequis : le connecteur ContentOS

Ce skill lit et écrit via les tools MCP de ContentOS : `list_ideas`, `list_voices`, `list_writing_templates`, `create_post` (et `get_post`, `edit_post`, `set_post_status` au besoin). Pour le visuel d'accompagnement, il utilise aussi `list_visual_templates`, `get_visual_template`, `list_visual_styles`, `list_style_guides`, `get_style_guide`, `generate_image`, `list_gallery_images`, `render_visual`, `attach_media_to_post` (et `edit_image`, `detach_media` au besoin). Si le connecteur n'est pas disponible, le signaler à Manu avant de produire.

## Principe d'architecture

Briques modulaires, chacune fait une seule chose. La **spécificité de format** (architecture d'un post-thèse, mécaniques de hook valides, règle de chute, longueur) ne vit pas dans le skill : elle est portée par le `writing-template` correspondant dans ContentOS. Les briques restent neutres et sont paramétrées par le template chargé.

De même, la spécificité visuelle (couleurs, polices, mise en page, style d'image) vit dans les `visual-template` et `visual-style` de ContentOS, pas dans le skill. Les briques visuelles restent neutres, paramétrées par le template et le style chargés.

## Comment utiliser ce skill

### Étape 1 : l'idée et son brief

Identifier l'idée à traiter. Si elle vient de ContentOS, la charger via `list_ideas`. Le brief est requis pour produire : s'il manque, appliquer `production/creuser-sujet.md` ou demander la matière à Manu.

### Étape 2 : charger la voix et le template

- `list_voices` → la voix de Manu. Elle reste en arrière-plan pendant toute la production et toutes les relectures.
- `list_writing_templates` → le template du type de contenu visé (ex. « Post-thèse LinkedIn »). Le template porte l'architecture, les mécaniques de hook valides, la règle de chute, la longueur et un exemple calibré. Si le type n'est pas clair, le demander brièvement à Manu.

### Étape 3 : dérouler la séquence (paramétrée par le template)

1. `production/creuser-sujet.md` — si le brief est mince.
2. `production/choisir-angle.md` — proposer 3-5 angles, argumenter le plus fort.
3. `production/choisir-hook.md` — avec les mécaniques que le template déclare valides.
4. `production/architecturer-narration.md` — selon l'architecture du template.
5. Rédiger en s'appuyant sur la voix chargée.
6. `relecture/relire-tension-narrative.md`, puis `relecture/relire-voix.md`, puis `relecture/relire-logique.md`.
7. `production/mettre-en-forme-linkedin.md`.

Soumettre à Manu pour validation **dans le chat** à chaque étape charnière. Ne pas livrer un post entier d'un coup sans validation intermédiaire — c'est l'erreur qui produit du texte « bien écrit mais pas lui ».

### Étape 4 : pousser le draft

`create_post` avec `title` (le sujet du post — repris de l'idée ou formulé depuis l'angle retenu), `content` et statut `draft`. Récupérer le `postId` renvoyé — il est requis pour attacher un visuel.

### Étape 5 : le visuel d'accompagnement

Une fois le draft poussé, proposer un visuel et accompagner le choix :

1. `visuel/proposer-le-visuel.md` — ouvrir la conversation, dire si un visuel renforce ce post, proposer des directions concrètes (habillage + source d'image + texte).
2. Si une carte de marque ou un template + image est retenu : `visuel/choisir-template-et-remplir.md`. Si aucun template existant ne convient et qu'il faut en créer un, lire d'abord le style guide pertinent (`list_style_guides` → `get_style_guide`) pour en respecter la palette, les typos et les conventions.
3. `visuel/produire-et-attacher.md` — générer ou réutiliser l'image, rendre et attacher.

Toujours proposer ; ne jamais livrer un visuel sans validation dans le chat. Le carousel n'est pas couvert : l'agent ne dispose pas de l'outil pour assembler des slides.

Manu valide, planifie ou publie ensuite le post (texte + visuel) depuis l'UI ContentOS.

## Règle de l'interlocuteur (prioritaire)

Le curseur tutoiement/vouvoiement et le niveau d'affect bougent selon **à qui** Manu parle, surtout en email et WhatsApp. Si le destinataire n'est pas identifiable depuis le contexte, demander avant d'écrire. Par défaut : vouvoiement, registre pro.

## Ne jamais se citer soi-même

Les noms de concepts du skill (« staccato creux », « fil de tension », « contrat de lecture ») servent au raisonnement, pas à la production. Les reformuler en mots vivants au moment d'écrire.

## En cas de doute

- **Quel template ?** Si le type n'est pas clair, demander brièvement.
- **Règle de brique vs règle de template ?** Le template l'emporte (il connaît le format).
- **Situation pas couverte ?** Appliquer la voix seule, vouvoiement par défaut, anti-hype, pas de jargon, et signaler à Manu que la situation mériterait un nouveau template ou une nouvelle brique.
