// Mappe le kind média (service media) vers le type d'asset LinkedIn.
export function toLinkedInMediaKind(kind: string | null): 'image' | 'document' | 'video' {
  if (kind === 'pdf') return 'document';
  if (kind === 'video') return 'video';
  return 'image';
}
