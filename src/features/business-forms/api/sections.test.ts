// Synthetic DTOs of section titles (CW15-B); the exported HTTP cohort is qualified separately at the final export.
import { describe, expect, it } from "vitest";
import { readFormCommit, readFormDetail } from "./response";
import { draftWire } from "./forms";
import { beginDraftSave, changeDraft, confirmDraftSave, openDraftSession } from "../draftSession";
import { createDraftReview, missingFormTexts, resolveDraftReview } from "../editorModel";
import { draftFieldIssues } from "../validationPaths";
import { fixtureDefinition, fixtureLifecycle, wireDefinition } from "@/test/visual/formFixtures";

const id = (index: number) => "01990000-0000-7000-8000-" + String(970 + index).padStart(12, "0");
const question = (index: number) => ({ fieldId: id(index), key: "field_" + id(index).replaceAll("-", ""), type: "shortText",
  label: { es: "Pregunta " + index, en: "Question " + index }, help: null, required: false, maxLength: 80, options: null });
const sections = [{ start: 0, title: { es: "Lote", en: "Lot" } }, { start: 2, title: { es: "Productos" } }];
function definition(extra: Record<string, unknown> = { sections }) {
  const wired = wireDefinition(fixtureDefinition());
  return { ...wired, draft: { ...wired.draft, fields: [question(0), question(1), question(2)], ...extra } };
}
const detail = (extra?: Record<string, unknown>) => ({ definition: definition(extra), lifecycle: fixtureLifecycle(fixtureDefinition().revision),
  capabilities: { canSave: true, canPublish: true, canPreview: false }, publication: { activeVersion: null, currentOperation: null, displayState: "Draft" },
  audit: { createdAtUtc: "2026-11-05T12:00:00Z", modifiedAtUtc: null, lastChangedAtUtc: "2026-11-05T12:00:00Z", lastChangedBy: null } });
const scope = { actorId: "actor", editorId: "editor" };

describe("section titles in the draft", () => {
  it("reads the titles with where they start and opens them in the editor with a local identity", () => {
    const read = readFormDetail(detail()).definition;

    expect(read.draft.sections).toEqual(sections);
    const draft = openDraftSession(scope, read).value.draft;
    expect(draft.sections?.map(section => [section.start, section.title.es])).toEqual([[0, "Lote"], [2, "Productos"]]);
    expect(new Set(draft.sections?.map(section => section.localId)).size).toBe(2);
    expect(readFormDetail(detail({})).definition.draft.sections).toBeUndefined();
  });
  it.each([
    [{ sections: [] }], [{ sections: [{ start: 4, title: { es: "Lejos" } }] }], [{ sections: [{ start: 2, title: { es: "B" } }, { start: 1, title: { es: "A" } }] }],
    [{ sections: [{ start: 0, title: { en: "Lot" } }] }], [{ sections: [{ start: 0, title: { es: "Lote" }, localId: "private" }] }],
  ])("rejects titles out of place, without the original or with unknown members %#", extra => {
    expect(() => readFormDetail(detail(extra))).toThrow();
  });
  it("sends the titles without their local identity, and nothing without titles", () => {
    const value = openDraftSession(scope, readFormDetail(detail()).definition).value;

    expect(draftWire(value.draft).sections).toEqual(sections);
    expect(JSON.stringify(draftWire({ ...value.draft, sections: [] }))).not.toContain("sections");
  });
  it("keeps each title's local identity when the save confirms it", () => {
    const opened = openDraftSession(scope, readFormDetail(detail()).definition);
    const local = opened.value.draft.sections!.map(section => section.localId);
    const saving = beginDraftSave(changeDraft(opened, { ...opened.value, draft: { ...opened.value.draft, sections: [...opened.value.draft.sections!.slice(0, 1)] } }), "01990000-0000-7000-8000-000000000999");
    const saved = definition({ sections: sections.slice(0, 1) });
    const result = readFormCommit({ requestId: "01990000-0000-7000-8000-000000000999", definition: { ...saved, revision: saved.revision + 1 },
      identityMap: { fields: saved.draft.fields.map(field => ({ localId: field.fieldId, fieldId: field.fieldId, key: field.key, replacesFieldId: null })), choices: [] },
      recovery: { path: "/api/forms/draft-changes/01990000-0000-7000-8000-000000000999", resultExpiresAtUtc: "2026-12-05T12:00:00Z" } });

    const confirmed = confirmDraftSave(saving, saving.pending!.identity, result);

    expect(confirmed.phase).toBe("Editing");
    expect(confirmed.value.draft.sections).toEqual([{ localId: local[0], start: 0, title: { es: "Lote", en: "Lot" } }]);
  });
  it("compares the titles as a whole in a conflict and keeps the chosen ones", () => {
    const saved = readFormDetail(detail({})).definition;
    const mine = openDraftSession(scope, readFormDetail(detail()).definition).value;

    const review = createDraftReview(mine, saved);
    const row = review.rows.find(item => item.kind === "sections")!;
    const choices = (sections: string) => Object.fromEntries(review.rows.map(item => [item.id, item.id === row.id ? sections : "current"]));

    expect(row).toMatchObject({ id: "sections", canKeep: true });
    expect(resolveDraftReview(review, choices("mine"))?.draft.sections?.map(section => section.start)).toEqual([0, 2]);
    expect(resolveDraftReview(review, choices("current"))?.draft.sections).toBeUndefined();
  });
  it("counts a title without its translation among the missing texts of that language", () => {
    const value = openDraftSession(scope, readFormDetail(detail()).definition).value;

    expect(missingFormTexts(value, "en")).toBe(1);
    expect(missingFormTexts({ ...value, draft: { ...value.draft, sections: undefined } }, "en")).toBe(0);
  });
  it("places a save error of a title on that title", () => {
    const value = openDraftSession(scope, readFormDetail(detail()).definition).value;
    const body = { ...value, requestId: "01990000-0000-7000-8000-000000000998" };

    const issues = draftFieldIssues(body, { "draft.sections[1].title.es": ["Completá el título."], "draft.sections[0].start": ["Fuera de lugar."] });

    expect(issues.map(issue => [issue.path, issue.sectionLocalId])).toEqual([
      ["draft.sections[1].title.es", value.draft.sections![1]!.localId], ["draft.sections[0].start", value.draft.sections![0]!.localId]]);
  });
});
