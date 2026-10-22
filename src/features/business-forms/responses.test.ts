import { describe, expect, it } from "vitest";
import {
  normalizeResponseQuery,
  responseFilterLabels,
  receivedDateBoundary,
  replaceResponseCondition,
  responseValueText,
  selectedResponseChoices,
  responseFiles,
  visibleResponseColumns,
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
  expect(responseFilterLabels({ page: 1, pageSize: 20, conditions: [{ fieldId: "choice", operator: "in", values: ["private-choice"] }], search: "Notes" }, [column], key => key)).toEqual([{ key: "choice", label: "Mode: Visit" }, { key: "search", label: "responses.search: Notes" }]);
});

it("uses the supplied media type to label a document format", async()=>{ const {responseDocumentFormat}=await import("./responses");expect(responseDocumentFormat("application/pdf")).toBe("PDF");expect(responseDocumentFormat("text/plain")).toBe("TXT");expect(responseDocumentFormat("application/octet-stream")).toBeNull();});


it.each(["Received", "PendingApproval", "Approved", "Rejected"] as const)("keeps the private %s state filter during normalization and describes it with static translations", state => {
  const query = normalizeResponseQuery({ page: 1, pageSize: 20, state, search: "  visit  " }, []);
  expect(query).toMatchObject({ state, search: "visit" });
  expect(responseFilterLabels(query!, [], key => key)).toEqual([
    { key: "state", label: "approvals.state: approvals.states." + state },
    { key: "search", label: "responses.search: visit" },
  ]);
});
it("treats null or absent response state as no applied state filter", () => {
  const query = { page: 1, pageSize: 20, state: null };
  expect(normalizeResponseQuery(query, [])?.state).toBeNull();
  expect(responseFilterLabels(query, [], key => key)).toEqual([]);
  expect(responseFilterLabels({ page: 1, pageSize: 20 }, [], key => key)).toEqual([]);
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
  expect(responseFilterLabels(query, [column], key => key)[0].label).toBe("Faults: responses.anyOf Noise, Cold");
  expect(responseFilterLabels(query, [column], key => key)[0].label).not.toMatch(/noise|cold/);
});
