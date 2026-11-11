import type { DraftQuestion, FormDefinitionStandard } from "./model";
import { rowsBlock } from "./rowsQuestions";

// BI1-A: a form added from the library keeps the questions its standard needs. Their text, help and place change; everything
// else (type, block, catalog, options, calculation, condition, rows, length, required) stays, and they are not removed.

/** The field identities of the questions the standard needs; none without a standard. */
export function boundQuestionIds(standard: FormDefinitionStandard | null | undefined): ReadonlySet<string> {
  return new Set(Object.values(standard?.bound ?? {}).map(fieldId => fieldId.toLowerCase()));
}

/** Whether the standard needs this question: a new question, or one with a new identity, never is. */
export const isBoundQuestion = (question: Pick<DraftQuestion, "fieldId">, bound: ReadonlySet<string>) =>
  question.fieldId !== null && bound.has(question.fieldId.toLowerCase());

/** Whether removing this question takes a bound one with it: the block goes with its questions. */
export function removesBoundQuestion(fields: readonly DraftQuestion[], localId: string, bound: ReadonlySet<string>): boolean {
  const index = fields.findIndex(question => question.localId === localId);
  const question = fields[index];
  if (!question) return false;
  const block = question.type === "group" ? rowsBlock(fields) : null;
  return (block ? fields.slice(block.index, block.end) : [question]).some(item => isBoundQuestion(item, bound));
}

/** The standard's name as the library lists it in the menu language; a standard it no longer lists, by its key. */
export const standardName = (standard: Pick<FormDefinitionStandard, "key">, library: readonly { readonly key: string; readonly name: string }[] | undefined) =>
  library?.find(item => item.key === standard.key)?.name ?? standard.key;
