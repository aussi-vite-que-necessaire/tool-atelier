import type { MediaItem } from './catalog';
import { type MediaKind, kindFromUrl } from './types';

// Référence d'attache d'un média à un post (colonnes media* du post).
export type MediaRef = {
  media_id: string | null;
  media_url: string;
  media_kind: MediaKind;
  media_width: number | null;
  media_height: number | null;
};

// Résout une attache agnostique : par id (résolu via le catalogue) OU par URL directe.
export async function resolveMediaRef(
  input: { mediaId?: string; mediaUrl?: string },
  getMedia: (id: string) => Promise<MediaItem | null>,
): Promise<MediaRef> {
  if (input.mediaId) {
    const m = await getMedia(input.mediaId);
    if (!m) throw new Error(`Média introuvable: ${input.mediaId}`);
    return {
      media_id: m.id,
      media_url: m.url,
      media_kind: m.kind,
      media_width: m.width,
      media_height: m.height,
    };
  }
  if (input.mediaUrl) {
    return {
      media_id: null,
      media_url: input.mediaUrl,
      media_kind: kindFromUrl(input.mediaUrl),
      media_width: null,
      media_height: null,
    };
  }
  throw new Error('media_id ou media_url requis');
}
