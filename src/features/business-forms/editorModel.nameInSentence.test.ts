import { describe, expect, it } from "vitest";
import { nameInSentence } from "./editorModel";

describe("nameInSentence", () => {
  it("lowers the first letter of a name, but not of an acronym", () => {
    expect(nameInSentence("Campo asignado", "es")).toBe("campo asignado");
    expect(nameInSentence("Zona", "es")).toBe("zona");
    expect(nameInSentence("CUIT", "es")).toBe("CUIT");
    expect(nameInSentence("Área", "es")).toBe("área");
  });
});
