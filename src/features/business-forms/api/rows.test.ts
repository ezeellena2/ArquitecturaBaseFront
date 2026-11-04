// Synthetic DTOs of the block of rows (RG1-A, RG6-A); the exported HTTP cohort is qualified separately at the final export.
import { describe, expect, it } from "vitest";
import { canonicalFormFieldSchema, readFormDetail, readFormPublicationCheck } from "./response";
import { openDraftSession } from "../draftSession";
import { fixtureDefinition, fixtureLifecycle, wireDefinition } from "@/test/visual/formFixtures";

const id = (index: number) => "01990000-0000-7000-8000-" + String(950 + index).padStart(12, "0");
const question = (index: number, type: string, extra: Record<string, unknown> = {}) => ({ fieldId: id(index), key: "field_" + id(index).replaceAll("-", ""), type,
  label: { es: "Pregunta " + index, en: "Question " + index }, help: null, required: false, maxLength: null, options: null, ...extra });
const block = (rows: unknown = { minRows: 1, maxRows: 20 }) => question(1, "group", { label: { es: "Artículos", en: "Items" }, required: true, rows });
const fields = () => [question(0, "shortText", { maxLength: 80 }), block(), question(2, "decimal", { repeated: true }),
  question(3, "longText", { maxLength: 600, repeated: true }), question(4, "date")];
function detail(questions: readonly unknown[]) {
  const definition = wireDefinition(fixtureDefinition());
  return { definition: { ...definition, draft: { ...definition.draft, fields: questions } },
    lifecycle: fixtureLifecycle(definition.revision), capabilities: { canSave: true, canPublish: true, canPreview: false },
    publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
    audit: { createdAtUtc: "2026-11-04T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-04T12:00:00Z", lastChangedBy: null } };
}

describe("the block of rows in the draft", () => {
  it("keeps the block, its rows and the questions of each row", () => {
    const read = readFormDetail(detail(fields())).definition.draft.fields;

    expect(read[1]).toMatchObject({ type: "group", required: true, rows: { minRows: 1, maxRows: 20 } });
    expect(read.map(field => "repeated" in field ? field.repeated : undefined)).toEqual([undefined, undefined, true, true, undefined]);
    const draft = openDraftSession({ actorId: "actor", editorId: "editor" }, readFormDetail(detail(fields())).definition).value.draft.fields;
    expect(draft[1]).toMatchObject({ type: "group", rows: { minRows: 1, maxRows: 20 } });
    expect(draft.map(field => "repeated" in field ? field.repeated : undefined)).toEqual([undefined, undefined, true, true, undefined]);
  });
  it.each([{ minRows: 0, maxRows: 1 }, { minRows: 100, maxRows: 100 }])("accepts the limits of the rows: %j", rows => {
    expect(canonicalFormFieldSchema.parse({ ...block(rows), required: rows.minRows > 0 }).rows).toEqual(rows);
  });
  it.each([
    null, { minRows: 1 }, { minRows: -1, maxRows: 2 }, { minRows: 0, maxRows: 0 }, { minRows: 0, maxRows: 101 },
    { minRows: 3, maxRows: 2 }, { minRows: 1.5, maxRows: 2 }, { minRows: 1, maxRows: 2, unknown: "private" },
  ])("rejects unknown or impossible rows %#", rows => {
    expect(canonicalFormFieldSchema.safeParse(block(rows)).success).toBe(false);
  });
  it("rejects a block without rows", () => {
    expect(canonicalFormFieldSchema.safeParse(question(1, "group", { required: true })).success).toBe(false);
  });
  it.each([
    { ...block(), required: false },
    { ...block({ minRows: 0, maxRows: 5 }), required: true },
    { ...block(), repeated: true },
    { ...block(), maxLength: 80 },
    question(2, "decimal", { rows: { minRows: 1, maxRows: 2 } }),
    question(2, "decimal", { repeated: false }),
    question(2, "photo", { files: { minFiles: 0, maxFiles: 1, photoSource: "camera" }, repeated: true }),
    question(2, "multiChoice", { options: [{ choiceId: id(9), label: { es: "A" } }], selection: { minSelected: 0, maxSelected: 1 }, repeated: true }),
  ])("rejects a question that is not a block or a question of one %#", value => {
    expect(canonicalFormFieldSchema.safeParse(value).success).toBe(false);
  });
  it.each([
    ["a second block", [block(), question(2, "decimal", { repeated: true }), { ...block(), fieldId: id(5), key: "field_" + id(5).replaceAll("-", "") }]],
    ["a row question before the block", [question(2, "decimal", { repeated: true }), block()]],
    ["a row question after another question", [block(), question(2, "decimal", { repeated: true }), question(3, "date"), question(4, "date", { repeated: true })]],
    ["a row question without a block", [question(2, "decimal", { repeated: true })]],
  ])("rejects %s", (_, questions) => {
    expect(() => readFormDetail(detail(questions))).toThrow("Unsupported form response.");
  });
  it("does not count the block among the forty questions", () => {
    const forty = Array.from({ length: 40 }, (_, index) => question(10 + index, "decimal", index < 5 ? { repeated: true } : {}));

    expect(readFormDetail(detail([block(), ...forty])).definition.draft.fields).toHaveLength(41);
    expect(() => readFormDetail(detail([block(), ...forty, question(60, "date")]))).toThrow("Unsupported form response.");
  });
  it("keeps an empty block, which only publishing blocks", () => {
    expect(readFormDetail(detail([question(0, "shortText", { maxLength: 80 }), block()])).definition.draft.fields[1]).toMatchObject({ type: "group" });
  });
});

