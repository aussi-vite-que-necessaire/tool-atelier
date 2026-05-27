import type { Job } from 'bullmq';
import { createId } from '@/lib/db/id';
import { createImageAsset } from '@/lib/db/repositories/image-assets';
import { createMedia, getMedia } from '@/lib/db/repositories/media';
import { getPost, updatePost } from '@/lib/db/repositories/posts';
import { getVisualTemplate } from '@/lib/db/repositories/visual-templates';
import { getMediaEngine } from '@/lib/media-engine';
import type { RenderVisualJob, RenderVisualResult } from '@/lib/queue/client';
import { buildBrandContext } from '@/lib/visual-templates/brand';
import { compileTemplate } from '@/lib/visual-templates/compile';
import {
  fillVarDefaults,
  parseVariablesSchema,
  variablesSchemaToZod,
} from '@/lib/visual-templates/dsl';

// Image grise affichée à la place d'une var image non fournie (preview back-office).
const IMAGE_PLACEHOLDER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="100%" height="100%" fill="#e5e5e5"/></svg>',
)}`;

export function makeProcessRenderVisual(_deps?: unknown) {
  return async function processRenderVisual(
    job: Job<RenderVisualJob>,
  ): Promise<RenderVisualResult> {
    const { userId, templateId, vars, mode, postId, jobKey } = job.data;

    const template = await getVisualTemplate(userId, templateId);
    if (!template) {
      throw new Error(`VisualTemplate ${templateId} not found for user ${userId}`);
    }

    const brand = await buildBrandContext(userId);

    const schema = parseVariablesSchema(template.variablesSchema);
    const validated = variablesSchemaToZod(schema, {
      imagesOptional: mode === 'preview',
    }).parse(vars) as Record<string, unknown>;

    // Résoudre les variables image (mediaId) en URL publique (assetKey) directement.
    // En preview sans image réelle → placeholder.
    const context: Record<string, unknown> = fillVarDefaults(schema, validated);
    for (const spec of schema) {
      if (spec.type !== 'image') continue;
      const mediaId =
        typeof validated[spec.name] === 'string' ? (validated[spec.name] as string) : '';
      let url = mode === 'preview' ? IMAGE_PLACEHOLDER : '';
      if (mediaId) {
        const m = await getMedia(userId, mediaId);
        if (m) url = m.assetKey; // assetKey = URL publique engine
      }
      context[spec.name] = url;
    }

    const html = compileTemplate({ template, vars: context, brand });
    const engine = getMediaEngine();
    const obj = await engine.renderHtml({
      html,
      width: template.width,
      height: template.height,
    });

    if (mode === 'preview') {
      // Aperçu : on retourne directement l'URL engine, sans écriture DB.
      return {
        mode: 'preview',
        previewKey: `visual-previews/${userId}/${jobKey}.png`,
        url: obj.url,
        width: template.width,
        height: template.height,
      };
    }

    // mode === 'final'
    const toGallery = job.data.destination === 'gallery';
    if (!toGallery && !postId) throw new Error('postId required for mode=final');
    if (!toGallery && postId) {
      const post = await getPost(userId, postId);
      if (!post) throw new Error(`Post ${postId} not found for user ${userId}`);
    }

    const mediaId = createId();
    await createMedia(
      userId,
      {
        kind: 'image',
        assetKey: obj.url,
        previewKey: obj.id,
        width: template.width,
        height: template.height,
      },
      mediaId,
    );
    await createImageAsset(userId, {
      mediaId,
      source: toGallery ? 'standalone' : 'template',
      templateSlug: template.slug,
      vars: validated,
    });
    if (!toGallery && postId) await updatePost(userId, postId, { mediaId });

    return {
      mode: 'final',
      mediaId,
      url: obj.url,
      width: template.width,
      height: template.height,
    };
  };
}
