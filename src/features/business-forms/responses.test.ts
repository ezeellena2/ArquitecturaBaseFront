import { describe, expect, it } from "vitest";
import {
  normalizeResponseQuery,
  responseFilterLabels,
  ruleConditionSummaries,
  receivedDateBoundary,
  replaceResponseCondition,
  responseValueText,
  selectedResponseChoices,
  responseFiles,
  responseRowsSummary,
  visibleResponseColumns,
  responseCatalogColumnId,
  responseColumnSortKind,
  responseResultColumnId,
  responseSortFromParams,
  responseSortParams,
  responseTableSort,
  type ResponseCatalogField,
  type ResponseColumn,
  type ResponseCell,
} from "./responses";
describe("response presentation", () => {
  it("distinguishes a missing question, an empty answer, zero and false", () => {
    const cell: ResponseCell = {
      fieldId: "a",
      type: "shortText",
      state: "NotAsked",
      value: null,
    };
    expect(responseValueText(cell, "Sin respuesta", "Sí", "No")).toBe("—");
    expect(
      responseValueText(
        { ...cell, state: "Unanswered" },
        "Sin respuesta",
        "Sí",
        "No",
      ),
    ).toBe("Sin respuesta");
    expect(
      responseValueText(
        { ...cell, state: "Answered", type: "decimal", value: "0" },
        "Sin respuesta",
        "Sí",
        "No",
      ),
    ).toBe("0");
    expect(
      responseValueText(
        { ...cell, state: "Answered", type: "boolean", value: false },
        "Sin respuesta",
        "Sí",
        "No",
      ),
    ).toBe("No");
  });
  it("preserves current column order and allows hiding all question columns", () => {
    const columns = ["a", "b", "c"].map(
      (fieldId) =>
        ({
          fieldId,
          label: fieldId,
          type: "shortText",
          introducedInVersion: 1,
          options: [],
        }) satisfies ResponseColumn,
    );
    expect(visibleResponseColumns(columns, null)).toEqual(columns);
    expect(
      visibleResponseColumns(columns, "c,a,unknown").map(
        (column) => column.fieldId,
      ),
    ).toEqual(["a", "c"]);
    expect(visibleResponseColumns(columns, "")).toEqual([]);
  });
});

describe("response filters", () => {
  const columns: ResponseColumn[] = [
    { fieldId: "number", type: "decimal", label: "Number", introducedInVersion: 1, options: [] },
    { fieldId: "text", type: "longText", label: "Text", introducedInVersion: 1, options: [] },
  ];
  it("normalizes decimal commas and trims text before applying or counting", () => {
    expect(normalizeResponseQuery({ page: 1, pageSize: 20, conditions: [
      { fieldId: "number", operator: "gte", values: ["12,5"] },
      { fieldId: "text", operator: "contains", values: ["  visit  "] },
    ] }, columns)).toMatchObject({ conditions: [
      { fieldId: "number", operator: "gte", values: ["12.5"] },
      { fieldId: "text", operator: "contains", values: ["visit"] },
    ] });
    expect(normalizeResponseQuery({ page: 1, pageSize: 20, conditions: [
      { fieldId: "text", operator: "contains", values: ["   "] },
    ] }, columns)?.conditions).toEqual([]);
  });
  it.each(["12,", "-", "1.2.3"])("does not send an incomplete or invalid decimal %s", value => {
    expect(normalizeResponseQuery({ page: 1, pageSize: 20, conditions: [
      { fieldId: "number", operator: "gte", values: [value] },
    ] }, columns)).toBeNull();
  });
  it("converts received calendar dates in the account zone, including DST, into an exclusive upper boundary", () => {
    expect(
      receivedDateBoundary("2026-10-16", "America/Argentina/Buenos_Aires"),
    ).toBe("2026-10-16T03:00:00.000Z");
    expect(receivedDateBoundary("2026-03-08", "America/New_York")).toBe(
      "2026-03-08T05:00:00.000Z",
    );
    expect(receivedDateBoundary("2026-03-08", "America/New_York", true)).toBe(
      "2026-03-09T04:00:00.000Z",
    );
  });
  it("replaces a condition without dropping other bounds and removes cleared values", () => {
    const original = [
      { fieldId: "a", operator: "gte", values: ["10"] },
      { fieldId: "a", operator: "lte", values: ["20"] },
    ];
    expect(replaceResponseCondition(original, "a", "gte", ["12"])).toEqual([
      original[1],
      { fieldId: "a", operator: "gte", values: ["12"] },
    ]);
    expect(replaceResponseCondition(original, "a", "gte", [])).toEqual([
      original[1],
    ]);
  });
});

