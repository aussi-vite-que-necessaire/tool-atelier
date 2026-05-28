import { describe, it, expect } from "vitest";
import { parseVariablesSchema, fillVarDefaults, variablesSchemaToZod } from "@/lib/templates/dsl";

const schema = parseVariablesSchema([
  { name: "titre", label: "Titre", type: "string", max: 80 },
  { name: "points", label: "Points", type: "list" },
  { name: "accent", label: "Accent", type: "color", default: "#ff0000" },
  { name: "photo", label: "Photo", type: "image" },
]);

describe("dsl", () => {
  it("rejette un nom dupliqué", () => {
    expect(() => parseVariablesSchema([
      { name: "x", label: "X", type: "string", max: 10 },
      { name: "x", label: "X2", type: "string", max: 10 },
    ])).toThrow();
  });
  it("remplit les défauts typés", () => {
    const filled = fillVarDefaults(schema, { titre: "Salut" });
    expect(filled).toEqual({ titre: "Salut", points: [], accent: "#ff0000", photo: "" });
  });
  it("valide via zod (image optionnelle en preview)", () => {
    const zod = variablesSchemaToZod(schema, { imagesOptional: true });
    // `points` (list sans `optional`) reste requis ; seule l'image est tolérée en preview.
    expect(zod.safeParse({ titre: "ok", points: [] }).success).toBe(true);
  });
});
