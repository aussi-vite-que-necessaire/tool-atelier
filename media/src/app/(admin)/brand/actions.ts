"use server";

import { revalidatePath } from "next/cache";
import { upsertBrand } from "@/lib/brand/repository";

export async function saveBrandAction(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const signature = (formData.get("signature") as string | null)?.trim() ?? "";
  const logoUrl = (formData.get("logoUrl") as string | null)?.trim() || null;
  await upsertBrand({ name, signature, logoUrl });
  revalidatePath("/brand");
}
