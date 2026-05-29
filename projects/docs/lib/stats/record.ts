import { db } from "@/db"
import { viewEvents } from "@/db/schema"
import type { Ref } from "@/lib/tracking/ref"

const cols = (ref?: Ref | null) => ({
  source: ref?.source ?? null,
  medium: ref?.medium ?? null,
  campaign: ref?.campaign ?? null,
})

export async function recordPageView(resourceId: string, pageId: string, userId: string | null, ref?: Ref | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId, userId, type: "page_view", ...cols(ref) })
  } catch (e) {
    console.error("recordPageView:", (e as Error).message)
  }
}

export async function recordGateView(resourceId: string, userId: string | null, ref?: Ref | null) {
  try {
    await db.insert(viewEvents).values({ resourceId, pageId: null, userId, type: "gate_view", ...cols(ref) })
  } catch (e) {
    console.error("recordGateView:", (e as Error).message)
  }
}
