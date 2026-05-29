import type { ZodRawShape } from "zod"
import { registerTools, type ToolServer } from "./mcp"

type Extra = { authInfo?: { extra?: Record<string, unknown> } }
type Handler = (args: Record<string, unknown>, extra: Extra) => unknown
export type CapturedTool = { name: string; description: string; inputSchema: ZodRawShape; handler: Handler }

// Capture les tools déclarés par registerTools sans dépendre du transport MCP :
// on passe un faux ToolServer qui enregistre les définitions au lieu de les servir.
function capture(): CapturedTool[] {
  const tools: CapturedTool[] = []
  const server: ToolServer = {
    tool(name, description, shape, cb) {
      tools.push({ name, description, inputSchema: shape, handler: cb as Handler })
    },
  }
  registerTools(server)
  return tools
}

export const tools: CapturedTool[] = capture()
export const toolsByName = new Map<string, CapturedTool>(tools.map((t) => [t.name, t]))
