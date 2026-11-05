import { localizedValue, questionEditorType, type DraftReview, type DraftReviewRow } from "./editorModel";
import type { DraftChoice, DraftEditorValue, DraftQuestion, DraftSection, FormCatalogMatch, FormCulture, LocalizedText } from "./model";

// A cell of the draft review (board LR2-A, 2026-11-03): a text as written, a translation, a text in grey when the version
// lacks it, a numbered list, or a catalog datum that the screen reads when it shows it.
export type ReviewValue =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "missing"; readonly key: string }
  | { readonly kind: "none" }
  | { readonly kind: "list"; readonly items: readonly { readonly value: ReviewValue; readonly moved: boolean }[] }
  | { readonly kind: "catalog"; readonly catalogId: string }
  | { readonly kind: "condition"; readonly catalogId: string; readonly condition: FormCatalogMatch<string | null> }
  | { readonly kind: "presentation"; readonly catalogId: string; readonly parts: readonly string[] };
export type ReviewLabel =
  | { readonly kind: "key"; readonly key: string }
  | { readonly kind: "field"; readonly catalogId: string; readonly fieldId: string }
  | { readonly kind: "culture"; readonly culture: string };
export interface ReviewLine { readonly key: string; readonly label?: ReviewLabel; readonly before: ReviewValue | null; readonly after: ReviewValue | null }

interface Fact { readonly key: string; readonly label: ReviewLabel; readonly value: ReviewValue }
const key = (value: string): { kind: "key"; key: string } => ({ kind: "key", key: value });
const text = (value: string): ReviewValue => ({ kind: "text", text: value });
const count = (value: number | null) => value === null ? { kind: "none" } as const : text(String(value));
const identity = (question: DraftQuestion) => question.fieldId ?? `new:${question.localId}`;
const choiceIdentity = (choice: DraftChoice) => choice.choiceId ?? `new:${choice.localId}`;
const order = ["type", "required", "repeated", "help", "catalog", "filter:", "filters", "presentation", "presentation.title", "presentation.description", "options", "multiple",
  "selection.minimum", "selection.maximum", "files.minimum", "files.maximum", "files.source", "maxLength", "rows.minimum", "rows.maximum"];
const rank = (fact: string) => order.findIndex(item => item.endsWith(":") ? fact.startsWith(item) : fact === item);

