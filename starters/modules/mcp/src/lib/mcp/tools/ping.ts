import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { jsonResult } from "../result";

export function registerPing(server: McpServer): void {
  server.registerTool(
    "ping",
    { description: "Vérifie que le serveur MCP répond.", inputSchema: {} },
    async () => jsonResult({ ok: true, ts: Date.now() }),
  );
}
