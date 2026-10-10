import type { DraftWriteBody } from "./model";

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
