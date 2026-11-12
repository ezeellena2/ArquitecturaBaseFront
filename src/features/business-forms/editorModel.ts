import { normalizeCatalogQuestionSource } from "./catalogQuestionSource";
import { openDraftSession } from "./draftSession";
import { locationContactAssignment, withLocationContactAssignment, type LocationContactAssignment } from "./locationContact";
import type { DraftCalculation, DraftChoice, DraftEditorValue, DraftQuestion, DraftSection, FormCalculationOperation, FormCulture, FormDefinitionSnapshot, FormDocumentReading,
  LocalizedText } from "./model";

export const localizedValue = (text: LocalizedText | Readonly<Record<string, string | null>> | null, culture: FormCulture, original: FormCulture) => text?.[culture]?.trim() ? text[culture]! : text?.[original] ?? "";
type ContentTexts = Readonly<Record<string, string | null | undefined>> | null | undefined;
const otherCulture = (culture: FormCulture): FormCulture => culture === "es" ? "en" : "es";
export const administrativeName = (name: ContentTexts, culture: FormCulture) => name?.[culture]?.trim() ? name[culture]! : name?.[otherCulture(culture)] ?? "";
/** The original's text, shown as a hint (never copied) while the menu is in the other language. */
export const contentReference = (text: ContentTexts, culture: FormCulture, original: FormCulture) => culture !== original && text?.[original]?.trim() ? text[original]! : undefined;
/** Only the original is required; the other language is an optional translation. */
export const contentRequired = (_text: ContentTexts, culture: FormCulture, original: FormCulture) => original === culture;
/** The trimmed languages that have text: a blank translation is not sent. */
export const ownTexts = (text: ContentTexts): Partial<Record<FormCulture, string>> =>
  Object.fromEntries((["es", "en"] as const).flatMap(culture => text?.[culture]?.trim() ? [[culture, text[culture]!.trim()]] : []));
