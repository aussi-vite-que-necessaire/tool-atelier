import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  createPost,
  deletePost,
  getPost,
  listPosts,
  updatePost,
} from '@/lib/db/repositories/posts';
import { handle } from '../register';

export const postImpl = {
  list: (userId: string) => listPosts(userId),
  get: (userId: string, input: { id: string }) => getPost(userId, input.id),
  create: (
    userId: string,
    input: {
      title: string;
      content: string;
    },
  ) => createPost(userId, input),
  edit: (userId: string, input: { id: string; content: string }) =>
    updatePost(userId, input.id, { content: input.content }),
  remove: async (userId: string, input: { id: string }) => {
    await deletePost(userId, input.id);
    return { deleted: input.id };
  },
};

export function registerPostTools(server: McpServer): void {
  server.registerTool(
    'list_posts',
    { title: 'Lister les posts', description: 'Tous les posts du compte.', inputSchema: {} },
    (_input, extra) => handle(extra, (userId) => postImpl.list(userId)),
  );
  server.registerTool(
    'get_post',
    { title: 'Récupérer un post', description: 'Un post par id.', inputSchema: { id: z.string() } },
    (input, extra) => handle(extra, (userId) => postImpl.get(userId, input)),
  );
  server.registerTool(
    'create_post',
    {
      title: 'Créer un post',
      description: 'Crée un post rédigé.',
      inputSchema: {
        title: z.string(),
        content: z.string(),
      },
    },
    (input, extra) => handle(extra, (userId) => postImpl.create(userId, input)),
  );
  server.registerTool(
    'edit_post',
    {
      title: 'Éditer un post',
      description: 'Remplace le contenu d’un post.',
      inputSchema: { id: z.string(), content: z.string() },
    },
    (input, extra) => handle(extra, (userId) => postImpl.edit(userId, input)),
  );
  server.registerTool(
    'delete_post',
    {
      title: 'Supprimer un post',
      description: 'Supprime un post.',
      inputSchema: { id: z.string() },
    },
    (input, extra) => handle(extra, (userId) => postImpl.remove(userId, input)),
  );
}
