import { localizedValue } from "./editorModel";
import type { DraftQuestion, FormCulture } from "./model";

/** How a filter by another answer names its question (CW7): by its field identity once saved, by its local one while new. */
export const questionIdentity = (question: Pick<DraftQuestion, "fieldId" | "localId">) => question.fieldId ?? question.localId;

/** Why a question cannot give the answer a list depends on: it comes after, it chooses several or from another catalog. */
export type AnswerReason = "later" | "multiple" | "otherCatalog";
export interface AnswerChoice {
  readonly id: string;
  readonly number: number;
  readonly label: string;
  readonly catalog: string;
  readonly reason: AnswerReason | null;
}

/**
 * The questions whose answer the list of `current` (a local identity) can depend on: every other catalog question of the form,
 * in order, with the reason it cannot be chosen. Only an earlier single choice of the field's source catalog can (CW7).
 */
export function answerChoices(questions: readonly DraftQuestion[], current: string, sourceCatalogId: string | null,
  culture: FormCulture, original: FormCulture): AnswerChoice[] {
  const index = questions.findIndex(question => question.localId === current);
  return questions.flatMap((question, position): AnswerChoice[] => {
    if (position === index || (question.type !== "choice" && question.type !== "multiChoice") || !question.source?.catalog) return [];
    const reason = position > index ? "later" : question.type === "multiChoice" ? "multiple" : question.source.catalog !== sourceCatalogId ? "otherCatalog" : null;
    return [{ id: questionIdentity(question), number: position + 1, label: localizedValue(question.label, culture, original), catalog: question.source.catalog, reason }];
  });
}
