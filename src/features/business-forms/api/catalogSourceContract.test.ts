import { describe, expect, it } from "vitest";
import { canonicalFormFieldSchema, readFormPublicationCheck } from "./response";
const id = (n: number) => "01990000-0000-7000-8000-" + String(n).padStart(12, "0");
const field = { fieldId: id(1), key: "field_" + id(1).replaceAll("-", ""), type: "choice", label: { es: "Equipo" }, help: null, required: true, maxLength: null, options: null };
const match = [{ fieldId: id(3), personAttributeId: id(4) }, { fieldId: id(5), value: "900719925474099123" }];
const source = { catalog: id(2), match, presentation: { title: ["text", id(3)], description: ["detail"] } };
describe("catalog source response contract", () => {
  it("preserves canonical conditions and own presentation without coercing exact values", () => {
    expect(canonicalFormFieldSchema.parse({ ...field, source }).source).toEqual(source);
  });
  it.each([
    { ...source, match: [{ fieldId: id(3), value: "x", personAttributeId: id(4) }] },
    { ...source, match: [{ fieldId: id(3), value: null }] },
    { ...source, match: [{ fieldId: id(3), value: 12 }] },
    { ...source, match: [match[0], match[0]] },
    { ...source, match: [{ fieldId: id(3) }] },
    { ...source, presentation: { title: [], description: [] } },
    { ...source, token: "PRIVATE" },
  ])("rejects ambiguous, incomplete or unbounded source configuration: %j", invalid => {
    expect(canonicalFormFieldSchema.safeParse({ ...field, source: invalid }).success).toBe(false);
  });
  it.each([
    { ...field, source: { ...source, match: null } },
    { ...field, source: { ...source, presentation: null } },
    { ...field, options: [{ choiceId: id(6), label: { es: "Norte" } }], source: null },
    Object.fromEntries(Object.entries({ ...field, source }).filter(([key]) => key !== "options")),
  ])("rejects a null the server omits and a question without its options: %j", invalid => {
    expect(canonicalFormFieldSchema.safeParse(invalid).success).toBe(false);
  });
});
const question = { ...field, type: "choice" as const, localId: "q", replacesFieldId: null, source };
const checked = { definitionId: id(8), draftRevision: 1, nextVersionNumber: 1, compatibility: "LocallyValidated", canAccept: true, acceptanceAvailability: "Available", checkToken: "ticket", checkExpiresAtUtc: "2099-10-10T16:00:00Z", channels: [], cultures: [], issues: [], warnings: [], diff: { baseVersionId: null, added: [], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
it("keeps recipient warnings nonblocking, including a maximum below the limit", () => {
  const warnings = [{ fieldId: id(1), path: "draft.fields[0].source.match", code: "Forms.Publication.OptionsPerRecipientHigh", message: "Como mucho 18 de 20.", limit: 20, maximum: 18, maximumLabel: "Norte" }, { fieldId: id(1), path: "draft.fields[0].source.match", code: "Forms.Publication.RecipientsWithoutData", message: "Faltan datos.", count: 2, people: ["Ana", "Luis"] }];
  expect(readFormPublicationCheck({ ...checked, warnings }, id(8), 1, [question])).toMatchObject({ canAccept: true, warnings });
});
it.each([undefined, null, [{ fieldId: id(99), path: "source", code: "x", message: "x" }], [{ fieldId: id(1), path: "source", code: "x", message: "x", people: Array(6).fill("person") }]])("rejects missing or foreign warning metadata", warnings => {
  expect(() => readFormPublicationCheck({ ...checked, warnings }, id(8), 1, [question])).toThrow("Unsupported form response.");
});
const maximumWarning = { fieldId: id(1), path: "draft.fields[0].source.match", code: "Forms.Publication.OptionsPerRecipientHigh", message: "Revisá el máximo.", limit: 20, maximum: 1 };
const missingDataWarning = { fieldId: id(1), path: "draft.fields[0].source.match", code: "Forms.Publication.RecipientsWithoutData", message: "Faltan datos.", count: 1, people: [] };
it("accepts each warning code with only its own details, including people without a name", () => {
  expect(readFormPublicationCheck({ ...checked, warnings: [maximumWarning, missingDataWarning] }, id(8), 1, [question]).warnings).toEqual([maximumWarning, missingDataWarning]);
});
it.each([
  { ...maximumWarning, code: "x" },
  { ...maximumWarning, fieldId: null },
  { ...missingDataWarning, fieldId: null },
  Object.fromEntries(Object.entries(maximumWarning).filter(([key]) => key !== "maximum")),
  { ...maximumWarning, limit: 50 },
  { ...maximumWarning, count: 1 },
  { ...missingDataWarning, limit: 20 },
  { ...missingDataWarning, count: 0 },
])("rejects a warning with an unknown code, a null question or details of another code: %j", warning => {
  expect(() => readFormPublicationCheck({ ...checked, warnings: [warning] }, id(8), 1, [question])).toThrow("Unsupported form response.");
});
