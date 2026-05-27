import { randomUUID } from 'node:crypto';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { attachExistingMediaCore } from '@/app/(app)/posts/[id]/media-actions-core';
import { listStandaloneImages } from '@/lib/db/repositories/image-assets';
import { updatePost } from '@/lib/db/repositories/posts';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { awaitJobResult } from '@/lib/queue/await-job';
import type { GenerateImageResult, RenderVisualResult } from '@/lib/queue/client';
import { enqueueGenerateImage, enqueueRenderVisual } from '@/lib/queue/enqueue';
import { parseVariablesSchema, variablesSchemaToZod } from '@/lib/visual-templates/dsl';
import { handle } from '../register';

type ImageRun = (jobKey: string) => Promise<GenerateImageResult>;
type RenderRun = (jobKey: string) => Promise<RenderVisualResult>;

export async function listGalleryImagesTool(userId: string) {
  const rows = await listStandaloneImages(userId);
  return rows.map(({ media }) => ({
    mediaId: media.id,
    width: media.width,
    height: media.height,
    url: media.assetKey,
  }));
}

export async function generateImageTool(
  userId: string,
  input: { prompt: string; aspectRatio?: string; styleId?: string },
  run?: ImageRun,
): Promise<GenerateImageResult> {
  const jobKey = randomUUID();
  const exec: ImageRun =
    run ??
    (async (key) => {
      await enqueueGenerateImage({
        userId,
        prompt: input.prompt,
        aspectRatio: input.aspectRatio,
        styleId: input.styleId,
        jobKey: key,
      });
      return awaitJobResult<GenerateImageResult>('generate-image', key);
    });
  return exec(jobKey);
}

export async function editImageTool(
  userId: string,
  input: { sourceMediaId: string; prompt: string },
  run?: ImageRun,
): Promise<GenerateImageResult> {
  const jobKey = randomUUID();
  const exec: ImageRun =
    run ??
    (async (key) => {
      await enqueueGenerateImage({
        userId,
        prompt: input.prompt,
        sourceMediaId: input.sourceMediaId,
        jobKey: key,
      });
      return awaitJobResult<GenerateImageResult>('generate-image', key);
    });
  return exec(jobKey);
}

export async function renderVisualTool(
  userId: string,
  input: { templateId: string; vars: Record<string, unknown>; postId: string },
  run?: RenderRun,
): Promise<RenderVisualResult> {
  const template = await getVisualTemplate(userId, input.templateId);
  if (!template) throw new Error('Template visuel introuvable');
  variablesSchemaToZod(parseVariablesSchema(template.variablesSchema), {
    imagesOptional: false,
  }).parse(input.vars);

  const jobKey = randomUUID();
  const exec: RenderRun =
    run ??
    (async (key) => {
      await enqueueRenderVisual({
        userId,
        templateId: input.templateId,
        vars: input.vars,
        mode: 'final',
        postId: input.postId,
        jobKey: key,
      });
      return awaitJobResult<RenderVisualResult>('render-visual', key);
    });
  return exec(jobKey);
}

export async function attachMediaTool(userId: string, input: { postId: string; mediaId: string }) {
  const r = await attachExistingMediaCore(userId, input.postId, input.mediaId);
  if (r.status === 'error') throw new Error(r.message);
  return { attached: input.mediaId, postId: input.postId };
}

export async function detachMediaTool(userId: string, input: { postId: string }) {
  await updatePost(userId, input.postId, { mediaId: null });
  return { detached: true, postId: input.postId };
}

export function registerMediaTools(server: McpServer): void {
  server.registerTool(
    'list_gallery_images',
    {
      title: 'Lister les images',
      description: 'Images de la galerie (URLs signées).',
      inputSchema: {},
    },
    (_i, extra) => handle(extra, (u) => listGalleryImagesTool(u)),
  );
  server.registerTool(
    'generate_image',
    {
      title: 'Générer une image',
      description: 'Génère une image IA (attend le résultat).',
      inputSchema: {
        prompt: z.string(),
        aspectRatio: z.string().optional(),
        styleId: z.string().optional(),
      },
    },
    (input, extra) => handle(extra, (u) => generateImageTool(u, input)),
  );
  server.registerTool(
    'edit_image',
    {
      title: 'Éditer une image (IA)',
      description: 'Édite une image existante via un prompt (image-to-image).',
      inputSchema: { sourceMediaId: z.string(), prompt: z.string() },
    },
    (input, extra) => handle(extra, (u) => editImageTool(u, input)),
  );
  server.registerTool(
    'render_visual',
    {
      title: 'Rendre un visuel depuis un template',
      description:
        'Rend un template visuel en image (attend le résultat) et l’attache au post indiqué. Les variables de type image se remplissent avec un mediaId (via generate_image ou list_gallery_images).',
      inputSchema: {
        templateId: z.string(),
        vars: z.record(z.string(), z.unknown()),
        postId: z.string(),
      },
    },
    (input, extra) => handle(extra, (u) => renderVisualTool(u, input)),
  );
  server.registerTool(
    'attach_media_to_post',
    {
      title: 'Attacher un visuel à un post',
      description: 'Attache une image existante à un post.',
      inputSchema: { postId: z.string(), mediaId: z.string() },
    },
    (input, extra) => handle(extra, (u) => attachMediaTool(u, input)),
  );
  server.registerTool(
    'detach_media',
    {
      title: 'Détacher le visuel d’un post',
      description: 'Retire le visuel attaché à un post.',
      inputSchema: { postId: z.string() },
    },
    (input, extra) => handle(extra, (u) => detachMediaTool(u, input)),
  );
}
