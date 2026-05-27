import { newId } from "./ids";
import { extensionForMime, parseImageDimensions } from "./image-meta";
import { objectKey, publicUrl, putImage, deleteObject } from "./storage";
import { insertImage } from "./images/repository";
import type { ImageRecord, ImageSource } from "./images/types";

export interface StoreInput {
  bytes: Uint8Array;
  mimeType: string;
  prompt: string | null;
  parent_id: string | null;
  source: ImageSource;
  tags: string[];
  width?: number;
  height?: number;
}

// Upload R2 + insertion de la ligne images + résolution des dimensions.
// Source unique de vérité des écritures, partagée par les outils MCP et l'API /v1.
export async function store(input: StoreInput): Promise<ImageRecord> {
  const id = newId();
  const ext = extensionForMime(input.mimeType);
  const key = objectKey(id, ext);

  await putImage(key, input.bytes, input.mimeType);

  const dims =
    input.width && input.height
      ? { width: input.width, height: input.height }
      : parseImageDimensions(input.bytes) ?? { width: null, height: null };

  const record: ImageRecord = {
    id,
    r2_key: key,
    url: publicUrl(key),
    prompt: input.prompt,
    parent_id: input.parent_id,
    source: input.source,
    tags: input.tags,
    width: dims.width,
    height: dims.height,
    created_at: Date.now(),
  };

  try {
    await insertImage(record);
  } catch (err) {
    await deleteObject(key).catch(() => {}); // compensation : pas d'objet orphelin
    throw err;
  }
  return record;
}
