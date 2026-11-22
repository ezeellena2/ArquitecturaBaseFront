import { describe, expect, it } from "vitest";
import { parseSort, sortRows, startsDescending, toggledSort, type SortKind, type SortValue } from "./sort";

describe("the order of a table (OT1-C)", () => {
  it("reads the field and the direction from the URL value", () => {
    expect(parseSort("name")).toEqual({ field: "name", descending: false });
    expect(parseSort("-lastSubmittedAtUtc")).toEqual({ field: "lastSubmittedAtUtc", descending: true });
    expect(parseSort(undefined)).toBeUndefined();
    expect(parseSort("")).toBeUndefined();
  });

  it.each([
    ["text", false], ["state", false], ["number", true], ["date", true], ["yesNo", true],
  ] as const)("starts a %s column in its useful direction (descending: %s)", (kind: SortKind, descending) => {
    expect(startsDescending(kind)).toBe(descending);
    expect(toggledSort(undefined, "field", kind)).toBe(descending ? "-field" : "field");
    expect(toggledSort("-other", "field", kind)).toBe(descending ? "-field" : "field");
  });

  it("inverts the column that already orders, also when it is the usual order of the list", () => {
    expect(toggledSort("-responseCount", "responseCount", "number")).toBe("responseCount");
    expect(toggledSort("responseCount", "responseCount", "number")).toBe("-responseCount");
    expect(toggledSort("name", "name", "text")).toBe("-name");
  });
});

interface Row { id: string; name: string | null; count?: number | null; verified?: boolean }

const values: Record<string, (row: Row) => SortValue> = { name: row => row.name, count: row => row.count, verified: row => row.verified };
const ids = (rows: readonly Row[]) => rows.map(row => row.id);

describe("sortRows, the order of a whole list in the browser", () => {
  const rows: Row[] = [
    { id: "a", name: "Lote 10", count: 3 },
    { id: "b", name: null, count: null },
    { id: "c", name: "álamo", count: 3 },
    { id: "d", name: "Lote 2", count: 12 },
    { id: "e", name: "", count: undefined },
    { id: "f", name: "Árbol", count: 1 },
  ];

  it("orders text without case or accents and numbers inside it by their value, the empty ones last", () => {
    expect(ids(sortRows(rows, "name", values, "es"))).toEqual(["c", "f", "d", "a", "b", "e"]);
  });

  it("keeps the empty ones last in the other direction too", () => {
    expect(ids(sortRows(rows, "-name", values, "es"))).toEqual(["a", "d", "f", "c", "b", "e"]);
  });

  it("keeps the order in which the rows arrived for the same value, in both directions", () => {
    expect(ids(sortRows(rows, "-count", values, "es"))).toEqual(["d", "a", "c", "f", "b", "e"]);
    expect(ids(sortRows(rows, "count", values, "es"))).toEqual(["f", "a", "c", "d", "b", "e"]);
  });

  it("puts «Yes» first going down", () => {
    const answers: Row[] = [{ id: "no", name: "x", verified: false }, { id: "yes", name: "y", verified: true }];
    expect(ids(sortRows(answers, "-verified", values, "en"))).toEqual(["yes", "no"]);
  });

  it("leaves the list as it came without an order or with a field it cannot order", () => {
    expect(sortRows(rows, undefined, values, "es")).toBe(rows);
    expect(sortRows(rows, "-unknown", values, "es")).toBe(rows);
  });
});
