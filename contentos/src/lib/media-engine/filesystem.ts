import { mkdir, readdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { MediaEngine, MediaObject } from './types';

// 1×1 transparent PNG sentinel — mêmes bytes que le stub in-memory
const STUB_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

function stubDir(): string {
  return process.env.MEDIA_STUB_DIR ?? join(tmpdir(), 'content-os-media-stub');
}

function appUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000';
}

function extFromContentType(contentType: string): string {
  if (contentType.includes('jpeg') || contentType.includes('jpg')) return 'jpg';
  if (contentType.includes('gif')) return 'gif';
  if (contentType.includes('webp')) return 'webp';
  if (contentType.includes('svg')) return 'svg';
  return 'png';
}

function contentTypeFromExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'image/png';
  }
}

async function ensureDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export class FilesystemMediaEngine implements MediaEngine {
  private async writeFile(
    ext: string,
    bytes: Buffer,
  ): Promise<{ id: string; filename: string; url: string }> {
    const dir = stubDir();
    await ensureDir(dir);
    const id = crypto.randomUUID();
    const filename = `${id}.${ext}`;
    await writeFile(join(dir, filename), bytes);
    const url = `${appUrl()}/api/media-stub/${filename}`;
    return { id, filename, url };
  }

  private idFromUrl(idOrUrl: string): string {
    // Accepte une URL complète /api/media-stub/<id>.<ext> ou un id bare
    const match = idOrUrl.match(/\/api\/media-stub\/([^/]+)$/);
    if (match) return match[1]!;
    return idOrUrl;
  }

  private async findFile(id: string): Promise<string | null> {
    const dir = stubDir();
    try {
      const entries = await readdir(dir);
      // id peut être un filename complet (avec ext) ou un UUID sans ext
      const found = entries.find((e) => e === id || e.startsWith(`${id}.`));
      return found ? join(dir, found) : null;
    } catch {
      return null;
    }
  }

  async generate(_input: {
    prompt: string;
    aspectRatio: string;
    stylePrompt?: string | null;
  }): Promise<MediaObject> {
    const { id, url } = await this.writeFile('png', STUB_PNG);
    return { id, url, width: 1, height: 1 };
  }

  async edit(input: { sourceId: string; prompt: string }): Promise<MediaObject> {
    const sourcePath = await this.findFile(input.sourceId);
    if (!sourcePath) {
      throw new Error(`FilesystemMediaEngine: source introuvable : ${input.sourceId}`);
    }
    const { id, url } = await this.writeFile('png', STUB_PNG);
    return { id, url, width: 1, height: 1 };
  }

  async renderHtml(input: { html: string; width: number; height: number }): Promise<MediaObject> {
    const { id, url } = await this.writeFile('png', STUB_PNG);
    return { id, url, width: input.width, height: input.height };
  }

  async upload(input: { bytes: Buffer; contentType: string }): Promise<MediaObject> {
    const ext = extFromContentType(input.contentType);
    const { id, url } = await this.writeFile(ext, input.bytes);
    return { id, url, width: null, height: null };
  }

  async download(idOrUrl: string): Promise<Buffer> {
    const fileId = this.idFromUrl(idOrUrl);
    const filePath = await this.findFile(fileId);
    if (!filePath) {
      throw new Error(`FilesystemMediaEngine: objet introuvable : ${fileId}`);
    }
    return readFile(filePath);
  }

  async delete(id: string): Promise<void> {
    const fileId = this.idFromUrl(id);
    const filePath = await this.findFile(fileId);
    if (filePath) {
      await unlink(filePath);
    }
  }
}

export { contentTypeFromExt, extFromContentType, stubDir };
