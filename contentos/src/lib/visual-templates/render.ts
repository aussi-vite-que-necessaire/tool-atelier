import { getMediaEngine, type MediaObject } from '@/lib/media-engine';

export type RenderInput = {
  html: string;
  width: number;
  height: number;
};

export async function renderHtmlToPng(opts: RenderInput): Promise<MediaObject> {
  return getMediaEngine().renderHtml({ html: opts.html, width: opts.width, height: opts.height });
}

// Aucune ressource navigateur à fermer avec le MediaEngine.
export async function closeRenderer(): Promise<void> {}
