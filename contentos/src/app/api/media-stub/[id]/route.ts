import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { contentTypeFromExt, stubDir } from '@/lib/media-engine/filesystem';

/**
 * Sert les fichiers du FilesystemMediaEngine (stub E2E).
 * L'URL `/api/media-stub/<id>.<ext>` est retournée par FilesystemMediaEngine.generate/upload/etc.
 * et doit être chargeable par un vrai navigateur dans les tests Playwright.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  // Évite path traversal
  if (id.includes('..') || id.includes('/')) {
    return new Response('Invalid id', { status: 400 });
  }

  const dir = stubDir();
  const filePath = join(dir, id);

  try {
    const bytes = await readFile(filePath);
    const ext = id.includes('.') ? id.split('.').pop()! : 'png';
    const contentType = contentTypeFromExt(ext);

    return new Response(new Uint8Array(bytes), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
