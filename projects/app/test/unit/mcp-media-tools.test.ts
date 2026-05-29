import { describe, expect, it } from 'vitest';
import { toolsByName } from '@/lib/mcp/registry';

// Le registre MCP capture les tools au chargement du module : ce test verrouille
// que les outils du moteur média in-app sont bien enregistrés (et que la capture
// ne casse pas au boot).
describe('catalogue MCP — outils media', () => {
  const expected = [
    'generate_image',
    'edit_image',
    'render_html',
    'list_images',
    'get_image',
    'delete_image',
    'create_pdf',
    'get_brand',
    'update_brand',
    'list_visual_styles',
    'create_visual_style',
    'update_visual_style',
    'delete_visual_style',
    'list_style_guides',
    'get_style_guide',
    'create_style_guide',
    'update_style_guide',
    'delete_style_guide',
    'list_visual_templates',
    'get_visual_template',
    'create_visual_template',
    'update_visual_template',
    'delete_visual_template',
    'render_template',
    // attache d'un média à un post (déjà présent côté cast)
    'attach_media_to_post',
    'detach_media',
  ];

  it('enregistre tous les outils media attendus', () => {
    for (const name of expected) {
      expect(toolsByName.has(name), `tool manquant: ${name}`).toBe(true);
    }
  });

  it('chaque tool media a une description non vide et un inputSchema', () => {
    for (const name of expected) {
      const tool = toolsByName.get(name)!;
      expect(tool.description.length).toBeGreaterThan(0);
      expect(typeof tool.inputSchema).toBe('object');
    }
  });
});
