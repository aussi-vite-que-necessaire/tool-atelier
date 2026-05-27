import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createIdea, deleteIdea, listIdeas, updateIdea } from '@/lib/db/repositories/ideas';
import { handle } from '../register';

export const ideaImpl = {
  list: (userId: string) => listIdeas(userId),
  create: (userId: string, input: { idea: string; brief?: string }) => createIdea(userId, input),
  update: (userId: string, input: { id: string; idea?: string; brief?: string }) =>
    updateIdea(userId, input.id, { idea: input.idea, brief: input.brief }),
  remove: async (userId: string, input: { id: string }) => {
    await deleteIdea(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerIdeaTools(server: McpServer): void {
  server.registerTool(
    'list_ideas',
    { title: 'Lister les idées', description: 'Toutes les idées du compte.', inputSchema: {} },
    (_input, extra) => handle(extra, (userId) => ideaImpl.list(userId)),
  );
  server.registerTool(
    'create_idea',
    {
      title: 'Créer une idée',
      description: 'Crée une idée (titre + brief optionnel).',
      inputSchema: { idea: z.string(), brief: z.string().optional() },
    },
    (input, extra) => handle(extra, (userId) => ideaImpl.create(userId, input)),
  );
  server.registerTool(
    'update_idea',
    {
      title: 'Modifier une idée',
      description: 'Met à jour le titre et/ou le brief d’une idée.',
      inputSchema: { id: z.string(), idea: z.string().optional(), brief: z.string().optional() },
    },
    (input, extra) => handle(extra, (userId) => ideaImpl.update(userId, input)),
  );
  server.registerTool(
    'delete_idea',
    {
      title: 'Supprimer une idée',
      description: 'Supprime une idée.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (userId) => ideaImpl.remove(userId, input)),
  );
}
