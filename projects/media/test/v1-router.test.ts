import { describe, it, expect, beforeEach } from "vitest";
import { handleV1 } from "@/lib/v1/router";

const KEY = "k-test";
beforeEach(() => {
  process.env.MEDIA_ENGINE_SERVICE_KEY = KEY;
});

function req(path: string, method = "POST", auth: string | null = `Bearer ${KEY}`, body?: unknown): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth !== null) headers.Authorization = auth;
  return new Request(`https://m.test${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("handleV1 — auth", () => {
  it("401 sans header Authorization", async () => {
    const res = await handleV1(req("/v1/generate", "POST", null, { prompt: "x" }));
    expect(res.status).toBe(401);
  });
  it("401 avec une mauvaise clé", async () => {
    const res = await handleV1(req("/v1/generate", "POST", "Bearer wrong", { prompt: "x" }));
    expect(res.status).toBe(401);
  });
});

describe("handleV1 — routing", () => {
  it("404 route /v1 inconnue", async () => {
    const res = await handleV1(req("/v1/nope", "GET"));
    expect(res.status).toBe(404);
  });
  it("400 corps invalide sur generate (prompt manquant)", async () => {
    const res = await handleV1(req("/v1/generate", "POST", `Bearer ${KEY}`, { userId: "u1" }));
    expect(res.status).toBe(400);
  });
  it("400 corps invalide sur generate (userId manquant)", async () => {
    const res = await handleV1(req("/v1/generate", "POST", `Bearer ${KEY}`, { prompt: "x" }));
    expect(res.status).toBe(400);
  });
  it("400 corps non-JSON sur generate", async () => {
    const r = new Request("https://m.test/v1/generate", {
      method: "POST",
      headers: { Authorization: `Bearer ${KEY}` },
      body: "not json",
    });
    const res = await handleV1(r);
    expect(res.status).toBe(400);
  });
});
