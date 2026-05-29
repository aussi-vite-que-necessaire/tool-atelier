import { describe, it, expect, vi, afterEach } from "vitest";
import { aggregateToolList, routeToolCall } from "@/lib/mcp/gateway";
import * as client from "@/lib/backend-client";

const backends = [{ prefix: "media", baseUrl: "https://media.internal", serviceKey: "k" }];

afterEach(() => vi.restoreAllMocks());

describe("aggregateToolList", () => {
  it("préfixe les noms par backend", async () => {
    vi.spyOn(client, "listTools").mockResolvedValue([
      { name: "generate_image", description: "d", inputSchema: { type: "object" } },
    ]);
    const tools = await aggregateToolList(backends);
    expect(tools.map((t) => t.name)).toEqual(["media_generate_image"]);
    expect(tools[0].inputSchema).toEqual({ type: "object" });
  });

  it("dégradation : un backend down est omis, pas d'exception", async () => {
    vi.spyOn(client, "listTools").mockRejectedValue(new Error("down"));
    const tools = await aggregateToolList(backends);
    expect(tools).toEqual([]);
  });
});

describe("routeToolCall", () => {
  it("dé-préfixe et appelle le bon backend", async () => {
    const spy = vi.spyOn(client, "callTool").mockResolvedValue({ content: [{ type: "text", text: "ok" }] });
    const out = await routeToolCall(backends, "media_generate_image", "u1", { prompt: "x" });
    expect(spy).toHaveBeenCalledWith(backends[0], "generate_image", "u1", { prompt: "x" });
    expect(out.content[0].text).toBe("ok");
  });

  it("nom sans backend connu → résultat isError", async () => {
    const out = await routeToolCall(backends, "inconnu_tool", "u1", {});
    expect(out.isError).toBe(true);
  });
});
