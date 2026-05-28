"use server";

import { revalidatePath } from "next/cache";
import {
  createGuide,
  updateGuide,
  deleteGuide,
} from "@/lib/style-guides/repository";
import { requireUserId } from "@/lib/session";

export async function createGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (name && content) {
    await createGuide(userId, { name, content });
  }
  revalidatePath("/style-guides");
}

export async function updateGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get("id") as string | null) ?? "";
  const name = (formData.get("name") as string | null)?.trim() ?? "";
  const content = (formData.get("content") as string | null)?.trim() ?? "";
  if (id) {
    await updateGuide(userId, id, { name, content });
  }
  revalidatePath("/style-guides");
}

export async function deleteGuideAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = (formData.get("id") as string | null) ?? "";
  if (id) {
    await deleteGuide(userId, id);
  }
  revalidatePath("/style-guides");
}
