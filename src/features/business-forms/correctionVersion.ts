import type { FormEntry, FormEntryCorrection } from "./api/entries";

/** What the notice of a correction says (VF1-A, decision 6): the active version it is corrected with and the questions that start empty. */
export interface CorrectionVersionNotice { readonly versionNumber: number; readonly empty: readonly string[] }

/**
 * A response reads with its own version and is corrected with the active one. When they differ, the notice names the active
 * version and, in its order, the questions that start empty: the ones it added, and the ones the response answered whose answer
 * does not come along. A question left empty in the response is not named. A calculation is computed again, and the questions of
 * the block go with it.
 */
export function correctionVersionNotice(recordEntry: FormEntry, correction: FormEntryCorrection, answered: ReadonlySet<string>): CorrectionVersionNotice | null {
  if (recordEntry.versionId === correction.entry.versionId) return null;
  const before = new Set(recordEntry.questions.map(question => question.fieldId));
  const carried = new Set([...correction.answers.map(answer => answer.fieldId), ...correction.files.map(file => file.fieldId)]);
  const empty = correction.entry.questions.filter(question => !question.calculation && !question.repeated && !carried.has(question.fieldId)
    && (!before.has(question.fieldId) || answered.has(question.fieldId))).map(question => question.label);
  return { versionNumber: correction.entry.versionNumber, empty };
}

/** The questions a response answered, for the notice: those whose value in the detail is not empty («No» is an answer). */
export function answeredQuestions(values: readonly { readonly fieldId: string; readonly value: unknown }[]): ReadonlySet<string> {
  return new Set(values.filter(({ value }) => value !== null && value !== "" && !(Array.isArray(value) && value.length === 0)).map(({ fieldId }) => fieldId));
}
