import { describe, it, expect, vi, afterEach } from "vitest";
import { listTools, callTool } from "@/lib/backend-client";

const backend = { prefix: "media", baseUrl: "https://media.internal", serviceKey: "k" };

afterEach(() => { vi.restoreAllMocks(); });

describe("listTools", () => {
  it("appelle GET /internal/tools avec la service-key et renvoie les tools", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ tools: [{ name: "generate_image", description: "d", inputSchema: { type: "object" } }] }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const tools = await listTools(backend);
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("generate_image");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://media.internal/internal/tools");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
  });

  it("propage l'échec en lançant", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("nope", { status: 500 })));
    await expect(listTools(backend)).rejects.toThrow();
  });
});

describe("callTool", () => {
  it("POST /internal/tools/:name avec {userId,args} et renvoie result", async () => {
    const result = { content: [{ type: "text", text: "{}" }] };
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ result }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await callTool(backend, "generate_image", "u1", { prompt: "x" });
    expect(out).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://media.internal/internal/tools/generate_image");
    expect(JSON.parse(init.body as string)).toEqual({ userId: "u1", args: { prompt: "x" } });
  });

  it("mappe une erreur backend en résultat isError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Image introuvable: x" }), { status: 404 })));
    const out = await callTool(backend, "edit_image", "u1", { image_id: "x" });
    expect(out.isError).toBe(true);
    expect(out.content[0].text).toContain("Image introuvable");
  });
});
