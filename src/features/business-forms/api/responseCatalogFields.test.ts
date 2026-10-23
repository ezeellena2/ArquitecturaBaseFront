import { expect, it } from "vitest";
import { responseCellSchema, responseDetailSchema, responseSheetSchema } from "./responses";
import { responseDetailFixture, responseSheetFixture } from "@/test/responseFixtures";

const id = (number: number) => "01990000-0000-7000-8000-" + String(number).padStart(12, "0");
const empty = "00000000-0000-0000-0000-000000000000";
const metadata = (number: number) => ({ fieldId: id(number), key: "extra_" + number, label: "Dato histórico " + number, type: "text", role: "data" });
const sealed = (number: number, type = "text", value = "Dato histórico") => ({ fieldId: id(number), label: "Dato histórico " + number, type, role: "data", value });
const option = (fields?: unknown) => ({ choiceId: id(1), label: "Proveedor histórico", catalogId: id(2), ...(fields === undefined ? {} : { fields }) });
const cell = (fields?: unknown) => ({ fieldId: id(3), type: "choice", state: "Answered", value: option(fields) });
function sheet(fields: unknown, type = "choice") {
  const original = responseSheetFixture();
  return { ...original, columns: [{ fieldId: id(3), label: "Proveedor", type, introducedInVersion: 1, options: [], fields }], records: { ...original.records, items: [], totalCount: 0, totalPages: 0, hasNext: false, hasPrevious: false } };
}

it("reads exact sealed values in the sheet and detail without rounding or formatting them", () => {
  const fields = [sealed(10, "integer", "999999999999999999"), sealed(11, "decimal", "9007199254740993.0123"), sealed(12, "date", "2028-02-29"), sealed(13, "boolean", "false"), { ...sealed(14, "catalog", id(80)), role: "filter", text: "Zona histórica" }, sealed(15)];
  expect(responseCellSchema.parse(cell(fields)).value).toEqual(option(fields));
  const detail = { ...responseDetailFixture(), values: [{ fieldId: id(3), key: "provider", type: "choice", label: "Proveedor", value: option(fields) }] };
  expect(responseDetailSchema.parse(detail).values[0]?.value).toEqual(option(fields));
});
it("accepts more than twenty historical column definitions while each choice keeps at most twenty fields", () => {
  const fields = Array.from({ length: 25 }, (_, index) => metadata(index + 10));
  expect(responseSheetSchema.parse(sheet(fields)).columns[0]?.fields).toEqual(fields);
  expect(responseCellSchema.safeParse(cell(Array.from({ length: 20 }, (_, index) => sealed(index + 10)))).success).toBe(true);
  expect(responseCellSchema.safeParse(cell(Array.from({ length: 21 }, (_, index) => sealed(index + 10)))).success).toBe(false);
});
it("keeps older references without inventing fields and rejects null instead of omitted metadata", () => {
  expect(responseCellSchema.parse(cell()).value).toEqual(option());
  expect(responseCellSchema.safeParse(cell(null)).success).toBe(false);
  expect(responseSheetSchema.safeParse(sheet(null)).success).toBe(false);
});
it("rejects unknown, duplicate or empty field identities and misplaced metadata", () => {
  for (const fields of [[{ ...metadata(10), fieldId: empty }], [metadata(10), metadata(10)], [{ ...metadata(10), type: "number" }], [{ ...metadata(10), role: "private" }], [{ ...metadata(10), privateValue: "secret" }]]) expect(responseSheetSchema.safeParse(sheet(fields)).success).toBe(false);
  expect(responseSheetSchema.safeParse(sheet([metadata(10)], "shortText")).success).toBe(false);
  for (const fields of [[{ ...sealed(10), fieldId: empty }], [sealed(10), sealed(10)], [{ ...sealed(10), privateValue: "secret" }], [{ ...sealed(10), role: "private" }]]) expect(responseCellSchema.safeParse(cell(fields)).success).toBe(false);
});
it("validates canonical values by their sealed type and permits a source label only for catalog fields", () => {
  for (const [type, value] of [["integer", "01"], ["integer", "1000000000000000000"], ["decimal", "1,23"], ["decimal", "1.20"], ["date", "2026-02-29"], ["boolean", "False"], ["catalog", empty], ["text", "x".repeat(301)]]) expect(responseCellSchema.safeParse(cell([sealed(10, type, value)])).success).toBe(false);
  expect(responseCellSchema.safeParse(cell([{ ...sealed(10), text: "Private source label" }])).success).toBe(false);
  expect(responseCellSchema.safeParse(cell([{ ...sealed(10, "decimal", "1.23"), value: 1.23 }])).success).toBe(false);
});
it("preserves each option and its own sealed fields in the received multiple-choice order", () => {
  const values = [{ ...option([sealed(10, "integer", "18")]), choiceId: id(5) }, option([sealed(10, "integer", "27")])];
  expect(responseCellSchema.parse({ ...cell(), type: "multiChoice", value: values }).value).toEqual(values);
});
