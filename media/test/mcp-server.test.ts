import { describe, it, expect } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "@/lib/mcp/server";

describe("registerAllTools", () => {
  it("enregistre les 17 outils attendus", () => {
    const server = new McpServer({ name: "media", version: "1" });
    registerAllTools(server);
    const names = Object.keys(
      (server as unknown as { _registeredTools: Record<string, unknown> })._registeredTools,
    );
    expect(names.sort()).toEqual(
      [
        "delete_image",
        "edit_image",
        "generate_image",
        "get_image",
        "list_images",
        "render_html",
        "list_visual_styles",
        "create_visual_style",
        "update_visual_style",
        "delete_visual_style",
        "list_style_guides",
        "get_style_guide",
        "create_style_guide",
        "update_style_guide",
        "delete_style_guide",
        "get_brand",
        "update_brand",
      ].sort(),
    );
  });
});
