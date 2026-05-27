import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createStyleGuide,
  deleteStyleGuide,
  getStyleGuide,
  listStyleGuides,
  updateStyleGuide,
} from '@/lib/db/repositories/style-guides';
import { listVisualTemplatesByStyleGuide } from '@/lib/db/repositories/visual-templates';
import { handle } from '../register';

export const styleGuideImpl = {
  list: (userId: string) => listStyleGuides(userId),
  get: async (userId: string, input: { id: string }) => {
    const guide = await getStyleGuide(userId, input.id);
    if (!guide) throw new Error('Style guide introuvable');
    const templates = await listVisualTemplatesByStyleGuide(userId, guide.id);
    return {
      ...guide,
      templates: templates.map((t) => ({ id: t.id, label: t.label, slug: t.slug })),
    };
  },
  create: (userId: string, input: { name: string; content: string }) =>
    createStyleGuide(userId, input),
  update: (userId: string, input: { id: string; name?: string; content?: string }) =>
    updateStyleGuide(userId, input.id, { name: input.name, content: input.content }),
  delete: async (userId: string, input: { id: string }) => {
    await deleteStyleGuide(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerStyleGuideTools(server: McpServer): void {
  server.registerTool(
    'list_style_guides',
    {
      title: 'Lister les style guides',
      description: 'Style guides (langue visuelle : palette, typos, exemples).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => styleGuideImpl.list(u)),
  );
  server.registerTool(
    'get_style_guide',
    {
      title: 'Détails d’un style guide',
      description:
        'Renvoie un style guide (markdown) + la liste légère de ses templates rattachés (id, label, slug). Charger un exemple via get_visual_template.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.get(u, input)),
  );
  server.registerTool(
    'create_style_guide',
    {
      title: 'Créer un style guide',
      description:
        'Crée un style guide (name + content markdown : palette, typos avec URLs/@font-face, exemples, conventions).',
      inputSchema: { name: z.string(), content: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.create(u, input)),
  );
  server.registerTool(
    'update_style_guide',
    {
      title: 'Modifier un style guide',
      description: 'Met à jour un style guide.',
      inputSchema: { id: z.string(), name: z.string().optional(), content: z.string().optional() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.update(u, input)),
  );
  server.registerTool(
    'delete_style_guide',
    {
      title: 'Supprimer un style guide',
      description: 'Supprime un style guide.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => styleGuideImpl.delete(u, input)),
  );
}
