export type MediaKind = 'image' | 'video' | 'pdf';
export type MediaSource =
  | 'gemini_generate'
  | 'gemini_edit'
  | 'html_render'
  | 'template_render'
  | 'upload'
  | 'pdf_aggregate';

export interface MediaRecord {
  id: string;
  user_id: string;
  r2_key: string;
  url: string;
  kind: MediaKind;
  mime: string;
  prompt: string | null;
  parent_id: string | null;
  source: MediaSource;
  template_id: string | null;
  vars: Record<string, unknown> | null;
  style_id: string | null;
  tags: string[];
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: number; // unix ms
}

// Déduit le kind d'un média depuis l'extension de son URL (défaut image).
export function kindFromUrl(url: string): MediaKind {
  const clean = url.split('?')[0]!.toLowerCase();
  if (/\.(mp4|mov|webm)$/.test(clean)) return 'video';
  if (/\.pdf$/.test(clean)) return 'pdf';
  return 'image';
}

// Déduit le type de média à partir du MIME (uploads). Inconnu → image.
export function kindForMime(mime: string): MediaKind {
  if (mime.startsWith('video/')) return 'video';
  if (mime === 'application/pdf') return 'pdf';
  return 'image';
}