it("describes the applied values without exposing option IDs", () => {
  const column: ResponseColumn = { fieldId: "choice", type: "choice", label: "Mode", options: [{ id: "private-choice", label: "Visit" }], introducedInVersion: 1 };
  expect(responseFilterLabels({ page: 1, pageSize: 20, conditions: [{ fieldId: "choice", operator: "in", values: ["private-choice"] }], search: "Notes" }, [column], key => key, "es")).toEqual([{ key: "choice", label: "Mode: Visit" }, { key: "search", label: "responses.search: Notes" }]);
});

// PL2-A: the column of a catalog question has no options, so its chip, like «Cargó», uses the name remembered when it was chosen.
it("describes a catalog option and the person with the names remembered when they were chosen", () => {
  const column: ResponseColumn = { fieldId: "article", type: "choice", label: "Artículo", options: [], introducedInVersion: 1 };
  const query = { page: 1, pageSize: 20, conditions: [{ fieldId: "article", operator: "in", values: ["glyphosate"] }], actorIds: ["ana"], versionIds: ["v3"] };
  expect(responseFilterLabels(query, [column], key => key, "es", "UTC", [{ id: "v3", number: 3 }], { glyphosate: "Glifosato 48%", ana: "Ana Pérez" })).toEqual([
    { key: "article", label: "Artículo: Glifosato 48%" },
    { key: "actor", label: "responses.actor: Ana Pérez" },
    { key: "version", label: "responses.version: 3" },
  ]);
});

it("describes decimal and date conditions and the received range with the shared format", () => {
  const columns: ResponseColumn[] = [{ fieldId: "amount", type: "decimal", label: "Amount", options: [], introducedInVersion: 1 }, { fieldId: "visit", type: "date", label: "Visit", options: [], introducedInVersion: 1 }];
  const conditions = [{ fieldId: "amount", operator: "gte", values: ["1500.5"] }, { fieldId: "visit", operator: "lte", values: ["2027-03-15"] }];
  expect(responseFilterLabels({ page: 1, pageSize: 20, conditions }, columns, key => key, "es")).toEqual([{ key: "amount", label: "Amount: responses.from 1.500,5" }, { key: "visit", label: "Visit: responses.to 15/03/2027" }]);
  expect(responseFilterLabels({ page: 1, pageSize: 20, receivedFromUtc: "2026-10-16T03:00:00.000Z" }, [], key => key, "es", "America/Argentina/Buenos_Aires")).toEqual([{ key: "received", label: "responses.received · 16/10/2026 – …" }]);
});

// EX2-A: a question of the block says its block at the end, with the words of the «Filtros» panel, in the chips and in the export.
it("ends the filter of a question of the block with the block it belongs to, after its values or its range", () => {
  const status: ResponseColumn = { fieldId: "status", type: "choice", label: "Estado", options: [{ id: "damaged", label: "Dañado" }, { id: "good", label: "Bueno" }], introducedInVersion: 1 };
  const quantity: ResponseColumn = { fieldId: "quantity", type: "decimal", label: "Cantidad", options: [], introducedInVersion: 1 };
  const block: ResponseColumn = { fieldId: "items", type: "group", label: "Artículos", options: [], introducedInVersion: 1, questions: [status, quantity] };
  const supplier: ResponseColumn = { fieldId: "supplier", type: "shortText", label: "Proveedor", options: [], introducedInVersion: 1 };
  const t = (key: string, options?: Record<string, unknown>) => key === "responses.inAnyItem" ? `en algún ítem de ${String(options?.block)}` : key === "responses.from" ? "desde" : key;
  const conditions = [
    { fieldId: "status", operator: "in", values: ["damaged", "good"] },
    { fieldId: "quantity", operator: "gte", values: ["100"] },
    { fieldId: "supplier", operator: "contains", values: ["Norte"] },
  ];

  expect(responseFilterLabels({ page: 1, pageSize: 20, conditions }, [supplier, block], t, "es").map(item => item.label)).toEqual([
    "Estado: Dañado, Bueno (en algún ítem de Artículos)",
    "Cantidad: desde 100 (en algún ítem de Artículos)",
    "Proveedor: responses.contains Norte",
  ]);
});

