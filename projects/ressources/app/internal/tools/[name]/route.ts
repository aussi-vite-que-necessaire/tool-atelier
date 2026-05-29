import { allowInternal } from "@/lib/mcp-internal-auth"
import { callToolByName } from "@/lib/mcp-internal"

export const dynamic = "force-dynamic"

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } })
}

export async function POST(
  request: Request,
  ctx: { params: Promise<{ name: string }> },
): Promise<Response> {
  if (!allowInternal(request)) return json({ error: "Unauthorized" }, 401)

  const { name } = await ctx.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "Corps JSON invalide" }, 400)
  }
  const { userId, args } = (body ?? {}) as { userId?: unknown; args?: unknown }
  if (typeof userId !== "string" || userId.length === 0) {
    return json({ error: "userId manquant" }, 400)
  }
  try {
    const result = await callToolByName(name, userId, args ?? {})
    return json({ result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    const status = /inconnu/i.test(message) ? 404 : 400
    return json({ error: message }, status)
  }
}
