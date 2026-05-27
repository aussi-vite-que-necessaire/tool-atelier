import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "@/lib/mcp/server";

describe("registerAllTools", () => {
  it("enregistre les 6 outils attendus", () => {
    const server = new McpServer({ name: "media", version: "1" });
    registerAllTools(server);
    const names = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    );
    expect(names.sort()).toEqual(
      ["delete_image", "edit_image", "generate_image", "get_image", "list_images", "render_html"].sort(),
    );
  });
});
