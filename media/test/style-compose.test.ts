import { describe, it, expect } from "vitest";
import { composePrompt } from "@/lib/styles/compose";

describe("composePrompt", () => {
  it("renvoie le prompt seul sans style", () => {
    expect(composePrompt("un chat", null)).toBe("un chat");
  });
  it("concatène le style", () => {
    expect(composePrompt("un chat", "style 3D doux")).toBe("un chat\n\nStyle: style 3D doux");
  });
  it("ignore un style vide", () => {
    expect(composePrompt("un chat", "")).toBe("un chat");
  });
});
