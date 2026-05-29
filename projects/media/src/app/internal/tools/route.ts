import { allowInternal } from "@/lib/mcp/internal-auth";
import { listToolsResponse } from "@/lib/mcp/internal";

export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  if (!allowInternal(request)) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { "content-type": "application/json" },
    });
  }
  return new Response(JSON.stringify(listToolsResponse()), {
    status: 200, headers: { "content-type": "application/json" },
  });
}
