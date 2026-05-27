import type { MediaEngine, MediaObject } from './types';

// 1×1 transparent PNG (sentinel pour generate/renderHtml)
const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

type Entry = { bytes: Buffer; contentType: string };

export class InMemoryMediaEngine implements MediaEngine {
  private store = new Map<string, Entry>();

  private makeObject(): MediaObject {
    const id = crypto.randomUUID();
    return { id, url: `memory://media/${id}`, width: 1, height: 1 };
  }

  private idFromUrl(idOrUrl: string): string {
    if (idOrUrl.startsWith('memory://media/')) {
      return idOrUrl.slice('memory://media/'.length);
    }
    return idOrUrl;
  }

  async generate(_input: {
    prompt: string;
    aspectRatio: string;
    stylePrompt?: string | null;
  }): Promise<MediaObject> {
    const obj = this.makeObject();
    this.store.set(obj.id, { bytes: STUB_PNG, contentType: 'image/png' });
    return obj;
  }

  async edit(input: { sourceId: string; prompt: string }): Promise<MediaObject> {
    // vérifie que la source existe
    if (!this.store.has(input.sourceId)) {
      throw new Error(`InMemoryMediaEngine: source introuvable : ${input.sourceId}`);
    }
    const obj = this.makeObject();
    this.store.set(obj.id, { bytes: STUB_PNG, contentType: 'image/png' });
    return obj;
  }

  async renderHtml(_input: { html: string; width: number; height: number }): Promise<MediaObject> {
    const obj = this.makeObject();
    this.store.set(obj.id, { bytes: STUB_PNG, contentType: 'image/png' });
    return obj;
  }

  async upload(input: { bytes: Buffer; contentType: string }): Promise<MediaObject> {
    const obj = this.makeObject();
    this.store.set(obj.id, { bytes: input.bytes, contentType: input.contentType });
    return obj;
  }

  async download(idOrUrl: string): Promise<Buffer> {
    const id = this.idFromUrl(idOrUrl);
    const entry = this.store.get(id);
    if (!entry) {
      throw new Error(`InMemoryMediaEngine: objet introuvable : ${id}`);
    }
    return entry.bytes;
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
