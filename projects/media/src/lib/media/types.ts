export type MediaKind = "image" | "video" | "pdf" | "render";
export type MediaSource =
  | "gemini_generate" | "gemini_edit" | "html_render"
  | "template_render" | "upload" | "pdf_aggregate";

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
