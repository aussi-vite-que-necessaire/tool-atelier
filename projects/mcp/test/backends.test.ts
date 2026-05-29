import { describe, it, expect } from "vitest";
import { backendBaseUrl } from "@/lib/backends";

describe("backendBaseUrl", () => {
  it("prod : swap du sous-domaine mcp → backend", () => {
    expect(backendBaseUrl("media", "https://mcp.contentos.ch")).toBe("https://media.contentos.ch");
    expect(backendBaseUrl("ressources", "https://mcp.contentos.ch")).toBe("https://ressources.contentos.ch");
  });

  it("preview : conserve le slug de branche et le palier preview", () => {
    expect(backendBaseUrl("media", "https://mcp-ma-branche.preview.contentos.ch")).toBe(
      "https://media-ma-branche.preview.contentos.ch",
    );
    expect(backendBaseUrl("cast", "https://mcp-ma-branche.preview.contentos.ch")).toBe(
      "https://cast-ma-branche.preview.contentos.ch",
    );
  });
});
