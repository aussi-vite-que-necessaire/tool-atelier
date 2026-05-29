import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

// isPreview est figé à l'import du module (lecture de process.env.APP_ENV) :
// on importe dynamiquement après avoir posé APP_ENV pour contrôler le mode.
async function importAuth(appEnv?: string) {
  vi.resetModules();
  if (appEnv === undefined) delete process.env.APP_ENV;
  else process.env.APP_ENV = appEnv;
  return import("@/lib/mcp/auth");
}

describe("verifyMcpToken", () => {
  it("court-circuite en preview avec PREVIEW_USER_ID, sans fetch", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { verifyMcpToken } = await importAuth("ma-branche");
    const info = await verifyMcpToken(new Request("https://mcp.internal/api/mcp"));
    expect(info?.extra?.userId).toBe("preview-user");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("hors preview, renvoie undefined sans header Authorization", async () => {
    process.env.APP_URL = "https://mcp.contentos.ch";
    process.env.MEDIA_INTERNAL_URL = "https://media.internal";
    process.env.MEDIA_SERVICE_KEY = "x";
    const { verifyMcpToken } = await importAuth("prod");
    const info = await verifyMcpToken(new Request("https://mcp.contentos.ch/api/mcp"));
    expect(info).toBeUndefined();
  });
});
