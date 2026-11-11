import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryQuestion } from "./api/entries";
import {
  calculationCandidates, calculationFormula, calculationIncomplete, changeCalculationOperation, draftFormulaOperands, entryCalculations, entryFormulaOperands, exactCalculation,
} from "./calculations";
import type { EntryDraft } from "./entryForm";
import type { DraftQuestion } from "./model";

const number = (localId: string, label: string, extra: Partial<DraftQuestion> = {}): DraftQuestion =>
  ({ localId, fieldId: null, replacesFieldId: null, type: "decimal", label: { es: label }, help: null, required: false, ...extra } as DraftQuestion);
const block: DraftQuestion = { localId: "block", fieldId: null, replacesFieldId: null, type: "group", label: { es: "Artículos" }, help: null, required: true, rows: { minRows: 1, maxRows: 20 } };
const rate: DraftQuestion = { localId: "rate", fieldId: null, replacesFieldId: null, type: "choice", label: { es: "Alícuota" }, help: null, required: true, source: { catalog: "rates" } };
const text: DraftQuestion = { localId: "notes", fieldId: null, replacesFieldId: null, type: "shortText", label: { es: "Notas" }, help: null, required: false, maxLength: 80 };

describe("a calculation in the editor (CA1-A)", () => {
  const quantity = number("quantity", "Cantidad", { repeated: true });
  const price = number("price", "Precio unitario", { repeated: true });
  const amount = number("amount", "Importe", { repeated: true, calculation: { operation: "multiply", operands: ["quantity", "price"] } });
  const freight = number("freight", "Flete");
  const total = number("total", "Total", { calculation: { operation: "sum", operands: ["amount"] } });
  const fields = [freight, rate, block, quantity, price, amount, text, total];

  it("keeps what was chosen when the operation changes", () => {
    expect(changeCalculationOperation({ operation: "multiply", operands: ["quantity", null] }, "percent")).toEqual({ operation: "percent", operands: ["quantity", null] });
    expect(changeCalculationOperation({ operation: "multiply", operands: ["quantity", null] }, "sum")).toEqual({ operation: "sum", operands: ["quantity"] });
    expect(changeCalculationOperation({ operation: "sum", operands: ["a", "b", "c"] }, "multiply")).toEqual({ operation: "multiply", operands: ["a", "b"] });
    expect(changeCalculationOperation({ operation: "sum", operands: [] }, "percent")).toEqual({ operation: "percent", operands: [null, null] });
  });

  it("multiplies earlier numbers of its own item, other calculations included", () => {
    const fourth = number("fourth", "Descuento", { repeated: true });
    expect(calculationCandidates([...fields.slice(0, 6), fourth], "fourth", "multiply", 0, "es", "es")).toEqual([
      { id: "quantity", number: "3.1", label: "Cantidad", allItems: false },
      { id: "price", number: "3.2", label: "Precio unitario", allItems: false },
      { id: "amount", number: "3.3", label: "Importe", allItems: false },
    ]);
  });

  it("multiplies earlier numbers outside the block when it is outside, never itself nor a later one", () => {
    const tax = number("tax", "Impuesto", { calculation: { operation: "multiply", operands: [null, null] } });
    expect(calculationCandidates([freight, tax, number("later", "Después")], "tax", "multiply", 1, "es", "es"))
      .toEqual([{ id: "freight", number: "1", label: "Flete", allItems: false }]);
  });

  it("takes the rate of a percentage also from an earlier catalog choice, only in its second place", () => {
    const vat = number("vat", "IVA", { calculation: { operation: "percent", operands: [null, null] } });
    const withRate = [freight, rate, vat];
    expect(calculationCandidates(withRate, "vat", "percent", 0, "es", "es").map(candidate => candidate.id)).toEqual(["freight"]);
    expect(calculationCandidates(withRate, "vat", "percent", 1, "es", "es")).toEqual([
      { id: "freight", number: "1", label: "Flete", allItems: false },
      { id: "rate", number: "2", label: "Alícuota", allItems: false, rate: true },
    ]);
  });

  it("adds numbers outside the block and a question of the block over all the items", () => {
    expect(calculationCandidates(fields, "total", "sum", 0, "es", "es")).toEqual([
      { id: "freight", number: "1", label: "Flete", allItems: false },
      { id: "quantity", number: "3.1", label: "Cantidad", allItems: true },
      { id: "price", number: "3.2", label: "Precio unitario", allItems: true },
      { id: "amount", number: "3.3", label: "Importe", allItems: true },
    ]);
    // A sum goes outside the block.
    expect(calculationCandidates(fields, "amount", "sum", 0, "es", "es")).toEqual([]);
  });

  it("names a saved question by its field identity", () => {
    const saved = number("field-freight", "Flete", { fieldId: "field-freight" });
    expect(calculationCandidates([saved, total], "total", "sum", 0, "es", "es")[0]!.id).toBe("field-freight");
  });

  it("is incomplete while a place is empty, a sum has no question or one repeats", () => {
    expect(calculationIncomplete(number("a", "A", { calculation: { operation: "multiply", operands: ["x", null] } }))).toBe(true);
    expect(calculationIncomplete(number("a", "A", { calculation: { operation: "sum", operands: [] } }))).toBe(true);
    expect(calculationIncomplete(number("a", "A", { calculation: { operation: "sum", operands: ["x", "x"] } }))).toBe(true);
    expect(calculationIncomplete(number("a", "A", { calculation: { operation: "percent", operands: ["x", "y"] } }))).toBe(false);
    expect(calculationIncomplete(number("a", "A"))).toBe(false);
  });

});