it("describes a decimal condition typed with a comma, a plus sign or leading zeros like its canonical value", () => {
  const columns: ResponseColumn[] = [{ fieldId: "amount", type: "decimal", label: "Amount", options: [], introducedInVersion: 1 }];
  const label = (value: string) => responseFilterLabels({ page: 1, pageSize: 20, conditions: [{ fieldId: "amount", operator: "gte", values: [value] }] }, columns, key => key, "es")[0].label;
  expect(label(" 1500,5 ")).toBe("Amount: responses.from 1.500,5");
  expect(label("+1500")).toBe("Amount: responses.from 1.500");
  expect(label("-01500,50")).toBe("Amount: responses.from -1.500,50");
  expect(label("1500.5")).toBe("Amount: responses.from 1.500,5");
  expect(label("12,")).toBe("Amount: responses.from 12,");
});

it("describes a yes/no condition with the shared yes and no labels", () => {
  const column: ResponseColumn = { fieldId: "paid", type: "boolean", label: "Paid", options: [], introducedInVersion: 1 };
  expect(responseFilterLabels({ page: 1, pageSize: 20, conditions: [{ fieldId: "paid", operator: "in", values: ["true", "false"] }] }, [column], key => key, "es")).toEqual([{ key: "paid", label: "Paid: responses.yes, responses.no" }]);
});



it.each(["Received", "PendingApproval", "Approved", "Rejected"] as const)("keeps the private %s state filter during normalization and describes it with static translations", state => {
  const query = normalizeResponseQuery({ page: 1, pageSize: 20, state, search: "  visit  " }, []);
  expect(query).toMatchObject({ state, search: "visit" });
  expect(responseFilterLabels(query!, [], key => key, "es")).toEqual([
    { key: "state", label: "approvals.state: approvals.states." + state },
    { key: "search", label: "responses.search: visit" },
  ]);
});
it("treats null or absent response state as no applied state filter", () => {
  const query = { page: 1, pageSize: 20, state: null };
  expect(normalizeResponseQuery(query, [])?.state).toBeNull();
  expect(responseFilterLabels(query, [], key => key, "es")).toEqual([]);
  expect(responseFilterLabels({ page: 1, pageSize: 20 }, [], key => key, "es")).toEqual([]);
});


it("keeps the historical choice label without a current catalog", () => {
  const value = Object.freeze({ choiceId: "historic-option", label: "Sucursal histórica", catalogId: "historic-catalog", catalogName: "Sucursales anteriores", detail: "Detalle capturado" });
  const cell: ResponseCell = { fieldId: "branch", type: "choice", state: "Answered", value };
  expect(responseValueText(cell, "Sin respuesta", "Sí", "No")).toBe("Sucursal histórica");
});


describe("selected response choices", () => {
  const choice = Object.freeze({ choiceId: "historic-option", label: "Sucursal histórica", catalogId: "historic-catalog", catalogName: "Sucursales anteriores", detail: "Detalle capturado" });
  const cell: ResponseCell = { fieldId: "branch", type: "choice", state: "Answered", value: choice };

  it("keeps the captured option and its historical metadata without resolving the current catalog", () => {
    expect(selectedResponseChoices(cell)).toEqual([choice]);
    expect(selectedResponseChoices(cell)[0]).toBe(choice);
    expect(responseValueText(cell, "Sin respuesta", "Sí", "No")).toBe("Sucursal histórica");
    expect(choice).toEqual({ choiceId: "historic-option", label: "Sucursal histórica", catalogId: "historic-catalog", catalogName: "Sucursales anteriores", detail: "Detalle capturado" });
  });

  it.each(["NotAsked", "Unanswered"] as const)("keeps %s separate from selected options", state => {
    expect(selectedResponseChoices({ ...cell, state, value: null })).toEqual([]);
    expect(responseValueText({ ...cell, state, value: null }, "Sin respuesta", "Sí", "No")).toBe(state === "NotAsked" ? "—" : "Sin respuesta");
  });

  it.each<ResponseCell>([
    { ...cell, value: null },
    { fieldId: "zero", type: "decimal", state: "Answered", value: "0" },
    { fieldId: "no", type: "boolean", state: "Answered", value: false },
    { fieldId: "photo", type: "photo", state: "Answered", value: [{ fileId: "photo", name: "Visita.jpg", contentType: "image/jpeg", size: 4, hasThumbnail: true }] },
    { fieldId: "document", type: "document", state: "Answered", value: [{ fileId: "document", name: "Visita.pdf", contentType: "application/pdf", size: 4, hasThumbnail: false }] },
  ])("does not interpret a scalar, absent value or file list as options: $fieldId", value => {
    expect(selectedResponseChoices(value)).toEqual([]);
  });
});



