import { openDraftSession } from "./draftSession";
import type { DraftChoice, DraftEditorValue, DraftQuestion, FormCulture, FormDefinitionSnapshot, LocalizedText } from "./model";

export const localizedValue = (text: LocalizedText | Readonly<Record<string, string | null>> | null, culture: FormCulture, original: FormCulture) => text?.[culture]?.trim() ? text[culture]! : text?.[original] ?? "";
export const administrativeName = (name: LocalizedText, culture: FormCulture) => name[culture]?.trim() ? name[culture]! : name[culture === "es" ? "en" : "es"] ?? "";
export const suggestedPrefix = (name: string) => (name.trim().split(/\s+/).at(-1) ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
export function emptyForm(culture: FormCulture): DraftEditorValue {
  return { name: { [culture]: "" }, prefix: "", draft: { format: 1, culture, submitLabel: { [culture]: culture === "es" ? "Enviar" : "Submit" }, fields: [] } };
}
export type QuestionEditorType = DraftQuestion["type"] | "catalogChoice";
export const questionEditorType = (question: DraftQuestion): QuestionEditorType => question.type === "choice" && question.source ? "catalogChoice" : question.type;
export function newQuestion(type: QuestionEditorType, culture: FormCulture, localId: string): DraftQuestion {
  const common = { localId, fieldId: null, replacesFieldId: null, label: { [culture]: "" }, help: null, required: false };
  return type === "shortText" || type === "longText" ? { ...common, type, maxLength: type === "shortText" ? 80 : 600 }
    : type === "catalogChoice" ? { ...common, type: "choice", source: { catalog: null } }
    : type === "choice" ? { ...common, type, options: [{ localId: "first-option", choiceId: null, label: { [culture]: "" } }] } : { ...common, type };
}
export function replaceQuestionType(question: DraftQuestion, type: QuestionEditorType, localId: string, culture: FormCulture): DraftQuestion {
  return { ...newQuestion(type, culture, localId), label: question.label, help: question.help, required: question.required,
    replacesFieldId: question.fieldId ?? question.replacesFieldId };
}
export function changeQuestionCatalog(question: DraftQuestion, catalogId: string, localId: string): DraftQuestion {
  if (question.type !== "choice" || !question.source || question.source.catalog === catalogId) return question;
  return { ...question, source: { catalog: catalogId }, ...(question.fieldId ? { localId, fieldId: null, replacesFieldId: question.fieldId } : {}) };
}
export function moveItem<T>(items: readonly T[], index: number, delta: number): readonly T[] {
  const result = [...items]; const destination = index + delta;
  if (index < 0 || index >= result.length || destination < 0 || destination >= result.length) return items;
  [result[index], result[destination]] = [result[destination]!, result[index]!]; return result;
}
export function questionTexts(question: DraftQuestion) {
  return [question.label, ...(question.type === "choice" && !question.source ? question.options.map(o => o.label) : []),
    ...(question.help && Object.values(question.help).some(text => !!text?.trim()) ? [question.help] : [])];
}
export const missingQuestionTexts = (question: DraftQuestion, culture: FormCulture) => questionTexts(question).filter(map => !map[culture]?.trim()).length;
export const missingFormTexts = (value: DraftEditorValue, culture: FormCulture) => [value.name, value.draft.submitLabel, ...value.draft.fields.flatMap(questionTexts)].filter(map => !map[culture]?.trim()).length;

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fieldIdentity = (q: DraftQuestion) => q.fieldId ?? "new:" + q.localId;
const choiceIdentity = (o: DraftChoice) => o.choiceId ?? "new:" + o.localId;
const metadata = (q: DraftQuestion) => ({ fieldId: q.fieldId, replacesFieldId: q.replacesFieldId, type: q.type, source: q.source ?? null, required: q.required, ...("maxLength" in q ? { maxLength: q.maxLength } : {}) });
type EditableTexts = Readonly<Record<string, string | null>> | null;
export interface DraftReviewRow {
  readonly id: string;
  readonly kind: "name" | "prefix" | "submit" | "field" | "fieldText" | "order" | "option" | "optionOrder";
  readonly parentId?: string;
  readonly optionId?: string;
  readonly culture?: FormCulture;
  readonly property?: "label" | "help";
  readonly mine: string | LocalizedText | DraftQuestion | DraftChoice | readonly string[] | null;
  readonly current: string | LocalizedText | DraftQuestion | DraftChoice | readonly string[] | null;
  readonly canKeep: boolean;
}
export interface DraftReview { readonly mine: DraftEditorValue; readonly current: DraftEditorValue; readonly definition: FormDefinitionSnapshot; readonly rows: readonly DraftReviewRow[] }
export function createDraftReview(mine: DraftEditorValue, definition: FormDefinitionSnapshot): DraftReview {
  const saved = openDraftSession({ actorId: "review", editorId: "review" }, definition).value;
  const rows: DraftReviewRow[] = [];
  function localizedRows(id: string, kind: "name" | "submit" | "fieldText" | "option", local: EditableTexts, current: EditableTexts, context: Pick<DraftReviewRow, "parentId" | "optionId" | "property"> = {}) {
    for (const culture of ["es", "en"] as const) {
      const ours = local?.[culture] ?? null; const theirs = current?.[culture] ?? null;
      if (ours !== theirs) rows.push({ ...context, id: id + ":" + culture, kind, culture, mine: ours, current: theirs, canKeep: true });
    }
  }
  localizedRows("name", "name", mine.name, saved.name);
  localizedRows("submit", "submit", mine.draft.submitLabel, saved.draft.submitLabel);
  if (mine.prefix !== saved.prefix) rows.push({ id: "prefix", kind: "prefix", mine: mine.prefix, current: saved.prefix, canKeep: !definition.prefixLocked });
  const theirs = new Map(saved.draft.fields.map(q => [fieldIdentity(q), q]));
  const ours = new Map(mine.draft.fields.map(q => [fieldIdentity(q), q]));
  for (const id of new Set([...theirs.keys(), ...ours.keys()])) {
    const local = ours.get(id); const current = theirs.get(id);
    if (!local || !current || !equal(metadata(local), metadata(current))) {
      const retired = local?.fieldId && !current || local?.replacesFieldId && !theirs.has(local.replacesFieldId);
      rows.push({ id: "field:" + id, kind: "field", parentId: id, mine: local ?? null, current: current ?? null, canKeep: !retired });
    }
    if (!local || !current) continue;
    localizedRows("label:" + id, "fieldText", local.label, current.label, { parentId: id, property: "label" });
    localizedRows("help:" + id, "fieldText", local.help, current.help, { parentId: id, property: "help" });
    if (local.type !== "choice" || local.source || current.type !== "choice" || current.source) continue;
    const localOptions = new Map(local.options.map(o => [choiceIdentity(o), o]));
    const liveOptions = new Map(current.options.map(o => [choiceIdentity(o), o]));
    for (const optionId of new Set([...localOptions.keys(), ...liveOptions.keys()])) {
      const myOption = localOptions.get(optionId); const liveOption = liveOptions.get(optionId);
      const rowId = "option:" + JSON.stringify([id, optionId]);
      if (myOption && liveOption) localizedRows(rowId, "option", myOption.label, liveOption.label, { parentId: id, optionId });
      else rows.push({ id: rowId, kind: "option", parentId: id, optionId, mine: myOption ?? null, current: liveOption ?? null, canKeep: !(myOption?.choiceId && !liveOption) });
    }
    const localOrder = local.options.map(choiceIdentity); const currentOrder = current.options.map(choiceIdentity);
    if (!equal(localOrder, currentOrder)) rows.push({ id: "optionOrder:" + JSON.stringify(id), kind: "optionOrder", parentId: id, mine: localOrder, current: currentOrder, canKeep: true });
  }
  const myOrder = mine.draft.fields.map(fieldIdentity); const savedOrder = saved.draft.fields.map(fieldIdentity);
  if (!equal(myOrder, savedOrder)) rows.push({ id: "order", kind: "order", mine: myOrder, current: savedOrder, canKeep: true });
  return { mine, current: saved, definition, rows };
}
function withText(map: EditableTexts, culture: FormCulture, value: string | null): Record<string, string> {
  const next = Object.fromEntries(Object.entries(map ?? {}).filter((entry): entry is [string, string] => entry[1] !== null));
  if (value === null) delete next[culture]; else next[culture] = value;
  return next;
}
export function resolveDraftReview(review: DraftReview, choices: Readonly<Record<string, string>>): DraftEditorValue | null {
  if (review.rows.some(row => !["mine", "current"].includes(choices[row.id] ?? "") || choices[row.id] === "mine" && !row.canKeep)) return null;
  let result = { ...review.current, draft: { ...review.current.draft } };
  const fields = new Map(review.current.draft.fields.map(q => [fieldIdentity(q), q]));
  for (const row of review.rows) {
    const selected = choices[row.id] === "mine" ? row.mine : row.current;
    if (row.kind === "name") result = { ...result, name: withText(result.name, row.culture!, selected as string | null) };
    if (row.kind === "prefix") result = { ...result, prefix: selected as string };
    if (row.kind === "submit") result.draft = { ...result.draft, submitLabel: withText(result.draft.submitLabel, row.culture!, selected as string | null) };
    if (row.kind === "field") {
      const id = row.parentId!; const old = fields.get(id);
      if (!selected) fields.delete(id);
      else {
        const q = selected as DraftQuestion;
        const common = old ? { ...q, label: old.label, help: old.help } : q;
        fields.set(id, common.type === "choice" && !common.source && old?.type === "choice" && !old.source ? { ...common, options: old.options } : common);
      }
    }
  }
  for (const row of review.rows.filter(r => r.kind === "fieldText")) {
    const parent = fields.get(row.parentId!); if (!parent) continue;
    const selected = (choices[row.id] === "mine" ? row.mine : row.current) as string | null;
    fields.set(row.parentId!, row.property === "help"
      ? { ...parent, help: { ...parent.help, [row.culture!]: selected?.trim() ? selected : null } }
      : { ...parent, label: withText(parent.label, row.culture!, selected) });
  }
  for (const row of review.rows.filter(r => r.kind === "option")) {
    const parent = fields.get(row.parentId!); if (parent?.type !== "choice" || parent.source) continue;
    const options = new Map(parent.options.map(o => [choiceIdentity(o), o]));
    const selected = choices[row.id] === "mine" ? row.mine : row.current;
    if (row.culture) {
      const option = options.get(row.optionId!);
      if (option) options.set(row.optionId!, { ...option, label: withText(option.label, row.culture, selected as string | null) });
    } else if (selected) options.set(row.optionId!, selected as DraftChoice); else options.delete(row.optionId!);
    fields.set(row.parentId!, { ...parent, options: [...options.values()] });
  }
  for (const [id, parent] of fields) {
    if (parent.type !== "choice" || parent.source) continue;
    const orderRow = review.rows.find(row => row.kind === "optionOrder" && row.parentId === id);
    const source = orderRow && choices[orderRow.id] === "mine" ? review.mine : review.current;
    const original = source.draft.fields.find(q => fieldIdentity(q) === id);
    const options = new Map(parent.options.map(o => [choiceIdentity(o), o]));
    const order = original?.type === "choice" && !original.source ? original.options.map(choiceIdentity) : [];
    fields.set(id, { ...parent, options: [...new Set([...order, ...options.keys()])].flatMap(o => options.has(o) ? [options.get(o)!] : []) });
  }
  const order = choices.order === "mine" ? review.mine : review.current;
  const keys = [...new Set([...order.draft.fields.map(fieldIdentity), ...fields.keys()])];
  result.draft = { ...result.draft, fields: keys.flatMap(id => fields.has(id) ? [fields.get(id)!] : []) };
  return result;
}