export const suggestedPrefix = (name: string) => (name.trim().split(/\s+/).at(-1) ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
/** The final button's text a new form starts with; the catalog preview shows it on its example button. */
export const defaultSubmitLabel = (culture: FormCulture) => culture === "es" ? "Enviar" : "Submit";
export function emptyForm(culture: FormCulture): DraftEditorValue {
  return { name: { [culture]: "" }, prefix: "", offerWhen: null, draft: { format: 1, culture, submitLabel: { [culture]: defaultSubmitLabel(culture) }, fields: [] } };
}
// «Cálculo» (CA1-A) is a decimal with a calculation: a type for the author, the same question for the server.
export type QuestionEditorType = Exclude<DraftQuestion["type"], "multiChoice"> | "catalogChoice" | "calculation";
export const questionEditorType = (question: DraftQuestion): QuestionEditorType => question.type === "choice" || question.type === "multiChoice" ? question.source ? "catalogChoice" : "choice"
  : question.type === "decimal" && question.calculation ? "calculation" : question.type;
/** A new calculation multiplies, with its two places empty; a sum starts without questions. */
export const newCalculation = (operation: FormCalculationOperation = "multiply"): DraftCalculation => ({ operation, operands: operation === "sum" ? [] : [null, null] });
/** Número and Cálculo are one question for the server: switching between them keeps its identity, without asking. */
export const keepsQuestionIdentity = (question: DraftQuestion, type: QuestionEditorType) => question.type === "decimal" && (type === "decimal" || type === "calculation");
export function newQuestion(type: QuestionEditorType, culture: FormCulture, localId: string): DraftQuestion {
  const common = { localId, fieldId: null, replacesFieldId: null, label: { [culture]: "" }, help: null, required: false };
  return type === "shortText" || type === "longText" ? { ...common, type, maxLength: type === "shortText" ? 80 : 600 }
    : type === "photo" || type === "document" ? { ...common, type, files: { minFiles: 0, maxFiles: 1, ...(type === "photo" ? { photoSource: "cameraOrGallery" as const } : {}) } }
    : type === "catalogChoice" ? { ...common, type: "choice", source: { catalog: null } }
    : type === "choice" ? { ...common, type, options: [{ localId: "first-option", choiceId: null, label: { [culture]: "" } }] }
    // A new block starts with 1 and 20 rows; with a minimum it is required.
    : type === "group" ? { ...common, type, required: true, rows: { minRows: 1, maxRows: 20 } }
    // A calculation is never required.
    : type === "calculation" ? { ...common, type: "decimal", calculation: newCalculation() } : { ...common, type };
}
export function replaceQuestionType(question: DraftQuestion, type: QuestionEditorType, localId: string, culture: FormCulture): DraftQuestion {
  if (keepsQuestionIdentity(question, type) && question.type === "decimal") {
    const { calculation, ...number } = question;
    return type === "calculation" ? { ...number, required: false, calculation: calculation ?? newCalculation() } : { ...number, required: false };
  }
  const next = newQuestion(type, culture, localId);
  // CO1-A: the condition stays with the question, except on the block and a location, which take none (UB1-A).
  const condition = question.showWhen && next.type !== "group" && next.type !== "location" ? { showWhen: question.showWhen } : {};
  // A question of the block stays in it while its new type fits a row; the block's required follows its minimum.
  const repeated = "repeated" in question && question.repeated && next.type !== "photo" && next.type !== "document" && next.type !== "group" && next.type !== "location";
  return { ...next, ...(next.type === "photo" || next.type === "document" ? { files: { ...next.files, minFiles: question.required ? 1 : 0 } } : {}), label: question.label, help: question.help,
    required: next.type === "group" || type === "calculation" ? next.required : question.required, ...(repeated ? { repeated: true } : {}), ...condition,
    replacesFieldId: question.fieldId ?? question.replacesFieldId } as DraftQuestion;
}
export function changeQuestionCatalog(question: DraftQuestion, catalogId: string, localId: string): DraftQuestion {
  if ((question.type !== "choice" && question.type !== "multiChoice") || !question.source || question.source.catalog === catalogId) return question;
  return { ...question, source: { catalog: catalogId }, ...(question.fieldId ? { localId, fieldId: null, replacesFieldId: question.fieldId } : {}) };
}
export function moveItem<T>(items: readonly T[], index: number, delta: number): readonly T[] {
  const result = [...items]; const destination = index + delta;
  if (index < 0 || index >= result.length || destination < 0 || destination >= result.length) return items;
  [result[index], result[destination]] = [result[destination]!, result[index]!]; return result;
}
export function questionTexts(question: DraftQuestion) {
  return [question.label, ...((question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options.map(o => o.label) : []),
    ...(question.help && Object.values(question.help).some(text => !!text?.trim()) ? [question.help] : [])];
}
export const missingQuestionTexts = (question: DraftQuestion, culture: FormCulture) => questionTexts(question).filter(map => !map[culture]?.trim()).length;
// The texts of the form in a language: name, final button, each question's and each section title's (CW15-B).
const formTexts = (value: DraftEditorValue) => [value.name, value.draft.submitLabel, ...value.draft.fields.flatMap(questionTexts), ...(value.draft.sections ?? []).map(section => section.title)];
export const missingFormTexts = (value: DraftEditorValue, culture: FormCulture) => formTexts(value).filter(map => !map[culture]?.trim()).length;
// NI2-C (2026-11-03): a translation nobody started has no text of the form in that language.
export const hasFormTexts = (value: DraftEditorValue, culture: FormCulture) => formTexts(value).some(map => !!map[culture]?.trim());

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const fieldIdentity = (q: DraftQuestion) => q.fieldId ?? "new:" + q.localId;
const choiceIdentity = (o: DraftChoice) => o.choiceId ?? "new:" + o.localId;
const metadata = (q: DraftQuestion) => ({ fieldId: q.fieldId, replacesFieldId: q.replacesFieldId, type: q.type, source: q.source ? normalizeCatalogQuestionSource(q.source) : null, required: q.required, ...(q.type === "photo" || q.type === "document" ? { files: q.files } : {}), ...(q.type === "multiChoice" ? { selection: q.selection } : {}), ...("maxLength" in q ? { maxLength: q.maxLength } : {}), ...(q.type === "group" ? { rows: q.rows } : {}), ...("repeated" in q && q.repeated ? { repeated: true } : {}), ...(q.type === "decimal" && q.calculation ? { calculation: q.calculation } : {}), ...(q.showWhen ? { showWhen: q.showWhen } : {}) });
type EditableTexts = Readonly<Record<string, string | null>> | null;
export interface DraftReviewRow {
  readonly id: string;
  readonly kind: "name" | "prefix" | "offerWhen" | "submit" | "field" | "fieldText" | "order" | "option" | "optionOrder" | "sections" | "documentReading" | "appOnly" | "locationContact";
  readonly parentId?: string;
  readonly optionId?: string;
  readonly culture?: FormCulture;
  readonly property?: "label" | "help";
  readonly mine: string | LocalizedText | DraftQuestion | DraftChoice | readonly string[] | readonly DraftSection[] | FormDocumentReading | LocationContactAssignment | null;
  readonly current: string | LocalizedText | DraftQuestion | DraftChoice | readonly string[] | readonly DraftSection[] | FormDocumentReading | LocationContactAssignment | null;
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
  // SA1-A: «Dónde se completa» is one value, next to the prefix as in the editor, compared and kept as a whole.
  const completedIn = (value: DraftEditorValue) => value.draft.appOnly ? "app" : "channels";
  if (completedIn(mine) !== completedIn(saved)) rows.push({ id: "appOnly", kind: "appOnly", mine: completedIn(mine), current: completedIn(saved), canKeep: true });
  if (mine.offerWhen !== saved.offerWhen) rows.push({ id: "offerWhen", kind: "offerWhen", mine: mine.offerWhen, current: saved.offerWhen, canKeep: true });
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
    if ((local.type !== "choice" && local.type !== "multiChoice") || local.source || (current.type !== "choice" && current.type !== "multiChoice") || current.source) continue;
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
  // The section titles (CW15-B) have no identity: they are compared, and kept, as a whole.
  const sectionList = (value: DraftEditorValue) => (value.draft.sections ?? []).map(({ start, title }) => ({ start, title }));
  if (!equal(sectionList(mine), sectionList(saved))) rows.push({ id: "sections", kind: "sections", mine: mine.draft.sections ?? [], current: saved.draft.sections ?? [], canKeep: true });
  // DOC1: the reading of documents is one setting: compared, and kept, as a whole too.
  const reading = (value: DraftEditorValue) => { const own = value.draft.documentReading; return own ? { enabled: own.enabled, recognition: own.recognition,
    lookups: own.lookups.map(({ questionId, sourceQuestionId, field }) => ({ questionId, sourceQuestionId, field })) } : null; };
  if (!equal(reading(mine), reading(saved))) rows.push({ id: "documentReading", kind: "documentReading", mine: mine.draft.documentReading ?? null, current: saved.draft.documentReading ?? null, canKeep: true });
  // W3 (UC1-A): «Ubicación y contacto» too: which question receives each shared datum, compared and kept as a whole.
  const receivers = { mine: locationContactAssignment(mine.draft.fields), current: locationContactAssignment(saved.draft.fields) };
  if (!equal(receivers.mine, receivers.current)) rows.push({ id: "locationContact", kind: "locationContact", ...receivers, canKeep: true });
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
    if (row.kind === "offerWhen") result = { ...result, offerWhen: selected as string | null };
    if (row.kind === "submit") result.draft = { ...result.draft, submitLabel: withText(result.draft.submitLabel, row.culture!, selected as string | null) };
    if (row.kind === "field") {
      const id = row.parentId!; const old = fields.get(id);
      if (!selected) fields.delete(id);
      else {
        const q = selected as DraftQuestion;
        const common = old ? { ...q, label: old.label, help: old.help } : q;
        fields.set(id, (common.type === "choice" || common.type === "multiChoice") && !common.source && (old?.type === "choice" || old?.type === "multiChoice") && !old.source ? { ...common, options: old.options } : common);
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
    const parent = fields.get(row.parentId!); if ((parent?.type !== "choice" && parent?.type !== "multiChoice") || parent.source) continue;
    const options = new Map(parent.options.map(o => [choiceIdentity(o), o]));
    const selected = choices[row.id] === "mine" ? row.mine : row.current;
    if (row.culture) {
      const option = options.get(row.optionId!);
      if (option) options.set(row.optionId!, { ...option, label: withText(option.label, row.culture, selected as string | null) });
    } else if (selected) options.set(row.optionId!, selected as DraftChoice); else options.delete(row.optionId!);
    fields.set(row.parentId!, { ...parent, options: [...options.values()] });
  }
  for (const [id, parent] of fields) {
    if ((parent.type !== "choice" && parent.type !== "multiChoice") || parent.source) continue;
    const orderRow = review.rows.find(row => row.kind === "optionOrder" && row.parentId === id);
    const source = orderRow && choices[orderRow.id] === "mine" ? review.mine : review.current;
    const original = source.draft.fields.find(q => fieldIdentity(q) === id);
    const options = new Map(parent.options.map(o => [choiceIdentity(o), o]));
    const order = (original?.type === "choice" || original?.type === "multiChoice") && !original.source ? original.options.map(choiceIdentity) : [];
    fields.set(id, { ...parent, options: [...new Set([...order, ...options.keys()])].flatMap(o => options.has(o) ? [options.get(o)!] : []) });
  }
  const order = choices.order === "mine" ? review.mine : review.current;
  const keys = [...new Set([...order.draft.fields.map(fieldIdentity), ...fields.keys()])];
  result.draft = { ...result.draft, fields: keys.flatMap(id => fields.has(id) ? [fields.get(id)!] : []) };
  // The chosen titles stay within the questions that remain.
  const titles = (choices.sections === "mine" ? review.mine : review.current).draft.sections ?? [];
  result.draft = { ...result.draft, sections: titles.length ? titles.map(section => ({ ...section, start: Math.min(section.start, result.draft.fields.length) })) : undefined };
  // DOC1: the reading chosen as a whole; mine without one takes the saved one away. A lookup that names a question no longer kept
  // goes when the editor takes the result (`withoutDanglingLookups`).
  if (choices.documentReading === "mine") {
    const { documentReading: _current, ...draft } = result.draft;
    result.draft = review.mine.draft.documentReading ? { ...result.draft, documentReading: review.mine.draft.documentReading } : draft;
  }
  // SA1-A: «Dónde se completa» as chosen; «En la app y por WhatsApp» has no key.
  if (choices.appOnly === "mine") {
    const { appOnly: _current, ...draft } = result.draft;
    result.draft = review.mine.draft.appOnly ? { ...draft, appOnly: true } : draft;
  }
  // W3: each question kept receives what it received in the version chosen for the zone, whichever was chosen for the question; one
  // that no longer fits (gone into the block, or the location beside a question «Ubicación») goes when the editor takes the result.
  if (choices.locationContact) result.draft = { ...result.draft, fields: withLocationContactAssignment(result.draft.fields, (choices.locationContact === "mine" ? review.mine : review.current).draft.fields) };
  return result;
}
