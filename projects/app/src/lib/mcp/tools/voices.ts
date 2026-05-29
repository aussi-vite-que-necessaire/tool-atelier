import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { createVoice, deleteVoice, listVoices, updateVoice } from '@/lib/db/repositories/voice';
import { handle } from '../register';

export const voiceImpl = {
  list: (userId: string) => listVoices(userId),
  create: (userId: string, input: { name: string; content: string }) => createVoice(userId, input),
  update: (userId: string, input: { id: string; name?: string; content?: string }) =>
    updateVoice(userId, input.id, { name: input.name, content: input.content }),
  remove: async (userId: string, input: { id: string }) => {
    await deleteVoice(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerVoiceTools(server: McpServer): void {
  server.registerTool(
    'list_voices',
    { title: 'Lister les voix', description: 'Voix éditoriales du compte.', inputSchema: {} },
    (_i, extra) => handle(extra, (u) => voiceImpl.list(u)),
  );
  server.registerTool(
    'create_voice',
    {
      title: 'Créer une voix',
      description: 'Crée une voix éditoriale (nom + contenu).',
      inputSchema: { name: z.string(), content: z.string() },
    },
    (input, extra) => handle(extra, (u) => voiceImpl.create(u, input)),
  );
  server.registerTool(
    'update_voice',
    {
      title: 'Modifier une voix',
      description: 'Met à jour une voix éditoriale.',
      inputSchema: { id: z.string(), name: z.string().optional(), content: z.string().optional() },
    },
    (input, extra) => handle(extra, (u) => voiceImpl.update(u, input)),
  );
  server.registerTool(
    'delete_voice',
    {
      title: 'Supprimer une voix',
      description: 'Supprime une voix.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (u) => voiceImpl.remove(u, input)),
  );
}
