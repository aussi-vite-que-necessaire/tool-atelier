import { describe, it, expect } from "vitest";
import { handleV1 } from "@/lib/v1/router";

describe("/v1 lecture média — auth", () => {
  it("401 sans Bearer", async () => {
    const res = await handleV1(new Request("https://x/v1/media", { method: "GET" }));
    expect(res.status).toBe(401);
  });
});
