import { createMcpHandler, withMcpAuth } from "mcp-handler"
import { registerTools, type ToolServer } from "@/lib/resources/mcp"
import { verifyMcpToken } from "@/lib/mcp-auth"
import { getOperatorById } from "@/lib/auth/operator"

const base = createMcpHandler(
  (server) => registerTools(server as unknown as ToolServer),
  { serverInfo: { name: "ressources", version: "1" } },
  { basePath: "/api" },
)

// withMcpAuth(handler, verifyToken, options) : le verify renvoie AuthInfo (ou
// undefined → 401). On valide le bearer via auth.contentos.ch, puis on exige que
// le user soit OPÉRATEUR (présence d'une ligne operators). Son id + handle sont
// déposés dans extra : chaque outil n'opère que sur ses ressources (ADR-0002).
const handler = withMcpAuth(
  base,
  async (req) => {
    const info = await verifyMcpToken(req)
    if (!info) return undefined
    const userId = info.extra?.userId
    if (typeof userId !== "string") return undefined
    const op = await getOperatorById(userId)
    if (!op) return undefined
    return { ...info, extra: { ...info.extra, operatorId: op.id, operatorHandle: op.handle } }
  },
  {
    required: true,
    resourceMetadataPath: "/.well-known/oauth-protected-resource",
  },
)

export { handler as GET, handler as POST, handler as DELETE }
