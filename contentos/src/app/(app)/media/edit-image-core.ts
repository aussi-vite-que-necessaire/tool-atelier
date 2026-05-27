import { getMedia } from '@/lib/db/repositories/media';

export async function editImageGuard(
  userId: string,
  input: { mediaId: string; prompt: string },
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!input.prompt.trim()) return { ok: false, message: 'Prompt requis' };
  const m = await getMedia(userId, input.mediaId);
  if (!m) return { ok: false, message: 'Image introuvable' };
  return { ok: true };
}
