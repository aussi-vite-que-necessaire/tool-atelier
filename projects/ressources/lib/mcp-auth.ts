import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js"
import { env } from "@/lib/env"
import { isPreview, PREVIEW_USER_ID } from "@/lib/auth/preview"

// Valide un bearer MCP via auth.contentos.ch. En preview, court-circuite avec
// PREVIEW_USER_ID (les outils MCP marchent sans OAuth réel).
export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  if (isPreview) {
    return {
      token: "preview",
      clientId: "preview",
      scopes: [],
      extra: { userId: PREVIEW_USER_ID },
    }
  }
  const authz = req.headers.get("authorization")
  if (!authz) return undefined
  const res = await fetch(`${env.AUTH_URL}/api/auth/mcp/get-session`, {
    headers: { authorization: authz },
    cache: "no-store",
  })
  if (!res.ok) return undefined
  const session = await res.json()
  if (!session?.userId) return undefined
  return {
    token: session.accessToken,
    clientId: session.clientId ?? "ressources-mcp",
    scopes:
      typeof session.scopes === "string" ? session.scopes.split(" ").filter(Boolean) : [],
    extra: { userId: session.userId },
  }
}

export function userIdFrom(extra: { authInfo?: AuthInfo }): string {
  const userId = extra.authInfo?.extra?.userId
  if (typeof userId !== "string") throw new Error("userId manquant dans le token")
  return userId
}
