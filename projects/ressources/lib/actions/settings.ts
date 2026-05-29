"use server"

import { eq } from "drizzle-orm"
import { db } from "@/db"
import { operators } from "@/db/schema"
import { requireOperator } from "@/lib/auth/operator"
import { parseSettingsInput, type SettingsInput } from "@/lib/settings/validate"

export async function saveSettingsAction(raw: SettingsInput): Promise<{ ok: boolean }> {
  const op = await requireOperator()
  const clean = parseSettingsInput(raw)
  if (!clean) return { ok: false }
  await db
    .update(operators)
    .set({ brandName: clean.brandName, theme: clean.theme })
    .where(eq(operators.id, op.id))
  return { ok: true }
}
