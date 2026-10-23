import type { DraftEditorValue, DraftWriteBody } from "./model";

export function parseValidationPath(path: string): readonly (string | number)[] | null {
  const segments: (string | number)[] = [];
  for (const part of path.split(".")) {
    const match = /^([^\s.\[\]]+)((?:\[(?:0|[1-9]\d*)\])*)$/.exec(part);
    if (!match) return null;
    segments.push(match[1]!);
    for (const index of match[2]!.matchAll(/\[(\d+)\]/g)) {
      const value = Number(index[1]);
      if (!Number.isSafeInteger(value)) return null;
      segments.push(value);
    }
  }
  return segments;
}

function validationPath(segments: readonly (string | number)[]): string {
  return segments.map((segment, index) => typeof segment === "number" ? `[${segment}]` : `${index ? "." : ""}${segment}`).join("");
}

export interface IndexedValidationIssue {
  readonly path: string;
  readonly relativePath: string;
  readonly localId: string;
  readonly messages: readonly string[];
}

// Resolve the submitted index once; later reordering must not reinterpret the server's error.
export function indexedValidationIssues(items: readonly { readonly localId: string }[], errors: Readonly<Record<string, readonly string[]>> | undefined, collection: string): readonly IndexedValidationIssue[] {
  return Object.entries(errors ?? {}).flatMap(([path, messages]) => {
    const segments = parseValidationPath(path);
    const index = segments?.[1];
    const item = segments?.[0] === collection && typeof index === "number" ? items[index] : undefined;
    return item && segments.length > 2 ? [{ path, relativePath: validationPath(segments.slice(2)), localId: item.localId, messages: [...messages] }] : [];
  });
}

export interface DraftFieldIssue { readonly path: string; readonly messages: readonly string[]; readonly fieldLocalId?: string; readonly choiceLocalId?: string }
export function draftFieldIssues(body: DraftWriteBody, errors: Record<string, string[]> | undefined): readonly DraftFieldIssue[] {
  return Object.entries(errors ?? {}).flatMap(([path, messages]): DraftFieldIssue[] => {
    const segments = parseValidationPath(path);
    if (!segments) return [];
    if (segments[0] === "name" || segments[0] === "prefix" || segments[0] === "offerWhen" || segments[0] === "draft" && segments.length <= 2) return [{ path, messages: [...messages] }];
    if (segments[0] === "draft" && segments[1] === "submitLabel") return [{ path, messages: [...messages] }];
    const index = segments[2];
    const field = segments[0] === "draft" && segments[1] === "fields" && typeof index === "number" ? body.draft.fields[index] : undefined;
    if (!field) return [];
    const optionIndex = segments[4];
    if (segments[3] === "options" && typeof optionIndex === "number") {
      const option = (field.type === "choice" || field.type === "multiChoice") && !field.source && field.options[optionIndex];
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
    const option = (question.type === "choice" || question.type === "multiChoice") && !question.source && issue.choiceId ? question.options.find(o => o.choiceId === issue.choiceId) : undefined;
    if (issue.choiceId && !option) return [];
    return [{ path: issue.path, messages: [issue.message], fieldLocalId: question.localId, ...(option ? { choiceLocalId: option.localId } : {}) }];
  });
}
