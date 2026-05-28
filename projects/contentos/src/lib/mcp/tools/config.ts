import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getSettings } from '@/lib/db/repositories/settings';
import {
  createWritingTemplate,
  deleteWritingTemplate,
  listWritingTemplates,
  updateWritingTemplate,
} from '@/lib/db/repositories/writing-templates';
import { handle } from '../register';

export const configImpl = {
  getSettings: (userId: string) => getSettings(userId),
  listWritingTemplates: (userId: string) => listWritingTemplates(userId),
  createWritingTemplate: (
    userId: string,
    input: {
      name: string;
      platform: string;
      structure: string;
      writingRules?: string;
    },
  ) => createWritingTemplate(userId, input),
  updateWritingTemplate: (
    userId: string,
    input: {
      id: string;
      name?: string;
      platform?: string;
      structure?: string;
      writingRules?: string;
    },
  ) => updateWritingTemplate(userId, input.id, input),
  deleteWritingTemplate: async (userId: string, input: { id: string }) => {
    await deleteWritingTemplate(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerConfigTools(server: McpServer): void {
  server.registerTool(
    'get_settings',
    { title: 'Lire les réglages', description: 'Réglages du compte.', inputSchema: {} },
    (_i, extra) => handle(extra, (u) => configImpl.getSettings(u)),
  );
  server.registerTool(
    'list_writing_templates',
    {
      title: 'Lister les templates d’écriture',
      description: 'Templates d’écriture.',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => configImpl.listWritingTemplates(u)),
  );
  server.registerTool(
    'create_writing_template',
    {
      title: 'Créer un template d’écriture',
      description: 'Crée un template d’écriture.',
      inputSchema: {
        name: z.string(),
        platform: z.string(),
        structure: z.string(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.createWritingTemplate(u, input)),
  );
  server.registerTool(
    'update_writing_template',
    {
      title: 'Modifier un template d’écriture',
      description: 'Met à jour un template d’écriture.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        platform: z.string().optional(),
        structure: z.string().optional(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.updateWritingTemplate(u, input)),
  );
  server.registerTool(
    'delete_writing_template',
    {
      title: 'Supprimer un template d’écriture',
      description: 'Supprime un template d’écriture.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => configImpl.deleteWritingTemplate(u, input)),
  );
}
