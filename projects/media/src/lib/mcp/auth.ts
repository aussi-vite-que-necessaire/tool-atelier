import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { auth } from "@/lib/auth";

// Vérifie le Bearer OAuth de la requête MCP via la session du connecteur BetterAuth.
export async function verifyMcpToken(req: Request): Promise<AuthInfo | undefined> {
  const session = await auth.api.getMcpSession({ headers: req.headers });
  if (!session) return undefined;
  return {
    token: session.accessToken,
    clientId: session.clientId ?? "media-mcp",
    scopes: typeof session.scopes === "string" ? session.scopes.split(" ").filter(Boolean) : [],
    extra: { userId: session.userId },
  };
}
