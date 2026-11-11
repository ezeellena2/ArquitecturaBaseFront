import type { FormEntry } from "./api/entries";
import { questionIdentity } from "./dependentLists";
import { localizedValue } from "./editorModel";
import type { EntryDraft } from "./entryForm";
import type { DraftQuestion, FormCulture, LocalizedText } from "./model";
import { questionNumbers } from "./rowsQuestions";

// CO1-A: a question shows only when an earlier question outside the block has one of the answers chosen. Neither the block nor
// its questions take a condition in this stage, and the question named goes before, so there are no cycles.

const repeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;

/** Whether a question can say when it shows: not the block nor a question of it, in this stage, nor a location (the server refuses it). */
export const canHaveCondition = (question: DraftQuestion) => question.type !== "group" && question.type !== "location" && !repeated(question);

/** A question a condition can name: by its identity, its number in the list and its kind of answer. */
export interface ConditionCandidate {
  readonly id: string;
  readonly number: string;
  readonly label: string;
  readonly kind: "own" | "catalog" | "boolean";
  readonly catalog?: string;
}

/** The earlier questions outside the block that a condition can name: choose one, own or from a catalog, or yes or no. */
export function conditionCandidates(fields: readonly DraftQuestion[], localId: string, culture: FormCulture, original: FormCulture): ConditionCandidate[] {
  const index = fields.findIndex(question => question.localId === localId);
  const numbers = questionNumbers(fields);
  return fields.slice(0, Math.max(index, 0)).flatMap((question, position): ConditionCandidate[] => {
    if (repeated(question) || question.type !== "choice" && question.type !== "boolean") return [];
    const common = { id: questionIdentity(question), number: numbers[position]!, label: localizedValue(question.label, culture, original) };
    if (question.type === "boolean") return [{ ...common, kind: "boolean" }];
    return question.source ? (question.source.catalog ? [{ ...common, kind: "catalog", catalog: question.source.catalog }] : []) : [{ ...common, kind: "own" }];
  });
}

/** An answer a condition can choose: an own option (by its identity, or its local one while new) or yes or no. */
export type ConditionAnswer = { readonly id: string; readonly label: LocalizedText } | { readonly id: "true" | "false"; readonly yes: boolean };

/** The answers of the question named, in its order; null for a catalog question, whose options are read from the catalog. */
export function conditionAnswers(question: DraftQuestion): readonly ConditionAnswer[] | null {
  if (question.type === "boolean") return [{ id: "true", yes: true }, { id: "false", yes: false }];
  if (question.type === "choice" && !question.source) return question.options.map(option => ({ id: option.choiceId ?? option.localId, label: option.label }));
  return null;
}

/** «Según otra respuesta» starts without its question; «Siempre» takes the condition away (it is omitted, not null). */
export function withCondition(question: DraftQuestion, conditioned: boolean): DraftQuestion {
  const { showWhen, ...rest } = question;
  return conditioned ? { ...rest, showWhen: showWhen ?? { questionId: null, values: [] } } as DraftQuestion : rest as DraftQuestion;
}

/** Another question clears the answers chosen for the one before: they were its own. */
export function chooseConditionQuestion(question: DraftQuestion, questionId: string): DraftQuestion {
  if (question.showWhen?.questionId === questionId) return question;
  return { ...question, showWhen: { questionId, values: [] } };
}

/** Adds or removes an answer that shows the question, keeping the order of the question's answers (`order`). */
export function toggleConditionAnswer(question: DraftQuestion, value: string, chosen: boolean, order: readonly string[]): DraftQuestion {
  const showWhen = question.showWhen;
  if (!showWhen) return question;
  const values = chosen ? [...new Set([...showWhen.values, value])] : showWhen.values.filter(item => item !== value);
  const position = (item: string) => { const index = order.indexOf(item); return index < 0 ? order.length : index; };
  return { ...question, showWhen: { ...showWhen, values: [...values].sort((a, b) => position(a) - position(b)) } };
}

/** Whether a condition cannot be saved yet: «Según otra respuesta» without its question or without an answer. */
export function conditionIncomplete(question: DraftQuestion): boolean {
  return !!question.showWhen && (question.showWhen.questionId === null || question.showWhen.values.length === 0);
}

/**
 * The questions hidden with these answers, in the order of the form, as the server decides on receiving: a question shows when
 * the one it names is shown and has one of its answers (the option chosen, or "true"/"false"); a missing answer, or a question
 * named that is hidden, hides it too.
 */
export function entryHiddenQuestions(entry: FormEntry, draft: EntryDraft): Set<string> {
  const hidden = new Set<string>();
  for (const question of entry.questions) {
    const showWhen = question.showWhen;
    if (!showWhen) continue;
    const named = entry.questions.find(item => item.fieldId === showWhen.questionId);
    const answer = !named || hidden.has(named.fieldId) ? undefined
      : named.type === "boolean" ? draft.values[named.fieldId] : draft.choices[named.fieldId]?.[0]?.id;
    if (answer === undefined || !showWhen.values.includes(answer)) hidden.add(question.fieldId);
  }
  return hidden;
}
