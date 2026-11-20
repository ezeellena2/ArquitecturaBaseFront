import { Fragment, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { Picker } from "@/shared/ui/Picker";
import { formatCatalogFieldValue, openCatalogField, parseCatalogFieldValue } from "../catalogFields";
import { catalogScalarText } from "../catalogValues";
import type { CatalogField } from "../api/catalogResponse";
import type { PersonAttribute } from "../api/personData";
import { administrativeName } from "../editorModel";
import type { DraftQuestionSource, FormCatalogMatch } from "../model";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogItemsById, useCatalogNames } from "../hooks/useCatalogQueries";
import { matchKind, normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import type { AnswerChoice } from "../dependentLists";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";
import { FixedCatalogValue } from "./CatalogSourceValues";

function FixedValue({ field, value, scope, readOnly, error, onChange }: { field: CatalogField; value: string | null; scope: CatalogReadScope; readOnly: boolean; error?: string; onChange: (value: string | null) => void }) {
  const { t } = useTranslation("forms");
  const [local, setLocal] = useState<{ value: string | null; input: string | null; valid: boolean; texts?: Readonly<Record<string, string>> } | null>(null);
  const mine = local?.value === value ? local : null;
  const displayed = mine ? mine.input : formatCatalogFieldValue(field, value, scope.culture);
  // The label of a catalog value is read by id: its option may be beyond the first page of the search, or inactive.
  const byId = field.type === "catalog" && value !== null && !mine?.texts ? value : null;
  const option = useCatalogItemsById(scope, byId ? field.sourceCatalogId ?? "" : "", byId ? [byId] : []).data?.items.find(item => item.id === value);
  const draft = { ...openCatalogField(field, scope.culture), required: true };
  const invalid = mine !== null && !mine.valid;
  return <CatalogExtraFieldInput field={draft} culture={scope.culture} scope={scope} value={displayed} texts={mine?.texts ?? option?.text} readOnly={readOnly} label={t("catalogQuestion.filter.fixedValue")} error={error ?? (invalid ? t("catalogQuestion.filter.invalidValue") : undefined)} onChange={(input, texts) => {
    const parsed = parseCatalogFieldValue(draft, input, scope.culture);
    const next = parsed.valid ? parsed.value : null;
    setLocal({ value: next, input, valid: parsed.valid, texts });
    onChange(next);
  }} />;
}
/**
 * The questions of the form whose answer a list can depend on, for the source catalog of a filter field, and the label of the
 * question being edited (CW7). Without it (outside a form) there is no filter by another answer.
 */
export interface AnswerQuestions {
  readonly choices: (sourceCatalogId: string | null) => readonly AnswerChoice[];
  readonly current: string;
}
// The filter fields a question can use, the person data that can match each one and, by another answer, those of catalog type
// with an earlier question that can give it; shared by the conditions and the additions in the section header.
function filterChoices(source: DraftQuestionSource, fields: readonly CatalogField[], attributes: readonly PersonAttribute[], answers?: AnswerQuestions) {
  const match = source.match ?? [];
  const eligible = fields.filter(field => field.isActive && field.role === "filter");
  const compatible = (field: CatalogField) => attributes.filter(attribute => attribute.isActive && attribute.type === "Catalog" && field.type === "catalog" && field.sourceCatalogId === attribute.sourceCatalogId);
  const available = eligible.filter(field => !match.some(condition => condition.fieldId === field.id));
  const answerable = (field: CatalogField) => !!answers && field.type === "catalog" && !!field.sourceCatalogId && answers.choices(field.sourceCatalogId).some(choice => !choice.reason);
  return { match, eligible, compatible, available, answerable };
}

// «Respuesta de» (CW7): the other catalog questions of the form, «Campo (pregunta 1)», with the only piece to choose (DS1-A): what
// they choose from in grey under the name, and those that cannot give the answer off with why (MA1-A); only those that can are
// chosen. With more than ten, the list brings its search. A question that is no longer there stays first, named as unavailable.
function AnswerQuestion({ scope, label, choices, current, value, readOnly, onChange, ...field }: { scope: CatalogReadScope; label: string; choices: readonly AnswerChoice[]; current: string; value: string | null; readOnly: boolean; onChange: (questionId: string) => void;
  id?: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) {
  const { t } = useTranslation("forms");
  const names = useCatalogNames(scope, choices.map(choice => choice.catalog));
  const name = (choice: AnswerChoice) => t("catalogQuestion.filter.answerQuestion", { label: choice.label, number: choice.number });
  const catalog = (choice: AnswerChoice) => names[choice.catalog] ? administrativeName(names[choice.catalog], scope.culture) : null;
  // In a question of the block (LD3-A) the catalog says where the answer comes from: its own item, or the one for all the items.
  const sameCatalog = (choice: AnswerChoice) => choice.items === "same" ? "catalogQuestion.filter.answerCatalogSameItem"
    : choice.items === "all" ? "catalogQuestion.filter.answerCatalogAllItems" : "catalogQuestion.filter.answerCatalog";
  const reason = (choice: AnswerChoice) => choice.reason === "later" ? t("catalogQuestion.filter.answerLater", { question: current })
    : choice.reason === "multiple" ? t("catalogQuestion.filter.answerMultiple")
    : choice.reason === "inBlock" ? t("catalogQuestion.filter.answerInBlock")
    : choice.reason === "otherCatalog" ? t("catalogQuestion.filter.answerOtherCatalog", { catalog: catalog(choice) ?? "…" }) : null;
  const description = (choice: AnswerChoice) => !choice.reason && catalog(choice) ? t(sameCatalog(choice), { catalog: catalog(choice) }) : null;
  const kept = value !== null && !choices.some(choice => choice.id === value) ? [{ id: value, label: t("catalogQuestion.filter.questionUnavailable") }] : [];
  return <Picker {...field} label={label} disabled={readOnly} value={value} placeholder={t("select")} onChange={onChange}
    options={[...kept, ...choices.map(choice => ({ id: choice.id, label: name(choice), description: description(choice), disabledReason: reason(choice) }))]}/>;
}
// Both additions act on the whole section, so they go in its header. Each one gives the reason it is off as its tooltip: no
// filter fields, every filter field already in use or, for a filter by who receives it, no person data on their catalogs.
// While the person data load that last reason is not known yet, so it is not given.
export function CatalogQuestionFilterActions({ source, fields, attributes, attributesLoading = false, answers, onChange }: { source: DraftQuestionSource; fields: readonly CatalogField[]; attributes: readonly PersonAttribute[]; attributesLoading?: boolean; answers?: AnswerQuestions; onChange: (source: DraftQuestionSource) => void }) {
  const { t } = useTranslation("forms");
  const { match, eligible, compatible, available, answerable } = filterChoices(source, fields, attributes, answers);
  const personAvailable = available.some(field => compatible(field).length > 0);
  const answerAvailable = available.some(answerable);
  const fixedReason = !eligible.length ? t("catalogQuestion.filter.noFields") : !available.length ? t("catalogQuestion.filter.allUsed") : null;
  const personReason = fixedReason ?? (personAvailable || attributesLoading ? null : t("catalogQuestion.filter.noPersonData"));
  // CW7: by another answer, a catalog field with an earlier single choice of its catalog; the question is chosen afterwards.
  const answerReason = fixedReason ?? (answerAvailable ? null : t("catalogQuestion.filter.noAnswerQuestion"));
  const add = (kind: "person" | "fixed" | "answer") => {
    const field = available.find(field => kind === "person" ? compatible(field).length > 0 : kind === "answer" ? answerable(field) : true);
    if (field) onChange(normalizeCatalogQuestionSource({ ...source, match: [...match, kind === "person" ? { fieldId: field.id, personAttributeId: null }
      : kind === "answer" ? { fieldId: field.id, questionId: null } : { fieldId: field.id, value: null }] }));
  };
  return <><DisabledReason reason={personReason}><Button type="button" variant="outline" size="sm-wrap" disabled={!personAvailable} onClick={() => add("person")}>{t("catalogQuestion.filter.addPerson")}</Button></DisabledReason><DisabledReason reason={fixedReason}><Button type="button" variant="outline" size="sm-wrap" disabled={available.length === 0} onClick={() => add("fixed")}>{t("catalogQuestion.filter.addFixed")}</Button></DisabledReason>
    {answers ? <DisabledReason reason={answerReason}><Button type="button" variant="outline" size="sm-wrap" disabled={!answerAvailable} onClick={() => add("answer")}>{t("catalogQuestion.filter.addAnswer")}</Button></DisabledReason> : null}</>;
}
// Folded, the section says its filters in one line (ZP1-A): a fixed one with its value, in the format of its type or by the
// label of its option (never its GUID), and one by who receives it with those words; an incomplete one says it has no value.
export function CatalogQuestionFilterSummary({ source, fields, scope, answers }: { source: DraftQuestionSource; fields: readonly CatalogField[]; scope: CatalogReadScope; answers?: AnswerQuestions }) {
  const { t } = useTranslation("forms");
  const match = source.match ?? [];
  if (!match.length) return t("catalogQuestion.zones.noFilters");
  return match.map((condition, index) => {
    const field = fields.find(field => field.id === condition.fieldId);
    const name = field ? administrativeName(field.name, scope.culture) : t("catalogQuestion.filter.unavailable");
    let value: ReactNode = null;
    // By another answer, the question it waits for: «Campo según la respuesta de «Campo»» (CW7).
    if (matchKind(condition) === "answer") {
      const question = answers?.choices(null).find(choice => choice.id === condition.questionId)?.label;
      return <Fragment key={condition.fieldId}>{index ? " · " : null}{question ? t("catalogQuestion.zones.byAnswer", { field: name, question }) : <>{name}: {t("catalogQuestion.zones.noValue")}</>}</Fragment>;
    }
    if (!("personAttributeId" in condition)) value = !condition.value ? t("catalogQuestion.zones.noValue") : field?.type === "catalog" ? <FixedCatalogValue scope={scope} field={field} value={condition.value}/>
      : field && field.type !== "text" ? catalogScalarText(field.type, condition.value, scope.culture, { yes: t("yes"), no: t("no") }) : condition.value;
    return <Fragment key={condition.fieldId}>{index ? " · " : null}{value === null ? t("catalogQuestion.zones.byPerson", { field: name }) : <>{name}: {value}</>}</Fragment>;
  });
}
export function CatalogQuestionFilters({ source, fields, attributes, attributesLoading = false, scope, readOnly, errors = {}, answers, onChange }: { source: DraftQuestionSource; fields: readonly CatalogField[]; attributes: readonly PersonAttribute[]; attributesLoading?: boolean; scope: CatalogReadScope; readOnly: boolean; errors?: Readonly<Record<string, readonly string[]>>; answers?: AnswerQuestions; onChange: (source: DraftQuestionSource) => void }) {
  const { t } = useTranslation("forms");
  const { match, eligible, compatible, available } = filterChoices(source, fields, attributes, answers);
  const update = (conditions: readonly FormCatalogMatch<string | null>[]) => onChange(normalizeCatalogQuestionSource({ ...source, match: conditions }));
  const change = (index: number, condition: FormCatalogMatch<string | null>) => update(match.map((item, position) => position === index ? condition : item));
  return <div className="space-y-3">
    {match.map((condition, index) => {
      const field = fields.find(field => field.id === condition.fieldId);
      const kind = matchKind(condition), person = kind === "person";
      const rowErrors = (path: string) => (errors[`match[${index}].${path}`] ?? errors[`match[${index}]`] ?? errors.match)?.join(" ");
      const fieldName = field ? administrativeName(field.name, scope.culture) : t("catalogQuestion.filter.unavailable");
      const selectedAttribute = person ? attributes.find(attribute => attribute.id === condition.personAttributeId) : undefined;
      // By another answer the condition keeps its kind: another catalog field, and its question is chosen again (CW7).
      const fits = (next: CatalogField) => person ? compatible(next).length > 0 : kind === "answer" ? next.type === "catalog" && !!next.sourceCatalogId : true;
      const changeField = (next: CatalogField): FormCatalogMatch<string | null> => person && next.type === "catalog" ? { fieldId: next.id, personAttributeId: null }
        : kind === "answer" ? { fieldId: next.id, questionId: null } : { fieldId: next.id, value: null };
      return <fieldset key={condition.fieldId} aria-label={t("catalogQuestion.filter.condition", { number: index + 1 })} className="min-w-0 space-y-2 rounded-md border border-[var(--color-border)] p-3"><legend className="px-1 text-xs text-[var(--color-content-muted)]">{t(person ? "catalogQuestion.filter.byPerson" : kind === "answer" ? "catalogQuestion.filter.byAnswer" : "catalogQuestion.filter.fixed")}</legend><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <FormField label={t("catalogQuestion.filter.field")} error={rowErrors("fieldId")}><Picker label={t("catalogQuestion.filter.field")} value={condition.fieldId} disabled={readOnly}
          options={[{ id: condition.fieldId, label: fieldName }, ...available.filter(fits).map(field => ({ id: field.id, label: administrativeName(field.name, scope.culture) }))]}
          onChange={id => { const next = eligible.find(field => field.id === id); if (next && id !== condition.fieldId) change(index, changeField(next)); }}/></FormField>
        {kind === "answer" ? <FormField label={t("catalogQuestion.filter.answerOf")} error={rowErrors("questionId")}><AnswerQuestion scope={scope} label={t("catalogQuestion.filter.answerOf")} choices={answers?.choices(field?.sourceCatalogId ?? null) ?? []} current={answers?.current ?? ""} value={condition.questionId ?? null} readOnly={readOnly} onChange={questionId => change(index, { fieldId: condition.fieldId, questionId })}/></FormField>
        : person ? <FormField label={t("catalogQuestion.filter.personData")} error={rowErrors("personAttributeId")}><Picker label={t("catalogQuestion.filter.personData")} value={condition.personAttributeId ?? null} disabled={readOnly || !field} placeholder={t("select")}
          options={[...condition.personAttributeId && (!field || !compatible(field).some(attribute => attribute.id === condition.personAttributeId)) ? [{ id: condition.personAttributeId, label: selectedAttribute ? administrativeName(selectedAttribute.name, scope.culture) : attributesLoading ? "…" : t("catalogQuestion.filter.unavailable") }] : [],
            ...field ? compatible(field).map(attribute => ({ id: attribute.id, label: administrativeName(attribute.name, scope.culture) })) : []]}
          onChange={personAttributeId => change(index, { fieldId: condition.fieldId, personAttributeId })}/></FormField> : field ? <FormField label={t("catalogQuestion.filter.fixedValue")}><FixedValue field={field} value={condition.value ?? null} scope={scope} readOnly={readOnly} error={rowErrors("value")} onChange={value => change(index, { fieldId: condition.fieldId, value })}/></FormField> : <p className="text-sm">{t("catalogQuestion.filter.unavailable")}</p>}
        {!readOnly ? <Button type="button" variant="outline" aria-label={t("catalogQuestion.filter.remove", { number: index + 1 })} onClick={() => update(match.filter((_, position) => position !== index))}>×</Button> : null}
      </div></fieldset>;
    })}
  </div>;
}
