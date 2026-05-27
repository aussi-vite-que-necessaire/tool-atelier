import { describe, expect, test, vi } from 'vitest';
import { createMedia } from '@/lib/db/repositories/media';
import { createPost, getPost } from '@/lib/db/repositories/posts';
import { createVisualTemplate } from '@/lib/db/repositories/visual-templates';
import {
  attachMediaTool,
  detachMediaTool,
  generateImageTool,
  renderVisualTool,
} from '@/lib/mcp/tools/media';
import { createTestUser } from './helpers/seed';

const TEMPLATE = {
  slug: 'render-mcp',
  label: 'R',
  platform: 'linkedin',
  width: 1080,
  height: 1080,
  bodyHtml: '<div>{{titre}}</div>',
  css: 'div{}',
  variablesSchema: [{ name: 'titre', label: 'Titre', type: 'string', max: 120 }],
  sampleVars: { titre: 'Exemple' },
};

describe('mcp tools — médias', () => {
  test('attach puis detach', async () => {
    const userId = await createTestUser('mcpmedia');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    const media = await createMedia(userId, {
      kind: 'image',
      assetKey: `media/${userId}/x.png`,
      previewKey: `media/${userId}/x.png`,
      width: 100,
      height: 100,
    });

    await attachMediaTool(userId, { postId: post.id, mediaId: media.id });
    expect((await getPost(userId, post.id))?.mediaId).toBe(media.id);

    await detachMediaTool(userId, { postId: post.id });
    expect((await getPost(userId, post.id))?.mediaId).toBeNull();
  });

  test('attach échoue si image introuvable', async () => {
    const userId = await createTestUser('mcpmedia2');
    const post = await createPost(userId, { title: 'T', content: 'c' });
    await expect(attachMediaTool(userId, { postId: post.id, mediaId: 'nope' })).rejects.toThrow(
      /introuvable/,
    );
  });

  test('generate_image : runner injecté → renvoie le résultat', async () => {
    const userId = await createTestUser('mcpgenimg');
    const run = vi.fn().mockResolvedValue({ mediaId: 'm1', url: 'http://x', width: 1, height: 1 });
    const r = await generateImageTool(userId, { prompt: 'chat' }, run);
    expect(r.mediaId).toBe('m1');
    expect(run).toHaveBeenCalledOnce();
  });

  test('render_visual : vars invalides → throw, runner non appelé', async () => {
    const userId = await createTestUser('mcprenderbad');
    const tpl = await createVisualTemplate(userId, TEMPLATE);
    const run = vi.fn();
    await expect(
      renderVisualTool(userId, { templateId: tpl!.id, vars: {}, postId: 'p' }, run),
    ).rejects.toThrow();
    expect(run).not.toHaveBeenCalled();
  });

  test('render_visual : vars valides + runner injecté → renvoie le résultat', async () => {
    const userId = await createTestUser('mcprenderok');
    const tpl = await createVisualTemplate(userId, TEMPLATE);
    const run = vi.fn().mockResolvedValue({
      mode: 'final',
      mediaId: 'm2',
      url: 'http://y',
      width: 1,
      height: 1,
    });
    const r = await renderVisualTool(
      userId,
      { templateId: tpl!.id, vars: { titre: 'Salut' }, postId: 'p' },
      run,
    );
    expect(r.mode).toBe('final');
    if (r.mode === 'final') expect(r.mediaId).toBe('m2');
    expect(run).toHaveBeenCalledOnce();
  });
});
