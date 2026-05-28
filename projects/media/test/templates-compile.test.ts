import { describe, it, expect } from "vitest";
import { compileTemplate } from "@/lib/templates/compile";
import { EMPTY_BRAND } from "@/lib/brand/context";

function tpl(over: Partial<{ bodyHtml: string; css: string; width: number; height: number }> = {}) {
  return {
    id: "t1", slug: "s", label: "L", platform: "linkedin",
    // Espace avant `}` final : sinon Handlebars lit `{{accent}}}` comme un triple-stache.
    width: 1200, height: 627, bodyHtml: "<h1>{{escape titre}}</h1>", css: "h1{ color:{{accent}} }",
    variablesSchema: [], sampleVars: {}, styleGuideId: null,
    createdAt: new Date(), updatedAt: new Date(), ...over,
  } as Parameters<typeof compileTemplate>[0]["template"];
}

describe("compileTemplate", () => {
  it("injecte les variables et la marque", () => {
    const html = compileTemplate({ template: tpl(), vars: { titre: "Bonjour", accent: "#123456" }, brand: EMPTY_BRAND });
    expect(html).toContain("<h1>Bonjour</h1>");
    expect(html).toContain("color:#123456");
    expect(html).toContain('style="width:1200px;height:627px"');
  });
  it("expose brand dans le contexte", () => {
    // css vidé : compileTemplate compile en strict mode, toute variable référencée
    // (ici `accent`) doit être présente — fillVarDefaults n'agit qu'en amont (render.ts).
    const html = compileTemplate({ template: tpl({ bodyHtml: "<p>{{brand.name}}</p>", css: "" }), vars: {}, brand: { name: "AVQN", signature: null, logo: "" } });
    expect(html).toContain("<p>AVQN</p>");
  });
});
