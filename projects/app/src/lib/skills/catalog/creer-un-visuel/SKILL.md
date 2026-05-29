---
name: creer-un-visuel
description: >
  Crée, édite ou rend un visuel (image, carte de marque, PDF) sur le service media de l'atelier,
  via le MCP media. À déclencher dès qu'on veut produire ou retoucher une image pour un post,
  un document, une slide, une page — quel que soit le format (générée depuis un prompt, rendue
  depuis un HTML, instanciée depuis un template visuel, ou éditée depuis une image existante).
  Couvre aussi la construction d'un PDF par agrégation d'images. Nécessite le MCP media connecté.
---

# Créer un visuel (media)

Tu pilotes le service **media** (`https://media.contentos.ch`) via son MCP pour produire un visuel.
Le service stocke images, PDF, templates visuels (Handlebars), styles de génération et chartes
graphiques ; tu accèdes au tout via une douzaine d'outils MCP. Tu **ne touches jamais** au code
du projet `media` lui-même.

## Prérequis — vérifier le MCP

Avant tout, appelle `list_images` (ou `list_visual_templates`) pour vérifier que le MCP `media`
répond.

- Il répond → continue.
- Absent ou en erreur → **arrête-toi** et demande à l'utilisateur de connecter le MCP `media`.
  Sans lui, ce skill ne peut rien faire.

## Comment choisir le bon outil

| Tu veux… | Outil principal | Note |
|---|---|---|
| Une image à partir d'un prompt texte | `generate_image` | Optionnel : `style_id` (cf. `list_visual_styles`), `aspect_ratio`, `tags`. |
| Une variante d'une image existante (retoucher, recadrer, changer le ton) | `edit_image` | Donne l'`id` de la source ; elle est conservée, la variante est nouvelle. |
| Rendre un HTML complet en image | `render_html` | HTML autonome (`<link>` polices, CSS inline ou CDN). Aucun templating côté serveur. |
| Instancier un visual-template (carte de marque, citation, illustration) | `render_template` | Voir `list_visual_templates` puis `get_visual_template` pour le schéma des variables. |
| Construire un PDF en agrégeant des images | `create_pdf` | Donne la liste ordonnée d'`id` d'images. |
| Retrouver une image par tag, prompt ou source | `list_images` puis `get_image` | Pose toujours des `tags` au moment de la création. |
| Supprimer une image | `delete_image` | Sur l'`id`. |

Pour les templates, styles, chartes : `list_visual_templates`, `list_visual_styles`,
`list_style_guides`, `get_brand`. Les modifications de marque visuelle (création de template,
style, charte, brand) sont possibles via les outils `create_…` / `update_…` correspondants ; ne
les déclenche que sur demande explicite (la marque est un actif partagé).

## Conventions

- **Réutilise l'URL** retournée par `generate_image` / `edit_image` / `render_html` /
  `render_template` telle quelle (Outline, LinkedIn, slides, MD). Ne re-télécharge pas l'image.
- **Tags au moment de la création** : `["linkedin", "tech-debt"]`, `["cours", "intro"]`, etc.
  Sans tags, l'image est introuvable après coup.
- **`render_html`** attend un HTML complet et autonome. Pas de variables, pas de templating.
- **`render_template`** attend des variables typées : récupère le schéma via
  `get_visual_template(id)` avant de l'appeler.

## Trois mini-recettes

### 1) Une image carrée pour LinkedIn, dans le ton de la marque

```
list_visual_styles            // repère le style cohérent avec le message
generate_image(prompt="...", aspect_ratio="1:1", style_id="<id>", tags=["linkedin","<thème>"])
```

→ tu obtiens une `url` directement utilisable.

### 2) Refaire une variante d'un visuel existant

```
list_images(tags=["linkedin","<thème>"])   // ou search par prompt
edit_image(parent_id="<id>", prompt="Variante plus claire, sans le texte du bas")
```

→ la source reste intacte, la variante a son propre `id` + `url`.

### 3) Instancier un template de marque (carte citation)

```
list_visual_templates            // repère le template
get_visual_template(id="<id>")   // récupère le schéma des variables
render_template(id="<id>", variables={ quote: "...", author: "...", aspect_ratio: "1:1" })
```

→ image rendue depuis le template + style du moment.

## Frontière méthode / état

Ce skill porte la **méthode** : comment choisir le bon outil, comment composer un prompt,
comment éviter de réinventer un visuel qui existe déjà. La **spécificité visuelle** (couleurs,
polices, templates, styles, charte) vit dans le service `media` comme entités versionnées. On
ne hard-code rien ici.

## Et la suite ?

Pour un post LinkedIn signé Manu, ce skill produit le visuel ; la rédaction se fait via le skill
`content-os-redaction` (qui appelle ensuite `attach_media_to_post` sur le `id` du media). Voir le
méta-skill `suite-avqn` pour les workflows croisés.