describe("exact decimals, as the server computes them", () => {
  it("multiplies keeping the decimals of both numbers and rounds to two half-even", () => {
    expect(exactCalculation("multiply", ["12", "850,00"])).toBe("10200.00");
    expect(exactCalculation("multiply", ["12", "850"])).toBe("10200");
    expect(exactCalculation("multiply", ["0,125", "1"])).toBe("0.12");
    expect(exactCalculation("multiply", ["0,135", "1"])).toBe("0.14");
    expect(exactCalculation("multiply", ["1,005", "1"])).toBe("1.00");
    expect(exactCalculation("multiply", ["-2,5", "0,5"])).toBe("-1.25");
    expect(exactCalculation("multiply", ["0,001", "-1"])).toBe("0.00");
  });

  it("takes a percentage as base times rate over one hundred, with the scale of an exact division", () => {
    expect(exactCalculation("percent", ["1000", "21"])).toBe("210");
    expect(exactCalculation("percent", ["1000,50", "21"])).toBe("210.10");
    expect(exactCalculation("percent", ["10,00", "10,5"])).toBe("1.05");
    expect(exactCalculation("percent", ["3", "1"])).toBe("0.03");
  });

  it("adds what there is, with the largest scale, and is empty without values", () => {
    expect(exactCalculation("sum", ["10200.00", "5100"])).toBe("15300.00");
    expect(exactCalculation("sum", ["1,5", "+2"])).toBe("3.5");
    expect(exactCalculation("sum", [])).toBeNull();
  });

  it("leaves a product or a percentage empty while an operand is", () => {
    expect(exactCalculation("multiply", ["12", null])).toBeNull();
    expect(exactCalculation("percent", [null, "21"])).toBeNull();
  });
});

