// Synthetic DTOs of the sheet and the detail with a block of rows; the exported HTTP cohort is qualified separately at the final export.
import { describe, expect, it } from "vitest";
import { responseDetailSchema, responseSheetSchema } from "./responses";

const id = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const versionId = id(1);
const supplierId = id(9);
const groupId = id(10);
const itemId = id(11);
const quantityId = id(12);
const seed = { choiceId: id(20), label: "Semilla" };
const question = (fieldId: string, type: string, label: string) => ({ fieldId, type, label, introducedInVersion: 1, options: [] });
const block = (extra: Record<string, unknown> = {}) => ({ ...question(groupId, "group", "Artículos"),
  questions: [question(itemId, "choice", "Artículo"), question(quantityId, "decimal", "Cantidad")], ...extra });
const cell = (fieldId: string, type: string, state: string, value: unknown) => ({ fieldId, type, state, value });
const items = () => [
  { cells: [cell(itemId, "choice", "Answered", seed), cell(quantityId, "decimal", "Answered", "200.5")] },
  { cells: [cell(itemId, "choice", "Answered", seed), cell(quantityId, "decimal", "Unanswered", null)] },
];
const record = (blockCell: unknown, n: number) => ({ id: id(100 + n), versionId, versionNumber: 1, number: "REC-00000" + n,
  submittedAtUtc: "2026-11-07T12:00:00Z", actor: { userId: id(5), displayName: "Persona" }, channel: "app", state: "Received", hasPdf: false,
  cells: [cell(supplierId, "shortText", "Answered", "Proveedor del norte"), blockCell] });
const sheet = (cells: unknown[], columns: unknown[] = [question(supplierId, "shortText", "Proveedor"), block()]) => ({
  definitionId: id(2), name: "Recepción", prefix: "REC", activeVersionNumber: 1, hasApproval: false, columns,
  versions: [{ id: versionId, number: 1 }],
  records: { items: cells.map((blockCell, index) => record(blockCell, index + 1)), page: 1, pageSize: 20, totalCount: cells.length,
    totalPages: 1, hasPrevious: false, hasNext: false },
});

describe("a block of rows in the sheet", () => {
  it("reads its column with its questions and its cells by item, without items or not asked", () => {
    const parsed = responseSheetSchema.parse(sheet([cell(groupId, "group", "Answered", items()), cell(groupId, "group", "Unanswered", []),
      cell(groupId, "group", "NotAsked", null)]));

    expect(parsed.columns[1].questions?.map(column => column.fieldId)).toEqual([itemId, quantityId]);
    expect(parsed.columns[0].questions).toBeUndefined();
    expect(parsed.records.items.map(row => row.cells[1].state)).toEqual(["Answered", "Unanswered", "NotAsked"]);
  });

  it.each([
    ["a block without its questions", () => sheet([cell(groupId, "group", "NotAsked", null)], [question(supplierId, "shortText", "Proveedor"), question(groupId, "group", "Artículos")])],
    ["questions outside a block", () => sheet([cell(groupId, "group", "NotAsked", null)],
      [{ ...question(supplierId, "shortText", "Proveedor"), questions: [question(itemId, "choice", "Artículo")] }, block()])],
    ["a question of a block of a type that does not go in one", () => sheet([cell(groupId, "group", "NotAsked", null)],
      [question(supplierId, "shortText", "Proveedor"), block({ questions: [question(itemId, "photo", "Foto")] })])],
    ["a block with options", () => sheet([cell(groupId, "group", "NotAsked", null)],
      [question(supplierId, "shortText", "Proveedor"), block({ options: [{ id: id(30), label: "Una" }] })])],
    ["an item with a cell of another question", () => sheet([cell(groupId, "group", "Answered",
      [{ cells: [cell(itemId, "choice", "Answered", seed), cell(id(13), "decimal", "Answered", "1")] }])])],
    ["an item without one of the questions", () => sheet([cell(groupId, "group", "Answered", [{ cells: [cell(itemId, "choice", "Answered", seed)] }])])],
    ["an item with a cell of another type", () => sheet([cell(groupId, "group", "Answered",
      [{ cells: [cell(itemId, "choice", "Answered", seed), cell(quantityId, "shortText", "Answered", "1")] }])])],
    ["an answered block without items", () => sheet([cell(groupId, "group", "Answered", [])])],
    ["a block not asked with items", () => sheet([cell(groupId, "group", "NotAsked", items())])],
  ])("rejects %s", (_, body) => expect(responseSheetSchema.safeParse(body()).success).toBe(false));
});

describe("a block of rows in the detail", () => {
  const value = (fieldId: string, type: string, label: string, answer: unknown) => ({ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type, label, value: answer });
  const detail = (blockValue: unknown) => ({ id: id(101), definitionId: id(2), versionId, versionNumber: 1, number: "REC-000001", name: "Recepción",
    submittedAtUtc: "2026-11-07T12:00:00Z", actor: { userId: id(5), displayName: "Persona" }, channel: "app", origin: null, assistance: null, chain: [],
    values: [value(supplierId, "shortText", "Proveedor", "Proveedor del norte"), blockValue], history: [] });
  const answers = () => [
    { values: [value(itemId, "choice", "Artículo", seed), value(quantityId, "decimal", "Cantidad", "200.5")] },
    { values: [value(itemId, "choice", "Artículo", seed), value(quantityId, "decimal", "Cantidad", null)] },
  ];

  it("reads the items with every question of the block, and a block without items", () => {
    const parsed = responseDetailSchema.parse(detail(value(groupId, "group", "Artículos", answers())));

    expect(parsed.values[1].type).toBe("group");
    expect(responseDetailSchema.parse(detail(value(groupId, "group", "Artículos", []))).values[1].value).toEqual([]);
  });

  it.each([
    ["a block that is not a list of items", () => detail(value(groupId, "group", "Artículos", "3"))],
    ["an item with a question of a type that does not go in a block", () => detail(value(groupId, "group", "Artículos",
      [{ values: [value(itemId, "photo", "Foto", [])] }]))],
    ["a block in place of an answer", () => detail(value(quantityId, "decimal", "Cantidad", answers()))],
  ])("rejects %s", (_, body) => expect(responseDetailSchema.safeParse(body()).success).toBe(false));
});
