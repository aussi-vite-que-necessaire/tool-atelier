import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { clearPostMedia, setPostMedia } from '@/lib/db/repositories/posts';
import { getMedia } from '@/lib/media/catalog';
import { resolveMediaRef } from '@/lib/media/media-ref';
import { handle } from '../register';

export async function attachMediaTool(
  userId: string,
  input: { postId: string; mediaId?: string; mediaUrl?: string },
) {
  const ref = await resolveMediaRef({ mediaId: input.mediaId, mediaUrl: input.mediaUrl }, (id) =>
    getMedia(userId, id),
  );
  return setPostMedia(userId, input.postId, ref);
}

export async function detachMediaTool(userId: string, input: { postId: string }) {
  await clearPostMedia(userId, input.postId);
  return { detached: true };
}

export function registerMediaTools(server: McpServer): void {
  server.registerTool(
    'attach_media_to_post',
    {
      title: 'Attacher un média à un post',
      description:
        'Attache un média du service `media` (par `media_id`) OU n’importe quelle URL (`media_url`) à un post. Au moins l’un des deux.',
      inputSchema: {
        post_id: z.string().describe('Identifiant du post.'),
        media_id: z.string().optional().describe('Identifiant d’un média du service `media`.'),
        media_url: z
          .string()
          .optional()
          .describe('URL de n’importe quel média (alternative à `media_id`).'),
      },
    },
    (input, extra) =>
      handle(extra, (u) =>
        attachMediaTool(u, {
          postId: input.post_id,
          mediaId: input.media_id,
          mediaUrl: input.media_url,
        }),
      ),
  );
  server.registerTool(
    'detach_media',
    {
      title: 'Détacher le média d’un post',
      description: 'Retire le média attaché à un post.',
      inputSchema: { post_id: z.string().describe('Identifiant du post.') },
    },
    (input, extra) => handle(extra, (u) => detachMediaTool(u, { postId: input.post_id })),
  );
}
