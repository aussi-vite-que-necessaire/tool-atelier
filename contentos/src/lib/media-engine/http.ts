import type { MediaEngine, MediaObject } from './types';

function parseMediaObject(data: unknown): MediaObject {
  const d = data as { id: string; url: string; width?: number | null; height?: number | null };
  return {
    id: d.id,
    url: d.url,
    width: d.width ?? null,
    height: d.height ?? null,
  };
}

export class HttpMediaEngine implements MediaEngine {
  constructor(private readonly opts: { baseUrl: string; serviceKey: string }) {}

  private authHeader(): { Authorization: string } {
    return { Authorization: `Bearer ${this.opts.serviceKey}` };
  }

  private async postJson(path: string, body: unknown): Promise<MediaObject> {
    const res = await fetch(`${this.opts.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...this.authHeader() },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MediaEngine ${path} failed ${res.status}: ${text}`);
    }
    return parseMediaObject(await res.json());
  }

  async generate(input: {
    prompt: string;
    aspectRatio: string;
    stylePrompt?: string | null;
  }): Promise<MediaObject> {
    return this.postJson('/v1/generate', input);
  }

  async edit(input: { sourceId: string; prompt: string }): Promise<MediaObject> {
    return this.postJson('/v1/edit', input);
  }

  async renderHtml(input: { html: string; width: number; height: number }): Promise<MediaObject> {
    return this.postJson('/v1/render-html', input);
  }

  async upload(input: { bytes: Buffer; contentType: string }): Promise<MediaObject> {
    const res = await fetch(`${this.opts.baseUrl}/v1/upload`, {
      method: 'POST',
      headers: { 'Content-Type': input.contentType, ...this.authHeader() },
      body: new Uint8Array(input.bytes),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MediaEngine /v1/upload failed ${res.status}: ${text}`);
    }
    return parseMediaObject(await res.json());
  }

  async download(idOrUrl: string): Promise<Buffer> {
    if (!idOrUrl.startsWith('http://') && !idOrUrl.startsWith('https://')) {
      throw new Error(
        `MediaEngine.download attend une URL http(s) complète, reçu : ${idOrUrl}. Les URLs publiques sont retournées par generate/upload/etc.`,
      );
    }
    const res = await fetch(idOrUrl);
    if (!res.ok) {
      throw new Error(`MediaEngine download failed ${res.status}: ${idOrUrl}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(id: string): Promise<void> {
    const res = await fetch(`${this.opts.baseUrl}/v1/object/${id}`, {
      method: 'DELETE',
      headers: this.authHeader(),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`MediaEngine DELETE /v1/object/${id} failed ${res.status}: ${text}`);
    }
  }
}
