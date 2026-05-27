"use server";

import { revalidatePath } from "next/cache";
import { getMediaRecord, deleteMediaRow } from "@/lib/media/repository";
import { deleteObject } from "@/lib/storage";
import { store } from "@/lib/store";
import { validateUpload } from "@/lib/media/validate-upload";

export async function uploadAction(formData: FormData): Promise<void> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validateUpload(file.type, bytes.byteLength);
  if (!result.ok) throw new Error(result.error);

  await store({
    bytes,
    mimeType: file.type,
    kind: result.kind,
    prompt: null,
    parent_id: null,
    source: "upload",
    tags: [],
  });

  revalidatePath("/gallery");
}

export async function deleteMediaAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null) ?? "";
  if (!id) return;

  const rec = await getMediaRecord(id);
  if (rec) {
    await deleteMediaRow(id);
    await deleteObject(rec.r2_key);
  }

  revalidatePath("/gallery");
}
