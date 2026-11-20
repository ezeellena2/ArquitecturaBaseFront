import { describe, expect, it } from "vitest";
import { summarizeChoices } from "./summarizeChoices";

describe("summarizeChoices", () => {
  const fits = (text: string) => text.length <= 20;
  const more = (count: number) => `y ${count} más`;

  it("names all the chosen ones when they fit", () => {
    expect(summarizeChoices(["Soja 1ª", "Maíz"], fits, more)).toEqual({ names: "Soja 1ª, Maíz", more: null });
  });

  it("names as many as fit and says how many more", () => {
    expect(summarizeChoices(["Soja 1ª", "Maíz 2ª", "Trigo"], fits, more)).toEqual({ names: "Soja 1ª", more: "y 2 más" });
  });

  it("keeps the first name even when it does not fit", () => {
    expect(summarizeChoices(["Una opción con un nombre largo", "Otra"], fits, more)).toEqual({ names: "Una opción con un nombre largo", more: "y 1 más" });
    expect(summarizeChoices(["Una opción con un nombre largo"], fits, more)).toEqual({ names: "Una opción con un nombre largo", more: null });
  });
});
