import { describe, it, expect, afterEach, vi } from "vitest";

afterEach(() => { vi.resetModules(); delete process.env.MCP_INTERNAL_KEY; delete process.env.APP_ENV; });

// isPreview est figé à l'import (lecture de APP_ENV) → import dynamique contrôlé.
async function importAuth(appEnv?: string) {
  vi.resetModules();
  if (appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnv;
  return import("@/lib/mcp/internal-auth");
}

function bearer(key?: string): Request {
  const headers: Record<string, string> = {};
  if (key !== undefined) headers["Authorization"] = `Bearer ${key}`;
  return new Request("https://media.internal/internal/tools", { headers });
}

describe("allowInternal", () => {
  it("preview : accès libre sans clé", async () => {
    const { allowInternal } = await importAuth("ma-branche");
    expect(allowInternal(bearer())).toBe(true);
  });

  it("prod : exige la clé MCP_INTERNAL_KEY", async () => {
    process.env.MCP_INTERNAL_KEY = "k-secret";
    const { allowInternal } = await importAuth("prod");
    expect(allowInternal(bearer("k-secret"))).toBe(true);
    expect(allowInternal(bearer("mauvaise"))).toBe(false);
    expect(allowInternal(bearer())).toBe(false);
  });

  it("prod sans clé configurée : refuse tout", async () => {
    delete process.env.MCP_INTERNAL_KEY;
    const { allowInternal } = await importAuth("prod");
    expect(allowInternal(bearer("quoi"))).toBe(false);
  });
});
