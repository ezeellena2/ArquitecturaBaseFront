import { describe, expect, it } from "vitest";
import {
  normalizeResponseQuery,
  responseFilterLabels,
  receivedDateBoundary,
  replaceResponseCondition,
  responseValueText,
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
