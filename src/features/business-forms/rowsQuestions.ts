import { moveItem, newQuestion } from "./editorModel";
import { formScreens } from "./fileQuestions";
import type { DraftQuestion, FormCulture } from "./model";

// The block of rows (RG1-A) is a question of the flat list; the questions of each row follow it, marked repeated (RG6-A).
export interface RowsBlock { readonly index: number; readonly end: number }
export function rowsBlock(fields: readonly DraftQuestion[]): RowsBlock | null {
  const index = fields.findIndex(field => field.type === "group");
  if (index < 0) return null;
  let end = index + 1;
  while (end < fields.length && isRepeated(fields[end]!)) end++;
  return { index, end };
}
const isRepeated = (question: DraftQuestion) => "repeated" in question && question.repeated === true;
/** What a row holds: neither several choices, files nor another block. */
export const canRepeat = (question: DraftQuestion) => question.type !== "photo" && question.type !== "document" && question.type !== "multiChoice" && question.type !== "group";
/** The block is not one of the forty questions. */
export const questionCount = (fields: readonly DraftQuestion[]) => fields.filter(field => field.type !== "group").length;

// Entering or leaving the block makes a saved question a new one, as changing its type: its old answers keep their column.
function rowIdentity(question: DraftQuestion, repeated: boolean, localId: string, choiceLocalId: () => string): DraftQuestion {
  const saved = question.fieldId !== null;
  const { repeated: _mark, ...rest } = question as DraftQuestion & { repeated?: true };
  const identity = saved ? { localId, fieldId: null, replacesFieldId: question.fieldId } : {};
  const options = saved && question.type === "choice" && !question.source
    ? { options: question.options.map(option => ({ ...option, localId: choiceLocalId(), choiceId: null })) } : {};
  return { ...rest, ...identity, ...options, ...(repeated ? { repeated: true } : {}) } as DraftQuestion;
}

export interface RowsIdentities { readonly question: () => string; readonly choice: () => string; readonly block: () => string }
// RG6-A: a marked question joins the end of the block; without one, it creates the block in its place, with a name until
// the author gives it another. An unmarked one leaves the block and stays right after it.
export function markRepeated(fields: readonly DraftQuestion[], localId: string, repeated: boolean, culture: FormCulture, blockName: string,
  ids: RowsIdentities): readonly DraftQuestion[] {
  const index = fields.findIndex(field => field.localId === localId);
  const question = fields[index];
  if (!question || !canRepeat(question) || isRepeated(question) === repeated) return fields;
  const moved = rowIdentity(question, repeated, ids.question(), ids.choice);
  const rest = fields.filter((_, position) => position !== index);
  const block = rowsBlock(rest);
  if (!block) {
    if (!repeated) return fields;
    const created = { ...newQuestion("group", culture, ids.block()), label: { [culture]: blockName } };
    return [...rest.slice(0, index), created, moved, ...rest.slice(index)];
  }
  return [...rest.slice(0, block.end), moved, ...rest.slice(block.end)];
}

/** «Agregar pregunta» inside the block: a short text, marked, at its end. */
export function addRowQuestion(fields: readonly DraftQuestion[], culture: FormCulture, localId: string): readonly DraftQuestion[] {
  const block = rowsBlock(fields);
  if (!block) return fields;
  return [...fields.slice(0, block.end), { ...newQuestion("shortText", culture, localId), repeated: true } as DraftQuestion, ...fields.slice(block.end)];
}

// The list moves by its items: the block goes with its questions, and a question jumps over the whole block.
export function moveTopLevel(fields: readonly DraftQuestion[], localId: string, delta: number): readonly DraftQuestion[] {
  const items: DraftQuestion[][] = [];
  for (let index = 0; index < fields.length;) {
    const end = fields[index]!.type === "group" ? rowsBlock(fields.slice(index))!.end + index : index + 1;
    items.push(fields.slice(index, end));
    index = end;
  }
  const position = items.findIndex(item => item[0]!.localId === localId);
  const moved = moveItem(items, position, delta);
  return moved === items ? fields : moved.flat();
}

/** A question of the block moves only inside it. */
export function moveInRows(fields: readonly DraftQuestion[], localId: string, delta: number): readonly DraftQuestion[] {
  const block = rowsBlock(fields);
  const index = fields.findIndex(field => field.localId === localId);
  if (!block || index <= block.index || index >= block.end || index + delta <= block.index || index + delta >= block.end) return fields;
  return moveItem(fields, index, delta);
}

/** The block's trash removes it with its questions. */
export function removeBlock(fields: readonly DraftQuestion[]): readonly DraftQuestion[] {
  const block = rowsBlock(fields);
  return block ? [...fields.slice(0, block.index), ...fields.slice(block.end)] : fields;
}

// WhatsApp loads up to ten rows (RG3-A); the backend seals the same number in its Flow profile.
const whatsAppRows = 10;
type BlockQuestion = Extract<DraftQuestion, { type: "group" }>;
export type PreviewScreen =
  | { readonly kind: "fields"; readonly questions: readonly DraftQuestion[] }
  | { readonly kind: "ask"; readonly block: BlockQuestion }
  | { readonly kind: "row"; readonly block: BlockQuestion; readonly questions: readonly DraftQuestion[]; readonly asks: boolean };
/** The preview follows the WhatsApp screens: before the block, «¿Agregás un renglón?» with a minimum of 0, one row as an example and after it. */
export function previewScreens(fields: readonly DraftQuestion[]): readonly PreviewScreen[] {
  const block = rowsBlock(fields);
  if (!block) return formScreens(fields).map(questions => ({ kind: "fields", questions }));
  const group = fields[block.index] as BlockQuestion;
  const split = (part: readonly DraftQuestion[]): PreviewScreen[] => formScreens(part).filter(questions => questions.length > 0).map(questions => ({ kind: "fields", questions }));
  const minimum = group.rows.minRows ?? 1;
  const rows = Math.min(whatsAppRows, group.rows.maxRows ?? 1);
  return [...split(fields.slice(0, block.index)), ...(minimum === 0 ? [{ kind: "ask" as const, block: group }] : []),
    // From the minimum, a row ends with «¿Agregás otro renglón?», except the last one.
    { kind: "row", block: group, questions: fields.slice(block.index + 1, block.end), asks: Math.max(minimum, 1) <= 1 && rows > 1 },
    ...split(fields.slice(block.end))];
}

/** The list's numbers: the block is one more («5») and its questions go after it («5.1», «5.2»…). */
export function questionNumbers(fields: readonly DraftQuestion[]): readonly string[] {
  let top = 0;
  let inBlock = false;
  let row = 0;
  return fields.map(field => {
    if (inBlock && isRepeated(field)) return `${top}.${++row}`;
    inBlock = field.type === "group";
    row = 0;
    return String(++top);
  });
}
