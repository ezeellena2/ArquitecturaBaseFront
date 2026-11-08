import { describe, expect, it } from "vitest";
import { readFormEntry, readFormEntryCorrection, readFormEntryGroups } from "./entries";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const base = { definitionId: id(901), versionId: id(902), versionNumber: 1, prefix: "INS", name: "Pedido", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25 };
const article = (catalog: Record<string, unknown>) => ({ fieldId: id(1), type: "choice", label: "Artículo", help: null, required: true, maxLength: null,
  options: null, selection: null, files: null, catalog: { onlyOption: null, issue: null, missingData: null, ...catalog } });
const groupBy = { fieldId: id(9), name: "Rubro" };

// LD1-A: synthetic bodies with the shape of the backend's DTO; the exported ones qualify the contract when the cohorts are exported together.
describe("choosing first by a field in the entry contract", () => {
  it("reads the field a question chooses first by, and rejects a null the server leaves out", () => {
    const body = { ...base, questions: [article({ groupBy })] };
    expect(readFormEntry(body)).toEqual(body);
    expect(() => readFormEntry({ ...base, questions: [article({ groupBy: null })] })).toThrow();
    expect(() => readFormEntry({ ...base, questions: [article({ groupBy: { fieldId: id(9) } })] })).toThrow();
  });

  it("reads the values in their order, with a null id for the options without one", () => {
    const body = { groups: [{ id: "Herbicidas", text: "Herbicidas" }, { id: id(30), text: "Centro" }, { id: null, text: "Sin rubro" }] };
    expect(readFormEntryGroups(body)).toEqual(body);
    expect(() => readFormEntryGroups({ groups: [{ id: "", text: "Vacío" }] })).toThrow();
    expect(() => readFormEntryGroups({ groups: [{ id: "Herbicidas", text: "Herbicidas", count: 75 }] })).toThrow();
  });

  it("reads the value of the saved option in a correction", () => {
    const answer = { fieldId: id(1), value: id(20), choiceIds: null, options: [{ id: id(20), title: "2,4-D 100 %", description: null }],
      group: { id: "Herbicidas", text: "Herbicidas" } };
    const body = { entry: { ...base, questions: [article({ groupBy })] }, recordId: id(950), number: "INS-000005", files: [], answers: [answer] };
    expect(readFormEntryCorrection(body)).toEqual(body);
    expect(() => readFormEntryCorrection({ ...body, answers: [{ ...answer, group: null }] })).toThrow();
  });
});
