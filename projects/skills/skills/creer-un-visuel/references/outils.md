# Outils MCP `media` — référence rapide

Liste plate des outils exposés par le serveur MCP `media` (nom logique).

## Images

- `generate_image(prompt, aspect_ratio?, tags?, style_id?)` — génère une image depuis un texte.
- `edit_image(parent_id, prompt, tags?)` — variante d'une image existante.
- `render_html(html, tags?)` — rend un HTML/CSS complet en image (pas de templating).
- `render_template(id, variables, tags?)` — instancie un visual-template.
- `list_images(tags?, search?)` / `get_image(id)` / `delete_image(id)`.

## Templates visuels

- `list_visual_templates()` / `get_visual_template(id)`.
- `create_visual_template(...)` / `update_visual_template(...)` / `delete_visual_template(id)`.

## Styles de génération

- `list_visual_styles()`.
- `create_visual_style(...)` / `update_visual_style(...)` / `delete_visual_style(id)`.

## Chartes graphiques

- `list_style_guides()` / `get_style_guide(id)`.
- `create_style_guide(...)` / `update_style_guide(...)` / `delete_style_guide(id)`.

## Marque

- `get_brand()` / `update_brand(...)`.

## PDF

- `create_pdf(images=[id...])`.
