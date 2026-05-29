import { describe, it, expect, beforeEach } from "vitest";
import { GET as listTools } from "@/app/internal/tools/route";
import { POST as callTool } from "@/app/internal/tools/[name]/route";

const KEY = "test-internal-key";
function req(body?: unknown, key?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (key) headers["Authorization"] = `Bearer ${key}`;
  return new Request("https://media.internal/internal/tools", {
    method: "POST", headers, body: body ? JSON.stringify(body) : undefined,
  });
}

// Hors preview (APP_ENV non posé → isPreview=false), la garde exige MCP_INTERNAL_KEY.
describe("/internal/tools", () => {
  beforeEach(() => { process.env.MCP_INTERNAL_KEY = KEY; });

  it("GET refuse sans service-key (401)", async () => {
    const res = await listTools(new Request("https://media.internal/internal/tools"));
    expect(res.status).toBe(401);
  });

  it("GET liste les tools avec service-key", async () => {
    const res = await listTools(
      new Request("https://media.internal/internal/tools", { headers: { Authorization: `Bearer ${KEY}` } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.tools)).toBe(true);
    expect(body.tools.length).toBe(24);
  });

  it("POST refuse sans service-key (401)", async () => {
    const res = await callTool(req({ userId: "u1", args: {} }), { params: Promise.resolve({ name: "get_brand" }) });
    expect(res.status).toBe(401);
  });

  it("POST 400 si userId manquant", async () => {
    const res = await callTool(req({ args: {} }, KEY), { params: Promise.resolve({ name: "get_brand" }) });
    expect(res.status).toBe(400);
  });

  it("POST 404 pour un tool inconnu", async () => {
    const res = await callTool(req({ userId: "u1", args: {} }, KEY), { params: Promise.resolve({ name: "inexistant" }) });
    expect(res.status).toBe(404);
  });
});
