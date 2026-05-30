import { newId } from './ids';
import { extensionForMime, parseImageDimensions } from './image-meta';
import { insertMedia } from './repository';
import { deleteObject, objectKey, publicUrl, putImage } from './storage';
import type { MediaKind, MediaRecord, MediaSource } from './types';

export interface StoreInput {
  userId: string;
  bytes: Uint8Array;
  mimeType: string;
  kind: MediaKind;
  prompt: string | null;
  parent_id: string | null;
  source: MediaSource;
  tags: string[];
  width?: number;
  height?: number;
  template_id?: string | null;
  vars?: Record<string, unknown> | null;
  style_id?: string | null;
}

export async function store(input: StoreInput): Promise<MediaRecord> {
  const id = newId();
  const ext = extensionForMime(input.mimeType);
  const key = objectKey(id, ext);
  await putImage(key, input.bytes, input.mimeType);

  const dims =
    input.width && input.height
      ? { width: input.width, height: input.height }
      : ((input.kind === 'image' || input.kind === 'render'
          ? parseImageDimensions(input.bytes)
          : null) ?? { width: null, height: null });

  const record: MediaRecord = {
    id,
    user_id: input.userId,
    r2_key: key,
    url: publicUrl(key),
    kind: input.kind,
    mime: input.mimeType,
    prompt: input.prompt,
    parent_id: input.parent_id,
    source: input.source,
    template_id: input.template_id ?? null,
    vars: input.vars ?? null,
    style_id: input.style_id ?? null,
    tags: input.tags,
    width: dims.width,
    height: dims.height,
    size_bytes: input.bytes.byteLength,
    created_at: Date.now(),
  };

  try {
    await insertMedia(record);
  } catch (err) {
    await deleteObject(key).catch(() => {});
    throw err;
  }
  return record;
}
