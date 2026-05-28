"use server";

import { revalidatePath } from "next/cache";
import {
  createGuide,
  updateGuide,
  deleteGuide,
} from "@/lib/style-guides/repository";

export async function createGuideAction(formData: FormData): Promise<void> {
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (name && content) {
    await createGuide({ name, content });
  }
  revalidatePath("/style-guides");
}

export async function updateGuideAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null) ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (id) {
    await updateGuide(id, { name, content });
  }
  revalidatePath("/style-guides");
}

export async function deleteGuideAction(formData: FormData): Promise<void> {
  const id = (formData.get("id") as string | null) ?? "";
  if (id) {
    await deleteGuide(id);
  }
  revalidatePath("/style-guides");
}
