import { describe, expect, it } from "vitest";
import { publicationFieldIssues, draftFieldIssues, indexedValidationIssues, parseValidationPath } from "./validationPaths";
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

describe("structured validation paths", () => {
  it("parses property and safe index segments without a fixed set of field names", () => {
    expect(parseValidationPath("items[12].fields.019fe134-2950-7000-a000-123456789012")).toEqual(["items", 12, "fields", "019fe134-2950-7000-a000-123456789012"]);
    expect(parseValidationPath("draft.fields[0].source.match[2].fieldId")).toEqual(["draft", "fields", 0, "source", "match", 2, "fieldId"]);
    for (const path of ["", "items[-1].text", "items[1.5].text", "items[9007199254740992].text", "items[0]text", "items..text", "items[0].", "items[0", "items[00].text"]) expect(parseValidationPath(path)).toBeNull();
  });

  it("binds item values and field definitions to the submitted local identity", () => {
    const items = [{ localId: "first" }, { localId: "second" }];
    const errors = { "items[1].fields.extra-id": ["Revisá el valor."], "items[2].code": ["Ausente."], "fields[0].required": ["Faltan 3 valores."] };
    const itemIssues = indexedValidationIssues(items, errors, "items");
    expect(itemIssues).toEqual([{ localId: "second", path: "items[1].fields.extra-id", relativePath: "fields.extra-id", messages: ["Revisá el valor."] }]);
    expect(indexedValidationIssues([{ localId: "new-field" }], errors, "fields")).toEqual([{ localId: "new-field", path: "fields[0].required", relativePath: "required", messages: ["Faltan 3 valores."] }]);
    items.reverse();
    expect(itemIssues[0]?.localId).toBe("second");
  });

  it("attaches new source settings diagnostics to the frozen question without a property whitelist", () => {
    const original = openDraftSession({ actorId: "actor", editorId: "editor" }, fixtureDefinition()).value;
    const body = { ...original, requestId: "request" };
    const path = "draft.fields[0].source.match[0].personAttributeId";
    expect(draftFieldIssues(body, { [path]: ["Revisá el dato."], "draft.fields[999].source.presentation.title": ["Ausente."] }))
      .toEqual([{ path, fieldLocalId: body.draft.fields[0]!.localId, messages: ["Revisá el dato."] }]);
  });
});
