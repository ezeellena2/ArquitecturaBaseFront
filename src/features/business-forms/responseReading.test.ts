import { describe, expect, it } from "vitest";
import type { FormEntry, FormEntryQuestion } from "./api/entries";
import type { EntryDraft } from "./entryForm";
import type { ResponseChoice, ResponseItemValues } from "./responses";
import { readingBlockColumns, readingDatumText, readingGroupText, readingRows, readingZones, type ReadingField } from "./responseReading";

const id = (n: number) => "0199a0c0-0000-7000-8000-" + String(n).padStart(12, "0");
const question = (n: number, type: FormEntryQuestion["type"], label: string, extra: Partial<FormEntryQuestion> = {}): FormEntryQuestion => ({
  fieldId: id(n), type, label, help: null, required: false, maxLength: null, options: null, selection: null, files: null, catalog: null, ...extra,
});
const catalog = (extra: Partial<NonNullable<FormEntryQuestion["catalog"]>> = {}) => ({ onlyOption: null, issue: null, missingData: null, ...extra });
const field = (n: number, label: string, value: string, role: "data" | "filter" = "data") => ({ fieldId: id(n), label, type: "text" as const, role, value });
const choice = (n: number, label: string, fields?: ResponseChoice["fields"]): ResponseChoice => ({ choiceId: id(n), label, fields });

// «Pedido de prueba» (PED-000010): a condition, a list that depends on another answer (CW7), a block whose product is chosen first
// by its «Rubro» (LD1-A) and the photos.
const concept = question(1, "choice", "Concepto", { options: [{ id: id(50), label: "Productos" }, { id: id(51), label: "Servicios" }] });
const since = question(2, "date", "Período desde", { showWhen: { questionId: id(1), values: [id(51)] } });
const kind = question(3, "choice", "Tipo de artículo", { catalog: catalog() });
const article = question(4, "choice", "Artículo", { catalog: catalog({ dependsOn: [id(3)] }) });
const items = question(5, "group", "Artículos", { rows: { minRows: 0, maxRows: 10 } });
const product = question(6, "choice", "Producto", { repeated: true, catalog: catalog({ groupBy: { fieldId: id(91), name: "Rubro" } }) });
const quantity = question(7, "decimal", "Cantidad", { repeated: true });
const photos = question(8, "photo", "Fotos", { files: { minFiles: 0, maxFiles: 3, photoSource: null } });
const entry = { definitionId: id(100), versionId: id(101), versionNumber: 3, prefix: "PED", name: "Pedido de prueba", culture: "es", submitLabel: "Enviar",
  maxFileSizeMiB: 10, questions: [concept, since, kind, article, items, product, quantity, photos] } satisfies FormEntry;
const draft: EntryDraft = { values: {}, choices: { [id(1)]: [{ id: id(50), title: "Productos", description: null }] }, files: {} };

const herbicide = choice(60, "2 4 D 100%", [field(90, "Tipo", "Agroquímicos", "filter"), field(91, "Rubro", "Herbicidas")]);
const values = [
  { fieldId: id(1), key: "concept", type: "choice" as const, label: "Concepto", value: choice(50, "Productos") },
  { fieldId: id(2), key: "since", type: "date" as const, label: "Período desde", value: null },
  { fieldId: id(3), key: "kind", type: "choice" as const, label: "Tipo de artículo", value: choice(61, "Agroquímicos") },
  { fieldId: id(4), key: "article", type: "choice" as const, label: "Artículo", value: herbicide },
];
const fields = (all: readonly ReadingField[]) => all.map(item => item.kind === "question" ? item.question.label : item.datum.label);

describe("the reading of a response with the shape of its form (VF1-A)", () => {
  it("leaves out what its condition hides and puts each datum of an option in a field of its own after its question", () => {
    const zones = readingZones(entry, draft, values);

    expect(zones.map(zone => zone.key)).toEqual(["data", "files"]);
    // «Tipo» of the article is the answer «Tipo de artículo» (CW7): it is not repeated.
    expect(fields(zones[0].fields)).toEqual(["Concepto", "Tipo de artículo", "Artículo", "Artículo · Rubro", "Artículos"]);
    expect(zones[0].fields[3]).toMatchObject({ kind: "datum", datum: { key: id(4) + ":" + id(91), fieldId: id(91), question: article } });
    expect(fields(zones[1].fields)).toEqual(["Fotos"]);
  });

  it("adds a column per datum of the options chosen in the block, without the one chosen first", () => {
    const rows: ResponseItemValues[] = [
      { values: [{ fieldId: id(6), key: "product", type: "choice", label: "Producto", value: choice(60, "2 4 D 100%", [field(92, "Tipo", "Agroquímicos"), field(91, "Rubro", "Herbicidas")]) },
        { fieldId: id(7), key: "quantity", type: "decimal", label: "Cantidad", value: "2" }] },
      { values: [{ fieldId: id(6), key: "product", type: "choice", label: "Producto", value: choice(62, "RIMON", [field(91, "Rubro", "Insecticidas"), field(93, "Marca", "Adama")]) },
        { fieldId: id(7), key: "quantity", type: "decimal", label: "Cantidad", value: null }] },
    ];

    expect(fields(readingBlockColumns([product, quantity], rows))).toEqual(["Producto", "Producto · Tipo", "Producto · Marca", "Cantidad"]);
    expect(fields(readingBlockColumns([product, quantity], []))).toEqual(["Producto", "Cantidad"]);
  });

  it("keeps a question and its data in the same row, starting another when they do not fit", () => {
    const [data] = readingZones(entry, draft, values);

    expect(readingRows(data.fields, 3).map(fields)).toEqual([["Concepto", "Tipo de artículo"], ["Artículo", "Artículo · Rubro"], ["Artículos"]]);
    expect(readingRows(data.fields, 1).map(fields)).toEqual([["Concepto"], ["Tipo de artículo"], ["Artículo"], ["Artículo · Rubro"], ["Artículos"]]);
  });

  it("reads a datum as the values of the options chosen, by comma, in the language of the menu", () => {
    const priced = [choice(70, "Bidón", [{ fieldId: id(94), label: "Precio", type: "decimal", role: "data", value: "1500.5" }]),
      choice(71, "Caja", [{ fieldId: id(94), label: "Precio", type: "decimal", role: "data", value: "20" }])];

    expect(readingDatumText(priced, id(94), "es", "Sí", "No")).toBe("1.500,5, 20");
    expect(readingDatumText([herbicide], id(91), "es", "Sí", "No")).toBe("Herbicidas");
    expect(readingDatumText([herbicide], id(99), "es", "Sí", "No")).toBe("");
  });

  it("reads the field chosen first (LD1-A) from the option as it was saved, or from the draft without it", () => {
    expect(readingGroupText(product, [choice(60, "2 4 D 100%", [field(91, "Rubro", "Herbicidas")])], undefined, "es", "Sí", "No")).toBe("Herbicidas");
    expect(readingGroupText(product, [choice(60, "2 4 D 100%")], { id: "x", text: "Fungicidas" }, "es", "Sí", "No")).toBe("Fungicidas");
    expect(readingGroupText(product, [], undefined, "es", "Sí", "No")).toBe("");
  });
});
