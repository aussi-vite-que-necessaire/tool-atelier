# Outils MCP de la suite Contentos

Tous les outils sont servis par l'endpoint MCP unique de la suite (`/api/mcp`). Le `userId` est
résolu côté serveur par la session — tu n'as pas à le passer. Réfère-toi à un outil par son nom
qualifié, p. ex. `contentos:create_post`.

## Sommaire

- [Cast — posts](#cast--posts)
- [Cast — voix](#cast--voix)
- [Cast — formats de publication](#cast--formats-de-publication)
- [Cast — publication](#cast--publication)
- [Media — images & rendus](#media--images--rendus)
- [Media — PDF, marque, styles, chartes, templates](#media--pdf-marque-styles-chartes-templates)
- [Media — attache à un post](#media--attache-à-un-post)
- [Ressources](#ressources)

## Cast — posts

- `list_posts` — tous les posts du compte.
- `get_post` { id } — un post par id.
- `create_post` { title, content } — crée un post rédigé.
- `edit_post` { id, content } — remplace le contenu.
- `delete_post` { id } — supprime.

## Cast — voix

- `list_voices` — voix éditoriales (champ `content` = description du ton).
- `create_voice` { name, content } · `update_voice` { id, name?, content? } · `delete_voice` { id }.

## Cast — formats de publication

- `list_publication_formats` — formats du compte. Chaque format porte :
  `structure` (plan attendu), `visualIntent` (intention de visuel), `writingRules` (cosmétique),
  `platform` (ex. `linkedin`).
- `create_publication_format` / `update_publication_format` / `delete_publication_format`.

## Cast — publication

- `get_linkedin_connection` — état de connexion LinkedIn (+ jours avant expiration).
- `publish_post_now` { postId } — publie maintenant (attend le résultat).
- `schedule_post` { postId, whenIso, tz? } — planifie.
- `cancel_scheduled` { publicationId } · `delete_publication` { publicationId }.
- `list_publications` — planifiées + publiées (calendrier).

## Media — images & rendus

- `generate_image` { prompt, aspect_ratio?, tags?, style_id? } — génère (Gemini) → URL publique.
- `edit_image` { image_id, edit_prompt, tags? } — variante éditée.
- `render_html` { html, width, height, format?, quality?, wait_for?, tags? } — HTML → image.
- `render_template` { template_id, vars } — compile un template puis capture.
- `list_images` { query?, tags?, source?, limit? } · `get_image` { image_id } · `delete_image` { image_id }.

## Media — PDF, marque, styles, chartes, templates

- `create_pdf` { image_ids[] } — assemble des images en PDF (carrousel/document).
- `get_brand` / `update_brand` — identité de marque injectée dans les templates (`{{brand.*}}`).
- Styles : `list_visual_styles` / `create_visual_style` / `update_visual_style` / `delete_visual_style`.
- Chartes : `list_style_guides` / `get_style_guide` / `create_style_guide` / `update_style_guide` / `delete_style_guide`.
- Templates : `list_visual_templates` / `get_visual_template` / `create_visual_template` / `update_visual_template` / `delete_visual_template`.

## Media — attache à un post

- `attach_media_to_post` { post_id, media_id? | media_url? } — attache un média (galerie ou URL).
- `detach_media` { post_id } — retire le média attaché.

## Ressources

- Ressource : `list_resources`, `get_resource` { slug }, `get_outline` { slug },
  `create_resource`, `update_resource`, `delete_resource`.
- Pages : `add_page`, `update_page`, `delete_page`, `move_page`, `reorder_pages`.
- Modules : `add_module`, `add_modules`, `update_module`, `delete_module`, `reorder_modules`.
- Accès : `grant_access` / `revoke_access` (ressource privée).
- Diffusion : `get_resource_stats` { slug?, sinceDays? }, `tracking_link` { slug, source, medium?, campaign?, path? }.
