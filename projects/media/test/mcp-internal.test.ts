import { describe, it, expect } from "vitest";
import { listToolsResponse, callToolByName } from "@/lib/mcp/internal";

describe("listToolsResponse", () => {
  it("expose les 24 tools attendus avec un inputSchema JSON Schema", () => {
    const { tools } = listToolsResponse();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "create_pdf", "create_style_guide", "create_visual_style", "create_visual_template",
        "delete_image", "delete_style_guide", "delete_visual_style", "delete_visual_template",
        "edit_image", "generate_image", "get_brand", "get_image", "get_style_guide",
        "get_visual_template", "list_images", "list_style_guides", "list_visual_styles",
        "list_visual_templates", "render_html", "render_template", "update_brand",
        "update_style_guide", "update_visual_style", "update_visual_template",
      ].sort(),
    );
    const gen = tools.find((t) => t.name === "generate_image")!;
    // JSON Schema, pas un objet Zod : type "object" + properties.prompt présent.
    expect(gen.inputSchema).toMatchObject({ type: "object" });
    expect((gen.inputSchema as { properties: Record<string, unknown> }).properties).toHaveProperty("prompt");
  });
});

describe("callToolByName", () => {
  it("rejette un tool inconnu", async () => {
    await expect(callToolByName("inexistant", "u1", {})).rejects.toThrow(/inconnu/i);
  });

  it("rejette des args invalides (validation Zod)", async () => {
    // generate_image exige prompt:string non vide → args vides invalides.
    await expect(callToolByName("generate_image", "u1", {})).rejects.toThrow(/prompt|invalide|required/i);
  });
});
