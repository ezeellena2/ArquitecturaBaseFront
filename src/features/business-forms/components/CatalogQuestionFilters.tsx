import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { formatCatalogFieldValue, openCatalogField, parseCatalogFieldValue } from "../catalogFields";
import type { CatalogField } from "../api/catalogResponse";
import type { PersonAttribute } from "../api/personData";
import { localizedValue } from "../editorModel";
import type { DraftQuestionSource, FormCatalogMatch } from "../model";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import { CatalogExtraFieldInput } from "./CatalogExtraFieldInput";

function FixedValue({ field, value, scope, readOnly, error, onChange }: { field: CatalogField; value: string | null; scope: CatalogReadScope; readOnly: boolean; error?: string; onChange: (value: string | null) => void }) {
  const { t } = useTranslation("forms");
  const [local, setLocal] = useState<{ value: string | null; input: string | null; valid: boolean } | null>(null);
  const displayed = local?.value === value ? local.input : formatCatalogFieldValue(field, value, scope.culture);
  const draft = { ...openCatalogField(field, scope.culture), required: true };
  const invalid = local?.value === value && !local.valid;
  return <CatalogExtraFieldInput field={draft} culture={scope.culture} scope={scope} value={displayed} readOnly={readOnly} label={t("catalogQuestion.filter.fixedValue")} error={error ?? (invalid ? t("catalogQuestion.filter.invalidValue") : undefined)} onChange={input => {
    const parsed = parseCatalogFieldValue(draft, input, scope.culture);
    const next = parsed.valid ? parsed.value : null;
    setLocal({ value: next, input, valid: parsed.valid });
    onChange(next);
  }} />;
}
export function CatalogQuestionFilters({ source, fields, attributes, scope, readOnly, errors = {}, onChange }: { source: DraftQuestionSource; fields: readonly CatalogField[]; attributes: readonly PersonAttribute[]; scope: CatalogReadScope; readOnly: boolean; errors?: Readonly<Record<string, readonly string[]>>; onChange: (source: DraftQuestionSource) => void }) {
  const { t } = useTranslation("forms");
  const match = source.match ?? [];
  const eligible = fields.filter(field => field.isActive && field.role === "filter");
  const compatible = (field: CatalogField) => attributes.filter(attribute => attribute.isActive && attribute.type === "Catalog" && field.type === "catalog" && field.sourceCatalogId === attribute.sourceCatalogId);
  const available = eligible.filter(field => !match.some(condition => condition.fieldId === field.id));
  const update = (conditions: readonly FormCatalogMatch<string | null>[]) => onChange(normalizeCatalogQuestionSource({ ...source, match: conditions }));
  const change = (index: number, condition: FormCatalogMatch<string | null>) => update(match.map((item, position) => position === index ? condition : item));
  const add = (person: boolean) => { const field = available.find(field => !person || compatible(field).length > 0); if (!readOnly && field) update([...match, person ? { fieldId: field.id, personAttributeId: null } : { fieldId: field.id, value: null }]); };
  return <div className="space-y-3"><p className="text-xs text-[var(--color-content-muted)]">{t("catalogQuestion.filter.hint")}</p>
    {match.map((condition, index) => {
      const field = fields.find(field => field.id === condition.fieldId);
      const person = "personAttributeId" in condition;
      const rowErrors = (path: string) => (errors[`match[${index}].${path}`] ?? errors[`match[${index}]`] ?? errors.match)?.join(" ");
      const fieldName = field ? localizedValue(field.name, scope.culture, "es") : t("catalogQuestion.filter.unavailable");
      const selectedAttribute = person ? attributes.find(attribute => attribute.id === condition.personAttributeId) : undefined;
      return <fieldset key={condition.fieldId} aria-label={t("catalogQuestion.filter.condition", { number: index + 1 })} className="min-w-0 space-y-2 rounded-md border border-[var(--color-border)] p-3"><legend className="px-1 text-xs text-[var(--color-content-muted)]">{t(person ? "catalogQuestion.filter.byPerson" : "catalogQuestion.filter.fixed")}</legend><div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <FormField label={t("catalogQuestion.filter.field")} error={rowErrors("fieldId")}><NativeSelect value={condition.fieldId} disabled={readOnly} onChange={event => { const id = event.target.value; const next = eligible.find(field => field.id === id); if (next) change(index, person && next.type === "catalog" ? { fieldId: id, personAttributeId: null } : { fieldId: id, value: null }); }}><option value={condition.fieldId}>{fieldName}</option>{available.filter(field => !person || compatible(field).length > 0).map(field => <option key={field.id} value={field.id}>{localizedValue(field.name, scope.culture, "es")}</option>)}</NativeSelect></FormField>
        {person ? <FormField label={t("catalogQuestion.filter.personData")} error={rowErrors("personAttributeId")}><NativeSelect value={condition.personAttributeId ?? ""} disabled={readOnly || !field} onChange={event => change(index, { fieldId: condition.fieldId, personAttributeId: event.target.value || null })}><option value="">{t("select")}</option>{field ? compatible(field).map(attribute => <option key={attribute.id} value={attribute.id}>{localizedValue(attribute.name, scope.culture, "es")}</option>) : null}{condition.personAttributeId && (!field || !compatible(field).some(attribute => attribute.id === condition.personAttributeId)) ? <option value={condition.personAttributeId}>{selectedAttribute ? localizedValue(selectedAttribute.name, scope.culture, "es") : t("catalogQuestion.filter.unavailable")}</option> : null}</NativeSelect></FormField> : field ? <FormField label={t("catalogQuestion.filter.fixedValue")}><FixedValue field={field} value={condition.value ?? null} scope={scope} readOnly={readOnly} error={rowErrors("value")} onChange={value => change(index, { fieldId: condition.fieldId, value })}/></FormField> : <p className="text-sm">{t("catalogQuestion.filter.unavailable")}</p>}
        {!readOnly ? <Button type="button" variant="outline" aria-label={t("catalogQuestion.filter.remove", { number: index + 1 })} onClick={() => update(match.filter((_, position) => position !== index))}>×</Button> : null}
      </div></fieldset>;
    })}
    {!readOnly ? <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" disabled={!available.some(field => compatible(field).length > 0)} onClick={() => add(true)}>{t("catalogQuestion.filter.addPerson")}</Button><Button type="button" variant="outline" size="sm" disabled={available.length === 0} onClick={() => add(false)}>{t("catalogQuestion.filter.addFixed")}</Button></div> : null}
    {!eligible.length ? <p className="text-xs text-[var(--color-content-muted)]">{t("catalogQuestion.filter.noFields")}</p> : null}
  </div>;
}
