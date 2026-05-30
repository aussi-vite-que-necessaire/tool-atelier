import { describe, expect, it } from 'vitest';
import { tools, toolsByName } from '@/lib/mcp/registry';

// Le registre MCP capture les tools sans transport. On vérifie que les tools
// ressources sont bien enregistrés, sans collision de nom avec cast/media.
describe('registre MCP — tools ressources', () => {
  it('expose les tools ressources clés', () => {
    for (const name of [
      'list_resources',
      'get_resource',
      'create_resource',
      'update_resource',
      'delete_resource',
      'add_page',
      'add_module',
      'tracking_link',
      'get_resource_stats',
    ]) {
      expect(toolsByName.has(name), `tool manquant: ${name}`).toBe(true);
    }
  });

  it("n'a aucun nom de tool en double", () => {
    const names = tools.map((t) => t.name);
    const dupes = names.filter((n, i) => names.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });
});
