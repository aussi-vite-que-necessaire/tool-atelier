import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { verifyMcpToken } from "@/lib/mcp/auth";
import { registerAllTools, INSTRUCTIONS } from "@/lib/mcp/server";

const base = createMcpHandler(
  (server) => registerAllTools(server),
  { serverInfo: { name: "media", version: "1" }, instructions: INSTRUCTIONS },
  { basePath: "/api" },
);

const handler = withMcpAuth(base, (req) => verifyMcpToken(req), {
  required: true,
  resourceMetadataPath: "/.well-known/oauth-protected-resource",
});

export { handler as GET, handler as POST, handler as DELETE };
