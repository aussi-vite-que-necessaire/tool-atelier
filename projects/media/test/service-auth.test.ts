import { describe, it, expect, beforeEach } from "vitest";
import { checkServiceKey } from "../src/lib/service-auth";

function makeRequest(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers["Authorization"] = authHeader;
  return new Request("https://example.com/v1/generate", { headers });
}

describe("checkServiceKey", () => {
  beforeEach(() => {
    process.env.MEDIA_ENGINE_SERVICE_KEY = "super-secret-key-123";
  });

  it("accepte la clé correcte", () => {
    expect(checkServiceKey(makeRequest("Bearer super-secret-key-123"))).toBe(true);
  });

  it("refuse une clé incorrecte", () => {
    expect(checkServiceKey(makeRequest("Bearer wrong-key"))).toBe(false);
  });

  it("refuse l'absence de header Authorization", () => {
    expect(checkServiceKey(makeRequest())).toBe(false);
  });

  it("refuse un header sans préfixe Bearer", () => {
    expect(checkServiceKey(makeRequest("super-secret-key-123"))).toBe(false);
  });

  it("refuse une clé vide même si le header est présent", () => {
    process.env.MEDIA_ENGINE_SERVICE_KEY = "";
    expect(checkServiceKey(makeRequest("Bearer "))).toBe(false);
  });
});
