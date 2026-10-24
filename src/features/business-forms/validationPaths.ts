import type { TFunction } from "i18next";
import type { DraftEditorValue, DraftWriteBody, FormCulture } from "./model";

export interface LocalizedIssue { readonly messages: readonly string[]; readonly culture: FormCulture | null }
// Without a language selector, an error of the language not on screen is shown under the same field, with its culture.
export function localizedIssue(errors: Readonly<Record<string, readonly string[]>> | undefined, path: string, culture: FormCulture): LocalizedIssue | undefined {
  for (const candidate of [culture, culture === "es" ? "en" : "es"] as const) {
    const messages = errors?.[path + "." + candidate];
    if (messages?.length) return { messages, culture: candidate };
  }
  const messages = errors?.[path];
  return messages?.length ? { messages, culture: null } : undefined;
}
/** The message under the field: an error of the language not on screen names that language («En inglés: …»). */
export function localizedIssueMessage(issue: LocalizedIssue | undefined, culture: FormCulture, t: TFunction<"forms">): string | undefined {
  if (!issue) return undefined;
  const message = issue.messages[0];
  return issue.culture && issue.culture !== culture ? t("otherLanguageError", { language: t("cultureNamesInText." + issue.culture), message }) : message;
}

export function parseValidationPath(path: string): readonly (string | number)[] | null {
  const segments: (string | number)[] = [];
  for (const part of path.split(".")) {
    const match = /^([^\s.[\]]+)((?:\[(?:0|[1-9]\d*)\])*)$/.exec(part);
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
    if (!segments) return [];
    const index = segments[1];
    const item = segments[0] === collection && typeof index === "number" ? items[index] : undefined;
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
