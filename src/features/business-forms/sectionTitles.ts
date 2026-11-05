import { moveItem } from "./editorModel";
import { addRowQuestion, markRepeated, rowsBlock, type RowsIdentities } from "./rowsQuestions";
import type { DraftQuestion, DraftSection, FormCulture } from "./model";

// Section titles (CW15-B) are not questions: each one says how many questions go before it (`start`). The editor shows them
// as rows of the question list; these helpers keep that place when the questions change around them.

/** A row of the editor's list: a question (the block, with its questions) or a section title. */
export type ListEntry =
  | { readonly kind: "question"; readonly questions: readonly DraftQuestion[] }
  | { readonly kind: "title"; readonly section: DraftSection };

/** The list in order: each title right before the question it starts at, those after the last question at the end. */
export function listEntries(fields: readonly DraftQuestion[], sections: readonly DraftSection[] = []): readonly ListEntry[] {
  const entries: ListEntry[] = [];
  let next = 0;
  for (let index = 0; index < fields.length;) {
    while (next < sections.length && sections[next]!.start <= index) entries.push({ kind: "title", section: sections[next++]! });
    const end = fields[index]!.type === "group" ? index + rowsBlock(fields.slice(index))!.end : index + 1;
    entries.push({ kind: "question", questions: fields.slice(index, end) });
    index = end;
  }
  while (next < sections.length) entries.push({ kind: "title", section: sections[next++]! });
  return entries;
}

const entryId = (entry: ListEntry) => entry.kind === "title" ? entry.section.localId : entry.questions[0]!.localId;

function fromEntries(entries: readonly ListEntry[]) {
  const fields: DraftQuestion[] = [];
  const sections: DraftSection[] = [];
  for (const entry of entries) {
    if (entry.kind === "title") sections.push({ ...entry.section, start: fields.length });
    else fields.push(...entry.questions);
  }
  return { fields, sections };
}

/** Where an entry is in the list and how many there are, for ↑ ↓ and what they announce. */
export function listPosition(fields: readonly DraftQuestion[], sections: readonly DraftSection[], localId: string) {
  const entries = listEntries(fields, sections);
  return { position: entries.findIndex(entry => entryId(entry) === localId) + 1, total: entries.length };
}

/** ↑ ↓ move a question, the block or a title one place: across a title a question changes section, and a title jumps the whole block. */
export function moveListEntry(fields: readonly DraftQuestion[], sections: readonly DraftSection[], localId: string, delta: number) {
  const entries = listEntries(fields, sections);
  const moved = moveItem(entries, entries.findIndex(entry => entryId(entry) === localId), delta);
  return moved === entries ? { fields, sections } : fromEntries(moved);
}

/** «Agregar título» adds an empty title at the end of the list: the next question goes below it. */
export const addSectionTitle = (fields: readonly DraftQuestion[], sections: readonly DraftSection[], culture: FormCulture, localId: string): readonly DraftSection[] =>
  [...sections, { localId, start: fields.length, title: { [culture]: "" } }];

// Questions removed at [index, index + count): the titles after them move up with them; one right before them stays.
const removed = (sections: readonly DraftSection[], index: number, count: number) =>
  sections.map(section => section.start > index ? { ...section, start: Math.max(index, section.start - count) } : section);
// A question inserted at index goes before a title that started there: that title, and those after it, move down.
const inserted = (sections: readonly DraftSection[], index: number) =>
  sections.map(section => section.start >= index ? { ...section, start: section.start + 1 } : section);

/** Removing a question, or the block with its questions, leaves the titles where they were. */
export function removeQuestionWithTitles(fields: readonly DraftQuestion[], sections: readonly DraftSection[], localId: string) {
  const index = fields.findIndex(field => field.localId === localId);
  if (index < 0) return { fields, sections };
  const block = fields[index]!.type === "group" ? rowsBlock(fields) : null;
  const [from, count] = block ? [block.index, block.end - block.index] : [index, 1];
  return { fields: [...fields.slice(0, from), ...fields.slice(from + count)], sections: removed(sections, from, count) };
}

/** «Agregar pregunta» inside the block adds at its end, before a title right after the block. */
export function addRowQuestionWithTitles(fields: readonly DraftQuestion[], sections: readonly DraftSection[], culture: FormCulture, localId: string) {
  const block = rowsBlock(fields);
  return block ? { fields: addRowQuestion(fields, culture, localId), sections: inserted(sections, block.end) } : { fields, sections };
}

/** «Se carga varias veces» moves a question into or out of the block (RG6-A); the titles stay around the questions they were. */
export function markRepeatedWithTitles(fields: readonly DraftQuestion[], sections: readonly DraftSection[], localId: string, repeated: boolean,
  culture: FormCulture, blockName: string, ids: RowsIdentities) {
  const next = markRepeated(fields, localId, repeated, culture, blockName, ids);
  if (next === fields || !repeated) return { fields: next, sections };
  const index = fields.findIndex(field => field.localId === localId);
  // Without a block, the question becomes the block and its question in its place: a title before it stays before the block.
  if (!rowsBlock(fields)) return { fields: next, sections: inserted(sections, index + 1) };
  return { fields: next, sections: inserted(removed(sections, index, 1), rowsBlock(fields.filter((_, at) => at !== index))!.end) };
}

/** The title that opens each section, by its first question: what the preview shows as a subtitle. A title without questions has none. */
export function titlesByFirstQuestion(fields: readonly DraftQuestion[], sections: readonly DraftSection[] = []): ReadonlyMap<string, DraftSection> {
  return new Map(sections.flatMap((section, index) => {
    const next = sections[index + 1]?.start ?? fields.length;
    return section.start < next && section.start < fields.length ? [[fields[section.start]!.localId, section] as const] : [];
  }));
}
