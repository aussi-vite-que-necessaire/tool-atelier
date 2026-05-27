import { getMediaEngine, type MediaObject } from '@/lib/media-engine';

export function composeImagePrompt(prompt: string, stylePrompt?: string | null): string {
  const s = stylePrompt?.trim();
  return s ? `${prompt}\n\nStyle : ${s}` : prompt;
}

export async function generateImage(opts: {
  prompt: string;
  aspectRatio: string;
  stylePrompt?: string | null;
}): Promise<MediaObject> {
  return getMediaEngine().generate({
    prompt: opts.prompt,
    aspectRatio: opts.aspectRatio,
    stylePrompt: opts.stylePrompt,
  });
}

export async function editImage(opts: { sourceId: string; prompt: string }): Promise<MediaObject> {
  return getMediaEngine().edit({ sourceId: opts.sourceId, prompt: opts.prompt });
}
