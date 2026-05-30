import { describe, expect, it } from 'vitest';
import { listToolsResponse } from '@/lib/mcp/internal';
import { tools } from '@/lib/mcp/registry';

// L'endpoint MCP in-app sert TOUS les outils enregistrés (cast + media +
// ressources) via un registre unique. Ce test verrouille la cohérence du
// catalogue exposé : aucun domaine perdu, chaque entrée a un schéma.
describe('catalogue de l’endpoint MCP in-app', () => {
  const payload = listToolsResponse();

  it('expose exactement les outils du registre (aucun perdu)', () => {
    expect(payload.tools.length).toBe(tools.length);
    const exposed = new Set(payload.tools.map((t) => t.name));
    for (const t of tools) expect(exposed.has(t.name), `manquant: ${t.name}`).toBe(true);
  });

  it('couvre les trois domaines de la suite + le ping', () => {
    const names = new Set(payload.tools.map((t) => t.name));
    // cast
    expect(names.has('create_post')).toBe(true);
    expect(names.has('publish_post_now')).toBe(true);
    // media
    expect(names.has('generate_image')).toBe(true);
    expect(names.has('render_template')).toBe(true);
    // ressources
    expect(names.has('create_resource')).toBe(true);
    expect(names.has('tracking_link')).toBe(true);
    // sonde de connexion
    expect(names.has('ping')).toBe(true);
  });

  it('chaque entrée porte un inputSchema JSON Schema', () => {
    for (const t of payload.tools) {
      expect(typeof t.inputSchema).toBe('object');
      expect((t.inputSchema as { type?: string }).type).toBe('object');
    }
  });
});
