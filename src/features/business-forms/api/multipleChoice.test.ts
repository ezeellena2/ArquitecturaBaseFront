// Synthetic C1 DTOs; the exported HTTP cohort is qualified separately at the final export.
import { describe, expect, it } from "vitest";
import { canonicalFormFieldSchema, readFormDetail, readFormPublicationCheck } from "./response";
import { openDraftSession } from "../draftSession";
import { fixtureDefinition, fixtureLifecycle, wireDefinition } from "@/test/visual/formFixtures";

const fieldId = "01990000-0000-7000-8000-000000000901";
const catalogId = "01990000-0000-7000-8000-000000000902";
const choiceId = (index: number) => "01990000-0000-7000-8000-" + String(910 + index).padStart(12, "0");
const own = () => ({ fieldId, key: "field_" + fieldId.replaceAll("-", ""), type: "multiChoice",
  label: { es: "Fallas", en: "Faults" }, help: null, required: true, maxLength: null,
  selection: { minSelected: 1, maxSelected: 3 },
  options: [1, 2, 3].map(index => ({ choiceId: choiceId(index), label: { es: "Falla " + index, en: "Fault " + index } })),
});
function detail(question: unknown) {
  const definition = wireDefinition(fixtureDefinition());
  return { definition: { ...definition, draft: { ...definition.draft, fields: [question] } },
    lifecycle: fixtureLifecycle(definition.revision), capabilities: { canSave: true, canPublish: true, canPreview: false },
    publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
    audit: { createdAtUtc: "2026-10-22T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-10-22T12:00:00Z", lastChangedBy: null } };
}
describe("multiple choice canonical authoring", () => {
  it.each([false, true])("retains selection exactly for an own or catalog question (catalog: %s)", catalog => {
    const question = catalog ? { ...own(), options: null, source: { catalog: catalogId } } : own();
    expect(canonicalFormFieldSchema.parse(question)).toEqual(question);
    expect(readFormDetail(detail(question)).definition.draft.fields[0]).toMatchObject({
      type: "multiChoice", selection: { minSelected: 1, maxSelected: 3 },
      ...(catalog ? { source: { catalog: catalogId } } : { options: question.options }),
    });
  });
  it.each([{ minSelected: 0, maxSelected: 1 }, { minSelected: 3, maxSelected: 20 }])("accepts valid own boundaries without reducing the upper bound: %j", selection => {
    const question = { ...own(), selection, required: selection.minSelected > 0 };
    expect(canonicalFormFieldSchema.parse(question).selection).toEqual(selection);
  });
  it.each([
    undefined, null, { minSelected: 0 }, { maxSelected: 3 }, { minSelected: -1, maxSelected: 3 },
    { minSelected: 0, maxSelected: 0 }, { minSelected: 0, maxSelected: 21 },
    { minSelected: 1.5, maxSelected: 3 }, { minSelected: 1, maxSelected: 3.5 },
    { minSelected: 3, maxSelected: 2 }, { minSelected: 1, maxSelected: 3, unknown: "private" },
  ])("rejects missing, unknown or impossible selection metadata without a default %#", selection => {
    expect(() => readFormDetail(detail({ ...own(), selection }))).toThrow("Unsupported form response.");
  });
  it.each([
    { selection: { minSelected: 0, maxSelected: 3 }, required: true },
    { selection: { minSelected: 1, maxSelected: 3 }, required: false },
    { selection: { minSelected: 4, maxSelected: 5 } },
    { options: [] },
    { options: Array.from({ length: 21 }, (_, index) => ({ choiceId: choiceId(index), label: { es: "Opción " + index } })) },
    { source: { catalog: catalogId } },
  ])("rejects a noncanonical multi question %#", change => {
    expect(() => readFormDetail(detail({ ...own(), ...change }))).toThrow("Unsupported form response.");
  });
  it("does not infer a dynamic catalog cardinality from the authoring response", () => {
    expect(canonicalFormFieldSchema.parse({ ...own(), options: null, source: { catalog: catalogId },
      selection: { minSelected: 20, maxSelected: 20 } }).selection).toEqual({ minSelected: 20, maxSelected: 20 });
  });
  it.each([null, { minSelected: 0, maxSelected: 1 }])("rejects selection on a single-choice question: %j", selection => {
    expect(canonicalFormFieldSchema.safeParse({ ...own(), type: "choice", selection }).success).toBe(false);
  });
  it("keeps the legacy single-choice shape and does not synthesize selection", () => {
    const { selection: discarded, ...question } = own();
    expect(discarded).toEqual({ minSelected: 1, maxSelected: 3 });
    const parsed = canonicalFormFieldSchema.parse({ ...question, type: "choice" });
    expect(parsed).not.toHaveProperty("selection");
    expect(parsed.type).toBe("choice");
  });
});

it("accepts a known multi option diagnostic but rejects a foreign ChoiceId", () => {
  const question = own();
  const saved = readFormDetail(detail(question)).definition;
  const fields = openDraftSession({ actorId: "actor", editorId: "editor" }, saved).value.draft.fields;
  const issue = { channelId: "phone", fieldId, choiceId: question.options[0]!.choiceId, path: "draft.fields[0].options[0].label.en",
    code: "WhatsApp.Flow.TextTooLong", message: "Review this option.", limit: 30, culture: "en" };
  const checked = { definitionId: saved.id, draftRevision: saved.revision, nextVersionNumber: 1, compatibility: "Blocked",
    canAccept: false, acceptanceAvailability: "Unavailable", checkToken: null, checkExpiresAtUtc: null,
    channels: [{ channelId: "phone", profileRevision: "flow-static-7.3-r9", compatibility: "Blocked", externalEvidence: "Pending", cultures: ["es", "en"] }],
    cultures: [{ culture: "es", isOriginal: true, isComplete: true, missing: [] }, { culture: "en", isOriginal: false, isComplete: true, missing: [] }],
    issues: [issue], warnings: [], diff: { baseVersionId: null, added: [fieldId], changed: [], removed: [], addedCultures: [], removedCultures: [] } };
  expect(readFormPublicationCheck(checked, saved.id, saved.revision, fields).issues).toEqual([issue]);
  expect(() => readFormPublicationCheck({ ...checked, issues: [{ ...issue, choiceId: catalogId }] }, saved.id, saved.revision, fields))
    .toThrow("Unsupported form response.");
});
