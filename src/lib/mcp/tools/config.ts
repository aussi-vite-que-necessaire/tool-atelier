import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createPublicationFormat,
  deletePublicationFormat,
  listPublicationFormats,
  updatePublicationFormat,
} from '@/lib/db/repositories/publication-formats';
import { handle } from '../register';

export const configImpl = {
  listPublicationFormats: (userId: string) => listPublicationFormats(userId),
  createPublicationFormat: (
    userId: string,
    input: {
      name: string;
      platform: string;
      structure: string;
      visualIntent?: string;
      writingRules?: string;
    },
  ) => createPublicationFormat(userId, input),
  updatePublicationFormat: (
    userId: string,
    input: {
      id: string;
      name?: string;
      platform?: string;
      structure?: string;
      visualIntent?: string;
      writingRules?: string;
    },
  ) => updatePublicationFormat(userId, input.id, input),
  deletePublicationFormat: async (userId: string, input: { id: string }) => {
    await deletePublicationFormat(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerConfigTools(server: McpServer): void {
  server.registerTool(
    'list_publication_formats',
    {
      title: 'Lister les formats de publication',
      description: 'Formats de publication du compte (structure, intention visuelle, cosmétique).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => configImpl.listPublicationFormats(u)),
  );
  server.registerTool(
    'create_publication_format',
    {
      title: 'Créer un format de publication',
      description: 'Crée un format de publication.',
      inputSchema: {
        name: z.string(),
        platform: z.string(),
        structure: z.string(),
        visualIntent: z.string().optional(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.createPublicationFormat(u, input)),
  );
  server.registerTool(
    'update_publication_format',
    {
      title: 'Modifier un format de publication',
      description: 'Met à jour un format de publication.',
      inputSchema: {
        id: z.string(),
        name: z.string().optional(),
        platform: z.string().optional(),
        structure: z.string().optional(),
        visualIntent: z.string().optional(),
        writingRules: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => configImpl.updatePublicationFormat(u, input)),
  );
  server.registerTool(
    'delete_publication_format',
    {
      title: 'Supprimer un format de publication',
      description: 'Supprime un format de publication.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => configImpl.deletePublicationFormat(u, input)),
  );
}