describe("the preview while loading (CA1-A)", () => {
  const ids = {
    client: "00000000-0000-4000-8000-000000000001", block: "00000000-0000-4000-8000-000000000002", quantity: "00000000-0000-4000-8000-000000000003",
    price: "00000000-0000-4000-8000-000000000004", amount: "00000000-0000-4000-8000-000000000005", freight: "00000000-0000-4000-8000-000000000006",
    total: "00000000-0000-4000-8000-000000000007", rate: "00000000-0000-4000-8000-000000000008", vat: "00000000-0000-4000-8000-000000000009",
    net: "00000000-0000-4000-8000-00000000000a", gross: "00000000-0000-4000-8000-00000000000b",
  };
  function question(fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion {
    return { fieldId, type, label: type, help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra };
  }
  const entry: FormEntry = {
    definitionId: "00000000-0000-4000-8000-0000000000f1", versionId: "00000000-0000-4000-8000-0000000000f2", versionNumber: 1, prefix: "FAC",
    name: "Factura", culture: "es", submitLabel: "Enviar", maxFileSizeMiB: 25,
    questions: [
      question(ids.client, "shortText", { maxLength: 80 }),
      question(ids.block, "group", { label: "Artículos", required: true, rows: { minRows: 1, maxRows: 5 } }),
      question(ids.quantity, "decimal", { repeated: true }),
      question(ids.price, "decimal", { repeated: true }),
      question(ids.amount, "decimal", { repeated: true, calculation: { operation: "multiply", operands: [ids.quantity, ids.price] } }),
      question(ids.freight, "decimal"),
      question(ids.total, "decimal", { calculation: { operation: "sum", operands: [ids.amount, ids.freight] } }),
      question(ids.rate, "choice", { catalog: { onlyOption: null, issue: null, missingData: null } }),
      question(ids.net, "decimal"),
      question(ids.vat, "decimal", { calculation: { operation: "percent", operands: [ids.net, ids.rate] } }),
      question(ids.gross, "decimal", { calculation: { operation: "percent", operands: [ids.total, ids.net] } }),
    ],
  };
  const item = (key: string, quantity: string, price: string) => ({ key, values: { [ids.quantity]: quantity, [ids.price]: price }, choices: {} });
  const draft = (values: Record<string, string>, items = [item("a", "12", "850,00"), item("b", "1", "5100")]): EntryDraft =>
    ({ values, choices: {}, files: {}, rows: { [ids.block]: items } });

  it("computes each item's calculation and the sum of the block over all the items, with what is loaded", () => {
    const result = entryCalculations(entry, draft({ [ids.freight]: "100" }), new Set());
    expect(result.items).toEqual({ a: { [ids.amount]: "10200.00" }, b: { [ids.amount]: "5100" } });
    expect(result.values[ids.total]).toBe("15400.00");
  });

  it("leaves empty what has no values, and a sum adds only what there is", () => {
    const result = entryCalculations(entry, draft({}, [item("a", "12", ""), item("b", "", "")]), new Set());
    expect(result.items).toEqual({ a: {}, b: {} });
    expect(result.values[ids.total]).toBeUndefined();
    expect(entryCalculations(entry, draft({ [ids.freight]: "7,5" }, [item("a", "", "")]), new Set()).values[ids.total]).toBe("7.5");
  });

  it("computes a rate chosen from a catalog with the value its option brings, and leaves it empty without one", () => {
    const option = { id: "00000000-0000-4000-8000-0000000000c1", title: "21 %", description: null };
    const result = entryCalculations(entry, { ...draft({ [ids.net]: "1000" }), choices: { [ids.rate]: [{ ...option, value: "21" }] } }, new Set());
    expect(result.values[ids.vat]).toBe("210");
    expect(entryCalculations(entry, { ...draft({ [ids.net]: "1000" }), choices: { [ids.rate]: [option] } }, new Set()).values[ids.vat]).toBeUndefined();
  });

  it("uses an earlier calculation's rounded result and ignores a hidden question and a value that is not a number", () => {
    const result = entryCalculations(entry, draft({ [ids.freight]: "1x", [ids.net]: "10" }), new Set([ids.client]));
    expect(result.values[ids.total]).toBe("15300.00");
    expect(result.values[ids.gross]).toBe("1530.00");
    expect(entryCalculations(entry, draft({ [ids.freight]: "100", [ids.net]: "10" }), new Set([ids.freight])).values[ids.total]).toBe("15300.00");
  });
});

describe("how a calculation reads (CA1-A)", () => {
  const words = {
    multiply: (first: string, second: string) => `${first} por ${second}`, percent: (base: string, rate: string) => `Porcentaje: ${rate} de ${base}`,
    sum: (questions: string) => `Suma de ${questions}`, allItems: (label: string) => `${label} de todos los ítems`,
    list: (items: readonly string[]) => new Intl.ListFormat("es", { type: "conjunction" }).format(items), missing: "…",
  };
  it("says the operation with the names of its questions, and «…» where one is missing", () => {
    expect(calculationFormula("multiply", [{ label: "Cantidad", allItems: false }, { label: "Precio", allItems: false }], words)).toBe("Cantidad por Precio");
    expect(calculationFormula("percent", [{ label: "Neto", allItems: false }, null], words)).toBe("Porcentaje: … de Neto");
    expect(calculationFormula("sum", [{ label: "Importe", allItems: true }, { label: "Flete", allItems: false }, { label: "Seguro", allItems: false }], words))
      .toBe("Suma de Importe de todos los ítems, Flete y Seguro");
    expect(calculationFormula("sum", [], words)).toBe("Suma de …");
  });

  it("names the questions of a draft and of a loaded form, a rate from a catalog too", () => {
    const amount = number("amount", "Importe", { repeated: true });
    const total = number("total", "Total", { calculation: { operation: "sum", operands: ["amount", "gone"] } });
    expect(draftFormulaOperands([block, amount, total], total, "es", "es")).toEqual([{ label: "Importe", allItems: true }, null]);
    const q = (fieldId: string, type: FormEntryQuestion["type"], extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion =>
      ({ fieldId, type, label: fieldId, help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra });
    const vat = q("vat", "decimal", { calculation: { operation: "percent", operands: ["net", "rate"] } });
    const entry = { questions: [q("net", "decimal"), q("rate", "choice", { catalog: { onlyOption: null, issue: null, missingData: null } }), vat] } as unknown as FormEntry;
    expect(entryFormulaOperands(entry, vat)).toEqual([{ label: "net", allItems: false }, { label: "rate", allItems: false }]);
  });
});
