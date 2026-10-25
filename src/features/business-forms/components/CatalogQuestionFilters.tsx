import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { formatCatalogFieldValue, openCatalogField, parseCatalogFieldValue } from "../catalogFields";
import type { CatalogField } from "../api/catalogResponse";
import type { PersonAttribute } from "../api/personData";
import { administrativeName } from "../editorModel";
import type { DraftQuestionSource, FormCatalogMatch } from "../model";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogItemsById } from "../hooks/useCatalogQueries";
import { normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

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
// The filter fields a question can use and the person data that can match each one, shared by the conditions and the
// additions in the section header.
function filterChoices(source: DraftQuestionSource, fields: readonly CatalogField[], attributes: readonly PersonAttribute[]) {
  const match = source.match ?? [];
  const eligible = fields.filter(field => field.isActive && field.role === "filter");
  const compatible = (field: CatalogField) => attributes.filter(attribute => attribute.isActive && attribute.type === "Catalog" && field.type === "catalog" && field.sourceCatalogId === attribute.sourceCatalogId);
  const available = eligible.filter(field => !match.some(condition => condition.fieldId === field.id));
  return { match, eligible, compatible, available };
}
// Both additions act on the whole section, so they go in its header. Each one gives the reason it is off as its tooltip: no
// filter fields, every filter field already in use or, for a filter by who receives it, no person data on their catalogs.
export function CatalogQuestionFilterActions({ source, fields, attributes, onChange }: { source: DraftQuestionSource; fields: readonly CatalogField[]; attributes: readonly PersonAttribute[]; onChange: (source: DraftQuestionSource) => void }) {
  const { t } = useTranslation("forms");
  const { match, eligible, compatible, available } = filterChoices(source, fields, attributes);
  const personAvailable = available.some(field => compatible(field).length > 0);
  const fixedReason = !eligible.length ? t("catalogQuestion.filter.noFields") : !available.length ? t("catalogQuestion.filter.allUsed") : null;
  const personReason = fixedReason ?? (personAvailable ? null : t("catalogQuestion.filter.noPersonData"));
  const add = (person: boolean) => { const field = available.find(field => !person || compatible(field).length > 0); if (field) onChange(normalizeCatalogQuestionSource({ ...source, match: [...match, person ? { fieldId: field.id, personAttributeId: null } : { fieldId: field.id, value: null }] })); };
  return <><DisabledReason reason={personReason}><Button type="button" variant="outline" size="sm-wrap" disabled={!personAvailable} onClick={() => add(true)}>{t("catalogQuestion.filter.addPerson")}</Button></DisabledReason><DisabledReason reason={fixedReason}><Button type="button" variant="outline" size="sm-wrap" disabled={available.length === 0} onClick={() => add(false)}>{t("catalogQuestion.filter.addFixed")}</Button></DisabledReason></>;
}
export function CatalogQuestionFilters({ source, fields, attributes, scope, readOnly, errors = {}, onChange }: { source: DraftQuestionSource; fields: readonly CatalogField[]; attributes: readonly PersonAttribute[]; scope: CatalogReadScope; readOnly: boolean; errors?: Readonly<Record<string, readonly string[]>>; onChange: (source: DraftQuestionSource) => void }) {
  const { t } = useTranslation("forms");
  const { match, eligible, compatible, available } = filterChoices(source, fields, attributes);
  const update = (conditions: readonly FormCatalogMatch<string | null>[]) => onChange(normalizeCatalogQuestionSource({ ...source, match: conditions }));
  const change = (index: number, condition: FormCatalogMatch<string | null>) => update(match.map((item, position) => position === index ? condition : item));
  return <div className="space-y-3"><p className="text-xs text-[var(--color-content-muted)]">{t("catalogQuestion.filter.hint")}</p>
    {match.map((condition, index) => {
      const field = fields.find(field => field.id === condition.fieldId);
      const person = "personAttributeId" in condition;
      const rowErrors = (path: string) => (errors[`match[${index}].${path}`] ?? errors[`match[${index}]`] ?? errors.match)?.join(" ");
      const fieldName = field ? administrativeName(field.name, scope.culture) : t("catalogQuestion.filter.unavailable");
      const selectedAttribute = person ? attributes.find(attribute => attribute.id === condition.personAttributeId) : undefined;
      return <fieldset key={condition.fieldId} aria-label={t("catalogQuestion.filter.condition", { number: index + 1 })} className="min-w-0 space-y-2 rounded-md border border-[var(--color-border)] p-3"><legend className="px-1 text-xs text-[var(--color-content-muted)]">{t(person ? "catalogQuestion.filter.byPerson" : "catalogQuestion.filter.fixed")}</legend><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <FormField label={t("catalogQuestion.filter.field")} error={rowErrors("fieldId")}><NativeSelect value={condition.fieldId} disabled={readOnly} onChange={event => { const id = event.target.value; const next = eligible.find(field => field.id === id); if (next) change(index, person && next.type === "catalog" ? { fieldId: id, personAttributeId: null } : { fieldId: id, value: null }); }}><option value={condition.fieldId}>{fieldName}</option>{available.filter(field => !person || compatible(field).length > 0).map(field => <option key={field.id} value={field.id}>{administrativeName(field.name, scope.culture)}</option>)}</NativeSelect></FormField>
        {person ? <FormField label={t("catalogQuestion.filter.personData")} error={rowErrors("personAttributeId")}><NativeSelect value={condition.personAttributeId ?? ""} disabled={readOnly || !field} onChange={event => change(index, { fieldId: condition.fieldId, personAttributeId: event.target.value || null })}><option value="">{t("select")}</option>{field ? compatible(field).map(attribute => <option key={attribute.id} value={attribute.id}>{administrativeName(attribute.name, scope.culture)}</option>) : null}{condition.personAttributeId && (!field || !compatible(field).some(attribute => attribute.id === condition.personAttributeId)) ? <option value={condition.personAttributeId}>{selectedAttribute ? administrativeName(selectedAttribute.name, scope.culture) : t("catalogQuestion.filter.unavailable")}</option> : null}</NativeSelect></FormField> : field ? <FormField label={t("catalogQuestion.filter.fixedValue")}><FixedValue field={field} value={condition.value ?? null} scope={scope} readOnly={readOnly} error={rowErrors("value")} onChange={value => change(index, { fieldId: condition.fieldId, value })}/></FormField> : <p className="text-sm">{t("catalogQuestion.filter.unavailable")}</p>}
        {!readOnly ? <Button type="button" variant="outline" aria-label={t("catalogQuestion.filter.remove", { number: index + 1 })} onClick={() => update(match.filter((_, position) => position !== index))}>×</Button> : null}
      </div></fieldset>;
    })}
  </div>;
}
