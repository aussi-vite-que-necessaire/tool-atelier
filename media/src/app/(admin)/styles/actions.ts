"use server";

import { revalidatePath } from "next/cache";
import {
  createStyle,
  updateStyle,
  deleteStyle,
} from "@/lib/styles/repository";

export async function createStyleAction(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const prompt = (formData.get("prompt") as string | null)?.trim() ?? "";
  if (name && prompt) {
    await createStyle({ name, prompt });
  }
  revalidatePath("/styles");
}

export async function updateStyleAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null) ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const prompt = (formData.get("prompt") as string | null)?.trim() ?? "";
  if (id) {
    await updateStyle(id, { name, prompt });
  }
  revalidatePath("/styles");
}

export async function deleteStyleAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null) ?? "";
  if (id) {
    await deleteStyle(id);
  }
  revalidatePath("/styles");
}
