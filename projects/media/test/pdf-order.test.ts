import { describe, it, expect } from "vitest";
import { addImage, removeAt, moveUp, moveDown } from "@/app/(admin)/gallery/new/order";

describe("addImage", () => {
  it("ajoute un id en fin de liste", () => {
    expect(addImage(["a", "b"], "c")).toEqual(["a", "b", "c"]);
  });
  it("ignore un id déjà présent (pas de doublon)", () => {
    expect(addImage(["a", "b"], "a")).toEqual(["a", "b"]);
  });
  it("ne mute pas l'entrée", () => {
    const list = ["a"];
    addImage(list, "b");
    expect(list).toEqual(["a"]);
  });
});

describe("removeAt", () => {
  it("retire l'élément à l'index donné", () => {
    expect(removeAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
  });
  it("ignore un index hors bornes", () => {
    expect(removeAt(["a", "b"], 5)).toEqual(["a", "b"]);
    expect(removeAt(["a", "b"], -1)).toEqual(["a", "b"]);
  });
  it("ne mute pas l'entrée", () => {
    const list = ["a", "b"];
    removeAt(list, 0);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("moveUp", () => {
  it("échange avec l'élément précédent", () => {
    expect(moveUp(["a", "b", "c"], 2)).toEqual(["a", "c", "b"]);
  });
  it("ne fait rien sur le premier élément", () => {
    expect(moveUp(["a", "b"], 0)).toEqual(["a", "b"]);
  });
  it("ne mute pas l'entrée", () => {
    const list = ["a", "b"];
    moveUp(list, 1);
    expect(list).toEqual(["a", "b"]);
  });
});

describe("moveDown", () => {
  it("échange avec l'élément suivant", () => {
    expect(moveDown(["a", "b", "c"], 0)).toEqual(["b", "a", "c"]);
  });
  it("ne fait rien sur le dernier élément", () => {
    expect(moveDown(["a", "b"], 1)).toEqual(["a", "b"]);
  });
  it("ne mute pas l'entrée", () => {
    const list = ["a", "b"];
    moveDown(list, 0);
    expect(list).toEqual(["a", "b"]);
  });
});
