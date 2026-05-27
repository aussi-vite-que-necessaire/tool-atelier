export type MediaObject = {
  id: string;
  url: string;
  width: number | null;
  height: number | null;
};

export interface MediaEngine {
  generate(input: {
    prompt: string;
    aspectRatio: string;
    stylePrompt?: string | null;
  }): Promise<MediaObject>;
  edit(input: { sourceId: string; prompt: string }): Promise<MediaObject>;
  renderHtml(input: { html: string; width: number; height: number }): Promise<MediaObject>;
  upload(input: { bytes: Buffer; contentType: string }): Promise<MediaObject>;
  download(idOrUrl: string): Promise<Buffer>;
  delete(id: string): Promise<void>;
}
