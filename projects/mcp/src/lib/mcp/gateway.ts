import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { Backend } from "@/lib/backends";
import { getBackends } from "@/lib/backends";
import { listTools, callTool, type RemoteTool, type ToolResult } from "@/lib/backend-client";
import { userIdFrom } from "./auth";

type NamespacedTool = RemoteTool;

// Agrège les catalogues, préfixe `<prefix>_`. Un backend injoignable est omis (log + skip).
export async function aggregateToolList(backends: Backend[]): Promise<NamespacedTool[]> {
  const lists = await Promise.all(
    backends.map(async (b) => {
      try {
        const tools = await listTools(b);
        return tools.map((t) => ({ ...t, name: `${b.prefix}_${t.name}` }));
      } catch (e) {
        console.error(`[gateway] backend ${b.prefix} indisponible:`, e instanceof Error ? e.message : e);
        return [];
      }
    }),
  );
  return lists.flat();
}

// Dé-préfixe `<prefix>_<tool>` et route vers le backend. Le préfixe est le
// segment avant le premier `_` (invariant : un préfixe de backend ne contient
// pas de `_`, cf. backends.ts) — match exact, pas de `startsWith` ambigu.
// Nom inconnu → isError.
export async function routeToolCall(
  backends: Backend[],
  namespaced: string,
  userId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const sep = namespaced.indexOf("_");
  const prefix = sep === -1 ? "" : namespaced.slice(0, sep);
  const backend = backends.find((b) => b.prefix === prefix);
  if (!backend) {
    return { content: [{ type: "text", text: `Tool inconnu: ${namespaced}` }], isError: true };
  }
  const toolName = namespaced.slice(sep + 1);
  return callTool(backend, toolName, userId, args);
}

// Pose les handlers bas-niveau sur le serveur SDK (pas de registerTool : on relaie
// les JSON Schemas des backends tels quels).
export function registerGateway(server: McpServer, backends: Backend[] = getBackends()): void {
  const low = server.server;
  low.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: await aggregateToolList(backends) };
  });
  low.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const userId = userIdFrom(extra as { authInfo?: AuthInfo });
    const { name, arguments: args } = request.params;
    return routeToolCall(backends, name, userId, (args ?? {}) as Record<string, unknown>);
  });
}
