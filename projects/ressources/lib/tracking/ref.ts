export type Ref = { source: string | null; medium: string | null; campaign: string | null }

export const REF_COOKIE = "lab_ref"
export const REF_MAX_AGE = 60 * 60 * 24 * 90 // 90 jours

function norm(v: string | null): string | null {
  if (v === null) return null
  const s = v.trim().toLowerCase().slice(0, 64)
  return s.length ? s : null
}

export function parseRefFromParams(params: URLSearchParams): Ref | null {
  const source = norm(params.get("utm_source") ?? params.get("src"))
  const medium = norm(params.get("utm_medium"))
  const campaign = norm(params.get("utm_campaign"))
  if (!source && !medium && !campaign) return null
  return { source, medium, campaign }
}

export function buildTrackingUrl(
  baseUrl: string,
  ref: { source: string; medium?: string | null; campaign?: string | null },
): string {
  const u = new URL(baseUrl)
  const put = (key: string, val: string | null | undefined) => {
    const n = norm(val ?? null)
    if (n) u.searchParams.set(key, n)
  }
  put("utm_source", ref.source)
  put("utm_medium", ref.medium)
  put("utm_campaign", ref.campaign)
  return u.toString()
}

export function parseRefFromRecord(record: Record<string, string | string[] | undefined> | undefined): Ref | null {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(record ?? {})) {
    if (typeof v === "string") sp.set(k, v)
    else if (Array.isArray(v) && typeof v[0] === "string") sp.set(k, v[0])
  }
  return parseRefFromParams(sp)
}

export function serializeRefCookie(ref: Ref): string {
  return JSON.stringify({ s: ref.source, m: ref.medium, c: ref.campaign, t: new Date().toISOString() })
}

export function parseRefCookie(raw: string | undefined): Ref | null {
  if (!raw) return null
  try {
    const o = JSON.parse(raw) as { s?: unknown; m?: unknown; c?: unknown }
    const str = (v: unknown) => (typeof v === "string" && v.length ? v : null)
    return { source: str(o.s), medium: str(o.m), campaign: str(o.c) }
  } catch {
    return null
  }
}
