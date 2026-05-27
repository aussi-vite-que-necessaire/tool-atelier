import { describe, it, expect } from "vitest";
import { isBlockedUrl, isPrivateHost } from "../src/lib/url-guard";

describe("isBlockedUrl", () => {
  it("autorise les CDN publics http/https", () => {
    expect(isBlockedUrl("https://fonts.googleapis.com/css2?family=Inter")).toBe(false);
    expect(isBlockedUrl("https://cdn.tailwindcss.com")).toBe(false);
    expect(isBlockedUrl("http://example.com/img.png")).toBe(false);
  });

  it("autorise data:, blob:, about: (pas d'egress)", () => {
    expect(isBlockedUrl("data:image/png;base64,iVBOR")).toBe(false);
    expect(isBlockedUrl("about:blank")).toBe(false);
  });

  it("bloque les schémas non-réseau", () => {
    expect(isBlockedUrl("file:///etc/passwd")).toBe(true);
    expect(isBlockedUrl("ftp://host/x")).toBe(true);
  });

  it("bloque les cibles internes", () => {
    expect(isBlockedUrl("http://localhost:8080/")).toBe(true);
    expect(isBlockedUrl("http://127.0.0.1/")).toBe(true);
    expect(isBlockedUrl("http://169.254.169.254/latest/meta-data/")).toBe(true);
    expect(isBlockedUrl("http://10.0.0.5/")).toBe(true);
    expect(isBlockedUrl("http://192.168.1.1/")).toBe(true);
    expect(isBlockedUrl("http://172.16.0.1/")).toBe(true);
    expect(isBlockedUrl("http://[::1]/")).toBe(true);
    expect(isBlockedUrl("http://metadata.google.internal/")).toBe(true);
  });
});

describe("isPrivateHost", () => {
  it("distingue privé et public", () => {
    expect(isPrivateHost("8.8.8.8")).toBe(false);
    expect(isPrivateHost("172.32.0.1")).toBe(false); // hors 16-31
    expect(isPrivateHost("172.20.0.1")).toBe(true);
    expect(isPrivateHost("example.com")).toBe(false);
  });
});
