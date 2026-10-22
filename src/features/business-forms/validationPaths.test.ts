import { describe, expect, it } from "vitest";
import { publicationFieldIssues, draftFieldIssues } from "./validationPaths";
import { openDraftSession } from "./draftSession";
import { fixtureDefinition } from "@/test/visual/formFixtures";

describe("fixed publication diagnostics", () => {
  it("follows stable question and option identities after reordering and ignores removed identities", () => {
    const value = openDraftSession({ actorId: "actor", editorId: "editor" }, fixtureDefinition()).value;
    const original = value.draft.fields.find(q => q.type === "choice" && !q.source)!;
    if (original.type !== "choice" || original.source) throw new Error("Expected a choice question.");
    const option = original.options[0]!;
    const reordered = { ...value, draft: { ...value.draft, fields: [...value.draft.fields].reverse().map(q => q.type === "choice" && !q.source ? { ...q, options: [...q.options].reverse() } : q) } };
    const issue = { fieldId: original.fieldId, choiceId: option.choiceId, path: "draft.fields[0].options[0].label.en", culture: "en" as const, message: "Review this option." };
    expect(publicationFieldIssues(reordered, [issue])).toEqual([{ path: issue.path, messages: [issue.message], fieldLocalId: original.localId, choiceLocalId: option.localId }]);
    expect(publicationFieldIssues(reordered, [{ ...issue, fieldId: "removed" }, { ...issue, choiceId: "removed" }])).toEqual([]);
  });
});

it("keeps catalog validation attached to its frozen question identity", () => {
  const value = { offerWhen: null, name: { es: "Visita" }, prefix: "VIS", requestId: "request", draft: { format: 1, culture: "es", submitLabel: { es: "Enviar" }, fields: [{ localId: "catalog-question", fieldId: null, replacesFieldId: null, type: "choice", source: { catalog: "catalog" }, label: { es: "Cliente" }, help: null, required: true }] } } as unknown as import("./model").DraftWriteBody;
  expect(draftFieldIssues(value, { "draft.fields[0].source.catalog": ["Revisá el catálogo."] })).toEqual([{ path: "draft.fields[0].source.catalog", fieldLocalId: "catalog-question", messages: ["Revisá el catálogo."] }]);
});

it("attaches multi selection errors to the frozen question and options to stable identities", () => {
  const original = openDraftSession({ actorId: "actor", editorId: "editor" }, fixtureDefinition()).value;
  const field = original.draft.fields.find(question => question.type === "choice" && !question.source)!;
  if (field.type !== "choice" || field.source) throw new Error("Expected own choices.");
  const multiple = { ...field, type: "multiChoice" as const, selection: { minSelected: 1, maxSelected: 3 } };
  const body = { ...original, requestId: "request", draft: { ...original.draft, fields: [multiple] } };
  expect(draftFieldIssues(body, { "draft.fields[0].selection.maxSelected": ["Hasta 20."], "draft.fields[0].options[1].label.en": ["Traducí esta opción."] }))
    .toEqual([{ path: "draft.fields[0].selection.maxSelected", fieldLocalId: multiple.localId, messages: ["Hasta 20."] },
      { path: "draft.fields[0].options[1].label.en", fieldLocalId: multiple.localId, choiceLocalId: multiple.options[1]!.localId, messages: ["Traducí esta opción."] }]);
  const reordered = { ...body, draft: { ...body.draft, fields: [{ ...multiple, options: [...multiple.options].reverse() }] } };
  expect(publicationFieldIssues(reordered, [{ fieldId: multiple.fieldId, choiceId: multiple.options[1]!.choiceId, path: "draft.fields[0].options[1].label.en", culture: "en", message: "Traducí esta opción." }]))
    .toEqual([{ path: "draft.fields[0].options[1].label.en", fieldLocalId: multiple.localId, choiceLocalId: multiple.options[1]!.localId, messages: ["Traducí esta opción."] }]);
});