// The data of a question with the names of its editor. `whole` adds what only a question that one version lacks needs:
// its help and «Sin filtros de opciones». Without reading catalogs, the catalog data stay out, as they did before.
function questionFacts(question: DraftQuestion, culture: FormCulture, original: FormCulture, options: { whole: boolean; catalogs: boolean; listsOptions: boolean }): Fact[] {
  // The block is compared by its rows (its required follows the minimum), and a question of the block says so.
  const facts: Fact[] = [{ key: "type", label: key("type"), value: key(`types.${questionEditorType(question)}`) },
    ...question.type === "group" ? [] : [{ key: "required", label: key("required"), value: key(question.required ? "yes" : "no") }]];
  if ("repeated" in question && question.repeated) facts.push({ key: "repeated", label: key("rows.repeated"), value: key("yes") });
  const help = options.whole ? localizedValue(question.help, culture, original) : "";
  if (help) facts.push({ key: "help", label: key("help"), value: text(help) });
  if (question.type === "choice" || question.type === "multiChoice") {
    const source = question.source;
    if (source?.catalog && options.catalogs) {
      const catalogId = source.catalog;
      facts.push({ key: "catalog", label: key("catalogQuestion.catalog"), value: { kind: "catalog", catalogId } });
      for (const condition of source.match ?? []) facts.push({ key: `filter:${condition.fieldId}`, label: { kind: "field", catalogId, fieldId: condition.fieldId }, value: { kind: "condition", catalogId, condition } });
      if (options.whole && !source.match?.length) facts.push({ key: "filters", label: key("catalogQuestion.filter.title"), value: key("catalogQuestion.review.noFilters") });
      facts.push({ key: "presentation", label: key("catalogs.presentation.title"), value: key(source.presentation ? "catalogQuestion.presentation.own" : "catalogQuestion.presentation.inherit") });
      if (source.presentation) {
        facts.push({ key: "presentation.title", label: key("catalogQuestion.review.heading"), value: { kind: "presentation", catalogId, parts: source.presentation.title } });
        facts.push({ key: "presentation.description", label: key("catalogQuestion.review.description"), value: { kind: "presentation", catalogId, parts: source.presentation.description } });
      }
    }
    if (!source && options.listsOptions) facts.push({ key: "options", label: key("catalogs.items.title"), value: { kind: "list", items: question.options.map(option => ({ value: text(localizedValue(option.label, culture, original)), moved: false })) } });
    facts.push({ key: "multiple", label: key("multiple.allow"), value: key(question.type === "multiChoice" ? "yes" : "no") });
    if (question.type === "multiChoice") facts.push({ key: "selection.minimum", label: key("multiple.minimum"), value: count(question.selection.minSelected) },
      { key: "selection.maximum", label: key("multiple.maximum"), value: count(question.selection.maxSelected) });
  }
  if (question.type === "photo" || question.type === "document") {
    facts.push({ key: "files.minimum", label: key("files.minimum"), value: count(question.files.minFiles) }, { key: "files.maximum", label: key("files.maximum"), value: count(question.files.maxFiles) });
    if (question.type === "photo") facts.push({ key: "files.source", label: key("files.photoSource"), value: key(`files.sources.${question.files.photoSource ?? "cameraOrGallery"}`) });
  }
  if ("maxLength" in question) facts.push({ key: "maxLength", label: key("maxLength"), value: text(String(question.maxLength ?? (question.type === "shortText" ? 80 : 600))) });
  if (question.type === "group") facts.push({ key: "rows.minimum", label: key("rows.minimum"), value: count(question.rows.minRows) },
    { key: "rows.maximum", label: key("rows.maximum"), value: count(question.rows.maxRows) });
  return facts;
}

// What a version lacks says so once, on its first line: the other lines of that side stay empty.
function oneSided(facts: readonly Fact[], absent: ReviewValue, side: "before" | "after"): ReviewLine[] {
  return facts.map((fact, index) => {
    const missing = index === 0 ? absent : null;
    return { key: fact.key, label: fact.label, before: side === "before" ? missing : fact.value, after: side === "after" ? missing : fact.value };
  });
}

function compared(before: readonly Fact[], after: readonly Fact[], all = false): ReviewLine[] {
  const keys = [...new Set([...before, ...after].map(fact => fact.key))].sort((a, b) => rank(a) - rank(b));
  return keys.flatMap(factKey => {
    const mine = after.find(fact => fact.key === factKey), theirs = before.find(fact => fact.key === factKey);
    if (!all && JSON.stringify(mine?.value) === JSON.stringify(theirs?.value)) return [];
    return [{ key: factKey, label: (theirs ?? mine)!.label, before: theirs?.value ?? { kind: "none" }, after: mine?.value ?? { kind: "none" } }];
  });
}

function texts(map: LocalizedText | Readonly<Record<string, string | null>>): ReadonlyMap<string, string> {
  return new Map(Object.entries(map).filter((entry): entry is [string, string] => !!entry[1]));
}

