"use server";

import { revalidatePath } from "next/cache";
import { aggregatePdf } from "@/lib/pdf/aggregate";
import { requireUserId } from "@/lib/session";

export type ComposePdfResult =
  | { ok: true; id: string; url: string }
  | { ok: false; error: string };

// Tags saisis séparés par des virgules → liste normalisée (trim, sans vide, dédupliquée).
function normalizeTags(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const tag = part.trim();
    if (tag) seen.add(tag);
  }
  return [...seen];
}

export async function composePdfAction(
  imageIds: string[],
  tagsRaw: string,
): Promise<ComposePdfResult> {
  if (!Array.isArray(imageIds) || imageIds.length === 0) {
    return { ok: false, error: "Sélectionne au moins une image." };
  }
  const userId = await requireUserId();

  try {
    const rec = await aggregatePdf(userId, imageIds, normalizeTags(tagsRaw));
    revalidatePath("/gallery");
    return { ok: true, id: rec.id, url: rec.url };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Échec de la construction du PDF." };
  }
}