it("uses the captured multi-choice order for cell text and preserves the option objects", () => {
  const cold = Object.freeze({ choiceId: "cold", label: "Frío", catalogName: "Fallas históricas", detail: "Detalle original" });
  const noise = Object.freeze({ choiceId: "noise", label: "Ruido" });
  const values = [noise, cold];
  const cell: ResponseCell = { fieldId: "faults", type: "multiChoice", state: "Answered", value: values };
  expect(selectedResponseChoices(cell)).toBe(values);
  expect(selectedResponseChoices(cell)[0]).toBe(noise);
  expect(responseValueText(cell, "Sin respuesta", "Sí", "No")).toBe("Ruido, Frío");
  expect(selectedResponseChoices({ ...cell, state: "Unanswered", value: [] })).toEqual([]);
  expect(responseValueText({ ...cell, state: "Unanswered", value: [] }, "Sin respuesta", "Sí", "No")).toBe("Sin respuesta");
  expect(responseValueText({ ...cell, state: "NotAsked", value: null }, "Sin respuesta", "Sí", "No")).toBe("—");
});

it("keeps option arrays out of file readers and formats multi-choice filter labels without IDs", () => {
  const option = { choiceId: "cold", label: "Cold" };
  const file = { fileId: "file", name: "private.pdf", contentType: "application/pdf", size: 10, hasThumbnail: false };
  const multiple: ResponseCell = { fieldId: "faults", type: "multiChoice", state: "Answered", value: [option] };
  expect(responseFiles(multiple)).toEqual([]);
  expect(responseFiles({ ...multiple, type: "document", value: [file] })).toEqual([file]);
  expect(selectedResponseChoices({ ...multiple, type: "document", value: [file] })).toEqual([]);
  const column: ResponseColumn = { fieldId: "faults", type: "multiChoice", label: "Faults", options: [{ id: "cold", label: "Cold" }, { id: "noise", label: "Noise" }], introducedInVersion: 1 };
  const query = { page: 1, pageSize: 20, conditions: [{ fieldId: "faults", operator: "anyOf", values: ["noise", "cold"] }] };
  expect(responseFilterLabels(query, [column], key => key, "es")[0].label).toBe("Faults: responses.anyOf Noise, Cold");
  expect(responseFilterLabels(query, [column], key => key, "es")[0].label).not.toMatch(/noise|cold/);
});