/** The lines of one change of the draft review, with only what differs when both versions have it. */
export function draftReviewLines(review: DraftReview, row: DraftReviewRow, { culture, catalogs }: { culture: FormCulture; catalogs: boolean }): readonly ReviewLine[] {
  const empty: ReviewValue = { kind: "missing", key: row.kind === "offerWhen" ? "offerWhenEmpty" : row.culture ? "translationPending" : "removed" };
  const sides: Record<"current" | "mine", DraftEditorValue> = { current: review.current, mine: review.mine };
  const single = (side: "current" | "mine"): ReviewValue => {
    const item = row[side];
    if (item === null) return empty;
    if (typeof item === "string") return item ? text(item) : { kind: "missing", key: "translationPending" };
    return { kind: "none" };
  };
  const { current, mine } = row;
  // The section titles in order, each marked when its text or its place differs from the other version's (CW15-B).
  if (row.kind === "sections") {
    const titles = (side: "current" | "mine"): ReviewValue => {
      const own = row[side] as readonly DraftSection[], other = row[side === "mine" ? "current" : "mine"] as readonly DraftSection[];
      return own.length ? { kind: "list", items: own.map((section, index) => ({ value: text(localizedValue(section.title, culture, sides[side].draft.culture)),
        moved: other[index]?.start !== section.start || JSON.stringify(other[index]?.title) !== JSON.stringify(section.title) })) } : { kind: "none" };
    };
    return [{ key: "value", before: titles("current"), after: titles("mine") }];
  }
  if (Array.isArray(current) || Array.isArray(mine)) {
    const list = (side: "current" | "mine"): ReviewValue => {
      const ids = row[side] as readonly string[], other = row[side === "mine" ? "current" : "mine"] as readonly string[];
      const source = sides[side], question = source.draft.fields.find(field => identity(field) === row.parentId);
      return { kind: "list", items: ids.map((id, index) => {
        const label = row.kind === "optionOrder" && (question?.type === "choice" || question?.type === "multiChoice") && !question.source
          ? question.options.find(option => choiceIdentity(option) === id)?.label : source.draft.fields.find(field => identity(field) === id)?.label;
        return { value: label ? text(localizedValue(label, culture, source.draft.culture)) : { kind: "missing", key: "removed" }, moved: other[index] !== id };
      }) };
    };
    return [{ key: "value", before: list("current"), after: list("mine") }];
  }
  if (row.kind === "field") {
    const theirs = current as DraftQuestion | null, ours = mine as DraftQuestion | null;
    const listsOptions = !review.rows.some(item => item.parentId === row.parentId && item.kind === "option");
    const facts = (question: DraftQuestion, side: "current" | "mine", whole: boolean) => questionFacts(question, culture, sides[side].draft.culture, { whole, catalogs, listsOptions });
    if (!theirs || !ours) return theirs ? oneSided(facts(theirs, "current", true), empty, "after") : ours ? oneSided(facts(ours, "mine", true), empty, "before") : [];
    const lines = compared(facts(theirs, "current", false), facts(ours, "mine", false));
    return lines.length ? lines : compared(facts(theirs, "current", false), facts(ours, "mine", false), true);
  }
  const theirs = current !== null && typeof current === "object" ? "label" in current && typeof current.label === "object" ? (current as DraftChoice).label : current as LocalizedText : null;
  const ours = mine !== null && typeof mine === "object" ? "label" in mine && typeof mine.label === "object" ? (mine as DraftChoice).label : mine as LocalizedText : null;
  if (theirs || ours) {
    const before = texts(theirs ?? {}), after = texts(ours ?? {});
    const languages = [...new Set([...before.keys(), ...after.keys()])];
    const value = (map: ReadonlyMap<string, string>, present: boolean, language: string, index: number): ReviewValue | null =>
      !present ? index === 0 ? empty : null : map.has(language) ? text(map.get(language)!) : { kind: "none" };
    if (languages.length < 2) return [{ key: "value", before: value(before, !!theirs, languages[0] ?? "", 0), after: value(after, !!ours, languages[0] ?? "", 0) }];
    return languages.map((language, index) => ({ key: language, label: { kind: "culture", culture: language }, before: value(before, !!theirs, language, index), after: value(after, !!ours, language, index) }));
  }
  return [{ key: "value", before: single("current"), after: single("mine") }];
}
