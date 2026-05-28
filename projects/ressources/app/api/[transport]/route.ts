import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerTools, type ToolServer } from "@/lib/resources/mcp"
import { verifyMcpToken } from "@/lib/mcp-auth"
import { userIsAdmin } from "@/lib/auth/admin"

const base = createMcpHandler(
  (server) => registerTools(server as unknown as ToolServer),
  { serverInfo: { name: "ressources", version: "1" } },
  { basePath: "/api" },
)

// withMcpAuth(handler, verifyToken, options) : le verify renvoie AuthInfo (ou
// undefined → 401). On valide le bearer via auth.contentos.ch puis on vérifie
// que le user est admin (single-tenant : seul l'admin pilote les ressources).
const handler = withMcpAuth(
  base,
  async (req) => {
    const info = await verifyMcpToken(req)
    if (!info) return undefined
    const userId = info.extra?.userId
    if (typeof userId !== "string" || !userIsAdmin(userId)) return undefined
    return info
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
)

export { handler as GET, handler as POST, handler as DELETE }
