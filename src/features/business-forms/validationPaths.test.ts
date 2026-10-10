import { describe, expect, it } from "vitest";
import { publicationFieldIssues } from "./validationPaths";
import { openDraftSession } from "./draftSession";
import { fixtureDefinition } from "@/test/visual/formFixtures";

describe("fixed publication diagnostics", () => {
  it("follows stable question and option identities after reordering and ignores removed identities", () => {
    const value = openDraftSession({ actorId: "actor", editorId: "editor" }, fixtureDefinition()).value;
    const original = value.draft.fields.find(q => q.type === "choice")!;
    if (original.type !== "choice") throw new Error("Expected a choice question.");
    const option = original.options[0]!;
    const reordered = { ...value, draft: { ...value.draft, fields: [...value.draft.fields].reverse().map(q => q.type === "choice" ? { ...q, options: [...q.options].reverse() } : q) } };
    const issue = { fieldId: original.fieldId, choiceId: option.choiceId, path: "draft.fields[0].options[0].label.en", culture: "en" as const, message: "Review this option." };
    expect(publicationFieldIssues(reordered, [issue])).toEqual([{ path: issue.path, messages: [issue.message], fieldLocalId: original.localId, choiceLocalId: option.localId }]);
    expect(publicationFieldIssues(reordered, [{ ...issue, fieldId: "removed" }, { ...issue, choiceId: "removed" }])).toEqual([]);
  });
});