// TL2-A: a rule reads «Hectáreas aplicadas desde 50», with the question and the value apart so each can be bold.
it("splits a rule condition into its question, its words and its values", () => {
  const columns: ResponseColumn[] = [
    { fieldId: "mode", type: "choice", label: "Mode", options: [{ id: "visit", label: "Visit" }, { id: "call", label: "Call" }], introducedInVersion: 1 },
    { fieldId: "amount", type: "decimal", label: "Amount", options: [], introducedInVersion: 1 },
    { fieldId: "faults", type: "multiChoice", label: "Faults", options: [{ id: "cold", label: "Cold" }, { id: "noise", label: "Noise" }], introducedInVersion: 1 },
    { fieldId: "paid", type: "boolean", label: "Paid", options: [], introducedInVersion: 1 },
    { fieldId: "notes", type: "longText", label: "Notes", options: [], introducedInVersion: 1 },
  ];
  const conditions = [
    { fieldId: "mode", operator: "in", values: ["visit", "call"] },
    { fieldId: "amount", operator: "gte", values: ["1500.5"] }, { fieldId: "amount", operator: "lte", values: ["+2000"] },
    { fieldId: "faults", operator: "anyOf", values: ["noise", "cold"] },
    { fieldId: "paid", operator: "in", values: ["true"] },
    { fieldId: "notes", operator: "answered", values: null },
    { fieldId: "gone", operator: "in", values: ["old"] },
  ];
  expect(ruleConditionSummaries(conditions, columns, key => key, "es")).toEqual([
    { key: "mode", question: "Mode", clauses: [{ words: "rules.conditionWords.in", values: "Visit rules.conditionWords.or Call" }] },
    { key: "amount", question: "Amount", clauses: [{ words: "rules.conditionWords.gte", values: "1.500,5" }, { words: "rules.conditionWords.lte", values: "2.000" }] },
    { key: "faults", question: "Faults", clauses: [{ words: "rules.conditionWords.anyOf", values: "Noise, Cold" }] },
    { key: "paid", question: "Paid", clauses: [{ words: "rules.conditionWords.in", values: "responses.yes" }] },
    { key: "notes", question: "Notes", clauses: [{ words: "rules.conditionWords.answered", values: "" }] },
    { key: "gone", question: "", clauses: [{ words: "rules.conditionWords.in", values: "old" }] },
  ]);
});
describe("a block of rows", () => {
  const answered = (fieldId: string, value: string): ResponseCell => ({ fieldId, type: "shortText", state: "Answered", value });
  it("counts its items, also those that left a question unanswered (UD4)", () => {
    const cell: ResponseCell = { fieldId: "block", type: "group", state: "Answered", value: [
      { cells: [answered("item", "GLIFOSATO 64%"), answered("quantity", "200")] },
      { cells: [{ fieldId: "item", type: "shortText", state: "Unanswered", value: null }, answered("quantity", "7")] },
      { cells: [{ fieldId: "old", type: "shortText", state: "NotAsked", value: null }, answered("item", "UREA GRANULADA")] },
    ] };

    expect(responseRowsSummary(cell)).toEqual({ count: 3 });
    expect(responseRowsSummary({ ...cell, state: "Unanswered", value: [] })).toBeNull();
    expect(responseRowsSummary(answered("text", "Sólo texto"))).toBeNull();
  });
  it("normalizes and names a condition on a question of the block like any other, ending with its block (EX2-A)", () => {
    const columns: ResponseColumn[] = [{ fieldId: "block", type: "group", label: "Artículos", introducedInVersion: 1, options: [],
      questions: [{ fieldId: "quantity", type: "decimal", label: "Cantidad", introducedInVersion: 1, options: [] }] }];
    const t = (key: string, options?: Record<string, unknown>) => key === "responses.inAnyItem" ? `en algún ítem de ${String(options?.block)}`
      : ({ "responses.from": "desde" } as Record<string, string>)[key] ?? key;

    expect(normalizeResponseQuery({ page: 1, pageSize: 20, conditions: [{ fieldId: "quantity", operator: "gte", values: ["12,5"] }] }, columns)?.conditions)
      .toEqual([{ fieldId: "quantity", operator: "gte", values: ["12.5"] }]);
    expect(responseFilterLabels({ page: 1, pageSize: 20, conditions: [{ fieldId: "quantity", operator: "gte", values: ["200"] }] }, columns, t, "es"))
      .toEqual([{ key: "quantity", label: "Cantidad: desde 200 (en algún ítem de Artículos)" }]);
  });
});
describe("the conditions of a block of rows in a rule", () => {
  const columns: ResponseColumn[] = [
    { fieldId: "remito", type: "shortText", label: "Remito", introducedInVersion: 1, options: [] },
    { fieldId: "items", type: "group", label: "Artículos", introducedInVersion: 1, options: [], questions: [
      { fieldId: "article", type: "choice", label: "Artículo", introducedInVersion: 1, options: [{ id: "glifo", label: "GLIFOSATO 64%" }] },
      { fieldId: "quantity", type: "decimal", label: "Cantidad", introducedInVersion: 1, options: [] },
      { fieldId: "notes", type: "longText", label: "Observaciones", introducedInVersion: 1, options: [] },
    ] },
  ];
  const t = (key: string) => key;
  const article = { key: "article", question: "Artículo", clauses: [{ words: "rules.conditionWords.in", values: "GLIFOSATO 64%" }] };
  it("read in one line under the block, since one same item meets them", () => {
    expect(ruleConditionSummaries([{ fieldId: "article", operator: "in", values: ["glifo"] }], columns, t, "es"))
      .toEqual([{ key: "items", block: "Artículos", questions: [article] }]);
  });
  it("keep that line in the place of the first one, apart from the others, and leave presence apart since it looks at the whole response", () => {
    expect(ruleConditionSummaries([
      { fieldId: "article", operator: "in", values: ["glifo"] },
      { fieldId: "remito", operator: "contains", values: ["0003"] },
      { fieldId: "quantity", operator: "gte", values: ["100"] },
      { fieldId: "notes", operator: "answered", values: [] },
    ], columns, t, "es")).toEqual([
      { key: "items", block: "Artículos", questions: [article, { key: "quantity", question: "Cantidad", clauses: [{ words: "rules.conditionWords.gte", values: "100" }] }] },
      { key: "remito", question: "Remito", clauses: [{ words: "rules.conditionWords.contains", values: "0003" }] },
      { key: "notes", question: "Observaciones", clauses: [{ words: "rules.conditionWords.answered", values: "" }] },
    ]);
  });
});
// OT1-C (F8): every column of the sheet with one datum orders in the server. The table names a column by its id; the address and
// the requests carry the server's field and the ids of a question, a field of its catalog or a result.
describe("the order of the sheet", () => {
  const question = "0199a0c0-0000-7000-8000-000000000031", field = "0199a0c0-0000-7000-8000-000000000081";
  const params = (search: string) => new URLSearchParams(search);
  it.each([
    ["sort=submittedAtUtc", { sort: "submittedAtUtc" }],
    ["sort=-corrected", { sort: "-corrected" }],
    ["sort=channel&sortFieldId=" + question, { sort: "channel" }],
    ["sort=-field&sortFieldId=" + question, { sort: "-field", sortFieldId: question }],
    ["sort=catalogField&sortFieldId=" + question + "&sortCatalogFieldId=" + field, { sort: "catalogField", sortFieldId: question, sortCatalogFieldId: field }],
    ["sort=-result&sortResultId=arca.invoice.total", { sort: "-result", sortResultId: "arca.invoice.total" }],
  ])("reads %s with only the ids its field needs", (search, expected) => {
    expect(responseSortFromParams(params(search))).toEqual(expected);
  });
  it.each(["", "sort=secret", "sort=field", "sort=field&sortFieldId=Importe", "sort=catalogField&sortFieldId=" + question,
    "sort=result&sortResultId=Total", "sort=-result&sortResultId=arca.invoice.total;drop"])("goes back to the newest number first with %s", search => {
    expect(responseSortFromParams(params(search))).toEqual({ sort: "-number" });
  });
  it("names the order by the column of the table and goes back to the address with the same ids", () => {
    const orders = [
      [{ sort: "-number" }, "-number"],
      [{ sort: "rules" }, "rules"],
      [{ sort: "-field", sortFieldId: question }, "-" + question],
      [{ sort: "catalogField", sortFieldId: question, sortCatalogFieldId: field }, responseCatalogColumnId(question, field)],
      [{ sort: "-result", sortResultId: "arca.invoice.total" }, "-" + responseResultColumnId("arca.invoice.total")],
    ] as const;
    for (const [query, table] of orders) {
      expect(responseTableSort(query)).toBe(table);
      expect(responseSortParams(table)).toEqual({ sortFieldId: undefined, sortCatalogFieldId: undefined, sortResultId: undefined, ...query });
    }
    expect(responseTableSort({ sort: "field" })).toBeUndefined();
  });
  it("orders a question by its type and a field of the catalog of a question of one option, never one with several values", () => {
    const column = (type: ResponseColumn["type"]): ResponseColumn => ({ fieldId: question, type, label: "Pregunta", introducedInVersion: 1, options: [] });
    const kinds = (["shortText", "longText", "choice", "decimal", "date", "boolean", "photo", "document", "multiChoice", "group", "location"] as const)
      .map(type => responseColumnSortKind(column(type)));
    expect(kinds).toEqual(["text", "text", "text", "number", "date", "yesNo", "number", "number", null, null, null]);
    const catalogField = (type: ResponseCatalogField["type"]): ResponseCatalogField => ({ fieldId: field, key: "dato", label: "Dato", type, role: "data" });
    expect((["text", "integer", "decimal", "date", "boolean", "catalog"] as const).map(type => responseColumnSortKind(column("choice"), catalogField(type))))
      .toEqual(["text", "number", "number", "date", "yesNo", "text"]);
    expect(responseColumnSortKind(column("multiChoice"), catalogField("integer"))).toBeNull();
  });
});
