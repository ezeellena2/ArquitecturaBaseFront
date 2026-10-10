import type { DraftEditorValue, DraftWriteBody } from "./model";

export interface DraftFieldIssue { readonly path: string; readonly messages: readonly string[]; readonly fieldLocalId?: string; readonly choiceLocalId?: string }
export function draftFieldIssues(body: DraftWriteBody, errors: Record<string, string[]> | undefined): readonly DraftFieldIssue[] {
  return Object.entries(errors ?? {}).flatMap(([path, messages]): DraftFieldIssue[] => {
    if (/^(name(?:\.(es|en))?|prefix|draft\.(format|culture|fields|submitLabel(\.(es|en))?))$/.test(path)) return [{ path, messages: [...messages] }];
    const match = /^draft\.fields\[(\d+)\]\.(localId|fieldId|replacesFieldId|type|required|maxLength|label(?:\.(?:es|en))?|help(?:\.(?:es|en))?|options(?:\[(\d+)\]\.(localId|choiceId|label(?:\.(?:es|en))?))?)$/.exec(path);
    const field = match && body.draft.fields[Number(match[1])];
    if (!field) return [];
    const index = match?.[3];
    if (index !== undefined) {
      const option = field.type === "choice" && field.options[Number(index)];
      return option ? [{ path, messages: [...messages], fieldLocalId: field.localId, choiceLocalId: option.localId }] : [];
    }
    return [{ path, messages: [...messages], fieldLocalId: field.localId }];
  });
}

// Publication diagnostics describe a fixed version: never attach them by an index in a newer draft.
export function publicationFieldIssues(value: DraftEditorValue, issues: readonly { fieldId: string | null; choiceId: string | null; path: string; culture: "es" | "en" | null; message: string }[]): readonly DraftFieldIssue[] {
  return issues.flatMap((issue): DraftFieldIssue[] => {
    if (!issue.fieldId) return /^(name|draft\.submitLabel)(\.(es|en))?$/.test(issue.path) ? [{ path: issue.path, messages: [issue.message] }] : [];
    const question = value.draft.fields.find(q => q.fieldId === issue.fieldId);
    if (!question) return [];
    const option = question.type === "choice" && issue.choiceId ? question.options.find(o => o.choiceId === issue.choiceId) : undefined;
    if (issue.choiceId && !option) return [];
    return [{ path: issue.path, messages: [issue.message], fieldLocalId: question.localId, ...(option ? { choiceLocalId: option.localId } : {}) }];
  });
}
