import { createMcpHandler } from "mcp-handler"
import { withMcpAuth } from "better-auth/plugins"
import { auth } from "@/lib/auth"
import { registerTools, type ToolServer } from "@/lib/resources/mcp"
import { userIsAdmin } from "@/lib/admin/is-admin"

const mcpHandler = createMcpHandler(
  (server) => registerTools(server as unknown as ToolServer),
  {},
  { basePath: "/api" },
)

const handler = withMcpAuth(auth, async (req: Request, session: { userId?: string }) => {
  if (!(await userIsAdmin(session.userId))) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { "content-type": "application/json" },
    })
  }
  return mcpHandler(req)
})

export { handler as GET, handler as POST, handler as DELETE }
