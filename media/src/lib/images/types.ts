export type ImageSource = "gemini_generate" | "gemini_edit" | "html_render" | "upload";

export interface ImageRecord {
  id: string;
  r2_key: string;
  url: string;
  prompt: string | null;
  parent_id: string | null;
  source: ImageSource;
  tags: string[];
  width: number | null;
  height: number | null;
  created_at: number; // unix ms
}
