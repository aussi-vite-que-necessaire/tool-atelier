'use server';

import { revalidatePath } from 'next/cache';
import { requireUserId } from '@/lib/auth/session';
import { getMedia, listMedia, type MediaItem } from '@/lib/media-catalog/client';
import type { MediaKind } from '@/lib/media-catalog/kind';
import { clearPostMedia, setPostMedia } from '@/lib/db/repositories/posts';
import { resolveMediaRef } from '@/lib/media-link/resolve';
import { mediaRefFromCreatedMedia } from '@/lib/media-link/embed';

type SearchResult = { items: MediaItem[]; total: number; limit: number; offset: number };

export async function searchMediaAction(params: {
  q?: string;
  kind?: string;
  tag?: string;
  orientation?: string;
  limit?: number;
  offset?: number;
}): Promise<SearchResult> {
  const userId = await requireUserId();
  return listMedia(userId, {
    q: params.q,
    kind: params.kind ? (params.kind as MediaKind) : undefined,
    tag: params.tag,
    orientation: params.orientation
      ? (params.orientation as 'landscape' | 'portrait' | 'square')
      : undefined,
    limit: params.limit,
    offset: params.offset,
  });
}

export async function attachMediaAction(
  postId: string,
  mediaId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  try {
    const ref = await resolveMediaRef({ mediaId }, (id) => getMedia(userId, id));
    await setPostMedia(userId, postId, ref);
    revalidatePath(`/posts/${postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

// Attache un média fraîchement créé depuis la page /embed de media (iframe), à
// partir du descripteur transmis par postMessage. On construit le MediaRef
// directement depuis le payload (validé), sans round-trip /v1 : indépendant du
// userId/environnement (en preview, l'iframe prod authentifie un autre user qu'un
// re-resolve par id ne retrouverait pas). Confiance équivalente à l'attache par URL.
export async function attachCreatedMediaAction(
  postId: string,
  media: unknown,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  const ref = mediaRefFromCreatedMedia(media);
  if (!ref) return { status: 'error', message: 'Média créé invalide.' };
  try {
    await setPostMedia(userId, postId, ref);
    revalidatePath(`/posts/${postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}

export async function detachMediaAction(
  postId: string,
): Promise<{ status: 'success' } | { status: 'error'; message: string }> {
  const userId = await requireUserId();
  try {
    await clearPostMedia(userId, postId);
    revalidatePath(`/posts/${postId}`);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: e instanceof Error ? e.message : String(e) };
  }
}
