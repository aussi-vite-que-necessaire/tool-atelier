import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerGateway } from "@/lib/mcp/gateway";

const base = createMcpHandler(
  (server) => registerGateway(server),
  { serverInfo: { name: "contentos", version: "1" }, capabilities: { tools: {} } },
  { basePath: "/api" },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
