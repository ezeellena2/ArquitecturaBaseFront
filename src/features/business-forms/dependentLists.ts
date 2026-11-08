import { localizedValue } from "./editorModel";
import type { DraftQuestion, FormCulture } from "./model";
import { questionNumbers } from "./rowsQuestions";

/** How a filter by another answer names its question (CW7): by its field identity once saved, by its local one while new. */
export const questionIdentity = (question: Pick<DraftQuestion, "fieldId" | "localId">) => question.fieldId ?? question.localId;

/**
 * Why a question cannot give the answer a list depends on: it comes after, it chooses several or from another catalog, or it is
 * in the block and the list is not (LD3-A).
 */
export type AnswerReason = "later" | "multiple" | "otherCatalog" | "inBlock";
export interface AnswerChoice {
  readonly id: string;
  /** Its number in the list of questions: «2» or, in the block, «2.1». */
  readonly number: string;
  readonly label: string;
  readonly catalog: string;
  readonly reason: AnswerReason | null;
  /** For a list of the block (LD3-A): the answer is the one of its own item or, from a question outside, the one for all the items. */
  readonly items?: "same" | "all";
}
const repeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;

/**
 * The questions whose answer the list of `current` (a local identity) can depend on: every other catalog question of the form,
 * in order, with the reason it cannot be chosen. Only an earlier single choice of the field's source catalog can (CW7). With
 * the block (LD3-A), a list of the block takes the answer of its own item or the one outside for all the items, and a list
 * outside the block cannot take one of an item.
 */
export function answerChoices(questions: readonly DraftQuestion[], current: string, sourceCatalogId: string | null,
  culture: FormCulture, original: FormCulture): AnswerChoice[] {
  const index = questions.findIndex(question => question.localId === current);
  const numbers = questionNumbers(questions);
  const ownInBlock = index >= 0 && repeated(questions[index]!);
  return questions.flatMap((question, position): AnswerChoice[] => {
    if (position === index || (question.type !== "choice" && question.type !== "multiChoice") || !question.source?.catalog) return [];
    const reason = !ownInBlock && repeated(question) ? "inBlock" : position > index ? "later" : question.type === "multiChoice" ? "multiple"
      : question.source.catalog !== sourceCatalogId ? "otherCatalog" : null;
    return [{ id: questionIdentity(question), number: numbers[position]!, label: localizedValue(question.label, culture, original), catalog: question.source.catalog,
      reason, ...ownInBlock ? { items: repeated(question) ? "same" as const : "all" as const } : {} }];
  });
}
