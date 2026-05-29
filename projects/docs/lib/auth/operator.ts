import { redirect } from "next/navigation"
import { eq } from "drizzle-orm"
import { db } from "@/db"
import { operators } from "@/db/schema"
import type { ThemeConfig } from "@/lib/theme"
import { getSession, signInUrl } from "./session"

// La porte « opérateur » de ressources = présence d'une ligne `operators` pour
// le user courant (ADR-0002 : tenancy locale). Provisionnée en tandem avec
// accountType='operator' côté auth. Marche aussi pour le MCP (qui ne porte que
// le userId).
export type Operator = {
  id: string
  handle: string
  name: string
  brandName: string | null
  theme: ThemeConfig | null
}

function toOperator(row: typeof operators.$inferSelect | undefined): Operator | null {
  return row
    ? { id: row.id, handle: row.handle, name: row.name, brandName: row.brandName ?? null, theme: row.theme ?? null }
    : null
}

export async function getOperatorById(id: string): Promise<Operator | null> {
  const [row] = await db.select().from(operators).where(eq(operators.id, id)).limit(1)
  return toOperator(row)
}

export async function operatorByHandle(handle: string): Promise<Operator | null> {
  const [row] = await db.select().from(operators).where(eq(operators.handle, handle)).limit(1)
  return toOperator(row)
}

// Opérateur courant (session web) ou null si pas connecté / pas opérateur.
export async function getOperator(): Promise<Operator | null> {
  const s = await getSession()
  if (!s) return null
  return getOperatorById(s.user.id)
}

// Exige un opérateur : non connecté → SSO ; connecté mais non-opérateur → accueil.
export async function requireOperator(): Promise<Operator> {
  const s = await getSession()
  if (!s) redirect(signInUrl())
  const op = await getOperatorById(s.user.id)
  if (!op) redirect("/")
  return op
}