describe("publishing the block of rows", () => {
  const saved = () => readFormDetail(detail(fields())).definition;
  const check = (changes: Record<string, unknown> = {}) => ({ definitionId: saved().id, draftRevision: saved().revision, nextVersionNumber: 2, compatibility: "LocallyValidated",
    canAccept: false, acceptanceAvailability: "InProgress", checkToken: null, checkExpiresAtUtc: null,
    channels: [{ channelId: "phone", profileRevision: "flow-static-7.3-r10", compatibility: "LocallyValidated", externalEvidence: "Pending", cultures: ["es", "en"] }],
    cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }],
    issues: [], warnings: [{ fieldId: id(1), path: "draft.fields[1].rows", code: "Forms.Publication.RowsOverChannelLimit", message: "En WhatsApp se cargan menos renglones que el máximo del bloque.", limit: 10, maximum: 20 }],
    diff: { baseVersionId: id(8), added: [id(1)], changed: [], removed: [], addedCultures: [], removedCultures: [], movedToRows: [id(2)] }, ...changes });
  const draft = () => openDraftSession({ actorId: "actor", editorId: "editor" }, saved()).value.draft.fields;

  it("reads the warning of the channel rows and the questions that move into the block", () => {
    const read = readFormPublicationCheck(check(), saved().id, saved().revision, draft());

    expect(read.warnings[0]).toMatchObject({ code: "Forms.Publication.RowsOverChannelLimit", limit: 10, maximum: 20 });
    expect(read.diff.movedToRows).toEqual([id(2)]);
    expect(readFormPublicationCheck(check({ diff: { ...check().diff, movedToRows: undefined } }), saved().id, saved().revision, draft()).diff.movedToRows).toBeUndefined();
  });
  it.each([[[]], [[id(0)]], [[id(7)]]])("rejects moved questions that are not questions of the block: %j", movedToRows => {
    expect(() => readFormPublicationCheck(check({ diff: { ...check().diff, movedToRows } }), saved().id, saved().revision, draft())).toThrow("Unsupported form response.");
  });
  it("rejects the warning of the channel rows without its limit and maximum", () => {
    const { limit: _limit, ...warning } = check().warnings[0]!;

    expect(() => readFormPublicationCheck(check({ warnings: [warning] }), saved().id, saved().revision, draft())).toThrow("Unsupported form response.");
  });
});
