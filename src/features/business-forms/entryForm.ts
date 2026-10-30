import type { FormEntry, FormEntryAnswer, FormEntryOption, FormEntryQuestion, FormEntrySend } from "./api/entries";

/**
 * What the person has loaded, by question: typed values, the chosen options (with the title they saw) and the files.
 * It lives only in the page or panel that loads it: never in storage, the URL or a query cache.
 */
export interface EntryDraft {
  values: Record<string, string>;
  choices: Record<string, FormEntryOption[]>;
  files: Record<string, File[]>;
}
export type EntryProblem = "required" | "choose" | "chooseAtLeast" | "chooseAtMost" | "number" | "date" | "maxLength" | "filesAtLeast" | "filesAtMost";
export type EntryFileProblem = "photoType" | "documentType" | "size" | "count";

const photoTypes = ["image/jpeg", "image/png"];
const documentTypes = [...photoTypes, "application/pdf", "application/msword", "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
const decimal = /^[-+]?\d+([.,]\d+)?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
const isFile = (question: FormEntryQuestion) => question.type === "photo" || question.type === "document";
const isList = (question: FormEntryQuestion) => question.type === "choice" || question.type === "multiChoice";
/** The id of a question's control, so a problem can take the focus to it. */
export const entryQuestionId = (fieldId: string) => "entry-" + fieldId;

/** A folding zone of the loading page and the questions it holds. */
export interface EntryZone { key: string; questions: FormEntryQuestion[] }

/**
 * The zones of the loading page (CW16): the data in the editor's order and the photos and documents at the end. Section
 * titles, a later stage, add one zone per title to this list; the page draws whatever zones it receives.
 */
export function entryZones(entry: FormEntry): EntryZone[] {
  const data = entry.questions.filter(question => !isFile(question));
  const files = entry.questions.filter(isFile);
  return [...data.length ? [{ key: "data", questions: data }] : [], ...files.length ? [{ key: "files", questions: files }] : []];
}

/** Up to five short own options go in a row; more, or longer ones, in a dropdown list (CW12). */
export function entryChoiceInRow(question: FormEntryQuestion): boolean {
  return !!question.options && question.options.length <= 5 && question.options.every(option => option.label.length <= 20);
}

/** How many of the three columns a question takes (CW16): the width comes from its type, never from the author. */
export function entryQuestionSpan(question: FormEntryQuestion): 1 | 2 | 3 {
  if (question.type === "decimal" || question.type === "date" || question.type === "boolean") return 1;
  if (question.type === "shortText") return question.maxLength === null ? 3 : question.maxLength <= 30 ? 1 : question.maxLength <= 80 ? 2 : 3;
  if (question.type === "choice") return question.catalog || entryChoiceInRow(question) ? 2 : 1;
  if (question.type === "multiChoice") return question.catalog ? 2 : 3;
  return 3;
}

/** The questions in rows of three columns, in the editor's order: one that does not fit starts the next row. */
export function entryRows(questions: readonly FormEntryQuestion[]): FormEntryQuestion[][] {
  const rows: FormEntryQuestion[][] = [];
  let used = 3;
  for (const question of questions) {
    const span = entryQuestionSpan(question);
    if (used + span > 3) { rows.push([]); used = 0; }
    rows[rows.length - 1].push(question);
    used += span;
  }
  return rows;
}

/** Whether a question already has something loaded: what the band of a folded zone counts. */
export function entryAnswered(question: FormEntryQuestion, draft: EntryDraft): boolean {
  if (isFile(question)) return (draft.files[question.fieldId]?.length ?? 0) > 0;
  if (isList(question)) return (draft.choices[question.fieldId]?.length ?? 0) > 0;
  return (draft.values[question.fieldId] ?? "") !== "";
}

/** A long text box of two to six lines, by its maximum length (CW12). */
export function entryTextRows(question: FormEntryQuestion): number {
  return Math.min(6, Math.max(2, Math.ceil((question.maxLength ?? 600) / 100)));
}

/** Empty, except the only catalog option the filters leave for the person, which comes chosen. */
export function initialEntryDraft(entry: FormEntry): EntryDraft {
  const choices: Record<string, FormEntryOption[]> = {};
  for (const question of entry.questions) if (question.catalog?.onlyOption) choices[question.fieldId] = [question.catalog.onlyOption];
  return { values: {}, choices, files: {} };
}

/** Each question's first problem, in the order of the form; an empty object can be sent. */
export function validateEntry(entry: FormEntry, draft: EntryDraft): Record<string, EntryProblem> {
  const problems: Record<string, EntryProblem> = {};
  for (const question of entry.questions) {
    const problem = questionProblem(question, draft);
    if (problem) problems[question.fieldId] = problem;
  }
  return problems;
}

function questionProblem(question: FormEntryQuestion, draft: EntryDraft): EntryProblem | null {
  if (isFile(question)) {
    const count = draft.files[question.fieldId]?.length ?? 0;
    if (count < (question.files?.minFiles ?? 0)) return "filesAtLeast";
    return count > (question.files?.maxFiles ?? 0) ? "filesAtMost" : null;
  }
  if (question.type === "multiChoice") {
    const count = draft.choices[question.fieldId]?.length ?? 0;
    if (count < (question.selection?.minSelected ?? 0)) return "chooseAtLeast";
    return count > (question.selection?.maxSelected ?? 20) ? "chooseAtMost" : null;
  }
  if (question.type === "choice") return question.required && !draft.choices[question.fieldId]?.length ? "choose" : null;
  const value = draft.values[question.fieldId] ?? "";
  if (value === "") return question.required ? "required" : null;
  if (question.type === "decimal" && !decimal.test(value.trim())) return "number";
  if (question.type === "date" && !isoDate.test(value)) return "date";
  if (question.maxLength !== null && value.length > question.maxLength) return "maxLength";
  return null;
}

/** The send: canonical values (a decimal with a dot), the chosen ids and each file with the question it answers. */
export function toEntrySend(entry: FormEntry, draft: EntryDraft, requestId: string): FormEntrySend {
  const answers: FormEntryAnswer[] = [];
  const files: FormEntrySend["files"] = [];
  for (const question of entry.questions) {
    if (isFile(question)) {
      for (const file of draft.files[question.fieldId] ?? []) files.push({ fieldId: question.fieldId, file });
      continue;
    }
    if (question.type === "multiChoice") {
      answers.push({ fieldId: question.fieldId, choiceIds: (draft.choices[question.fieldId] ?? []).map(option => option.id) });
      continue;
    }
    if (question.type === "choice") {
      const chosen = draft.choices[question.fieldId]?.[0];
      if (chosen) answers.push({ fieldId: question.fieldId, value: chosen.id });
      continue;
    }
    const value = draft.values[question.fieldId] ?? "";
    if (value !== "") answers.push({ fieldId: question.fieldId, value: question.type === "decimal" ? value.trim().replace(",", ".") : value });
  }
  return { requestId, versionId: entry.versionId, answers, files };
}

/** The answers of the questions that stay, with the same type, in the new version; the rest are dropped. */
export function carryEntryDraft(previous: FormEntry, draft: EntryDraft, next: FormEntry): EntryDraft {
  const carried: EntryDraft = { values: {}, choices: {}, files: {} };
  for (const question of next.questions) {
    const before = previous.questions.find(value => value.fieldId === question.fieldId);
    if (before?.type !== question.type) continue;
    if (isFile(question)) { if (draft.files[question.fieldId]) carried.files[question.fieldId] = draft.files[question.fieldId]; }
    else if (isList(question)) { if (draft.choices[question.fieldId]) carried.choices[question.fieldId] = draft.choices[question.fieldId]; }
    else if (draft.values[question.fieldId] !== undefined) carried.values[question.fieldId] = draft.values[question.fieldId];
  }
  return carried;
}

/** «Mantener las respuestas para la siguiente»: everything but the files. */
export function keepForNextEntry(draft: EntryDraft): EntryDraft {
  return { values: draft.values, choices: draft.choices, files: {} };
}

/** Type, size and count are checked before sending; the server checks the content again. */
export function entryFileProblem(question: FormEntryQuestion, current: readonly File[], file: File, maxFileSizeMiB: number): EntryFileProblem | null {
  if (!(question.type === "photo" ? photoTypes : documentTypes).includes(file.type)) return question.type === "photo" ? "photoType" : "documentType";
  if (file.size > maxFileSizeMiB * 1024 * 1024) return "size";
  return current.length >= (question.files?.maxFiles ?? 0) ? "count" : null;
}

/** What a send carries: the same signature repeats its request, so a retry neither duplicates nor takes another number. */
export function entrySignature(entry: FormEntry, draft: EntryDraft): string {
  const send = toEntrySend(entry, draft, "00000000-0000-4000-8000-000000000000");
  return JSON.stringify([send.versionId, send.answers, send.files.map(({ fieldId, file }) => [fieldId, file.name, file.size, file.type, file.lastModified])]);
}
