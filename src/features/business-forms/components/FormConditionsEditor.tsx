import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import type { ResponseColumn, ResponseCondition } from "../responses";

export function FormConditionsEditor({ conditions, columns, blocked, error, onChange, heading, fieldPath, missingQuestionLabel }: {
  conditions: readonly ResponseCondition[];
  columns: readonly ResponseColumn[];
  blocked: boolean;
  error?: string;
  onChange: (conditions: readonly ResponseCondition[]) => void;
  heading?: string;
  fieldPath?: string;
  missingQuestionLabel?: string;
}) {
  const { t } = useTranslation("forms");
  const errorId = useId();
  const host = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    host.current?.querySelector<HTMLElement>(pendingFocus.current < 0 ? "[data-add-condition]" : '[data-condition-position="' + pendingFocus.current + '"]')?.focus();
    pendingFocus.current = null;
  }, [conditions]);
  return <div ref={host} className="space-y-3">
    {heading ? <h3 className="text-sm font-medium">{heading}</h3> : null}
    {conditions.map((condition, index) => {
      const field = columns.find(column => column.fieldId === condition.fieldId);
      const presence = ["answered", "unanswered", "notAsked"].includes(condition.operator);
      const operators = ["answered", "unanswered", "notAsked", ...(field?.type === "decimal" || field?.type === "date" ? ["equals", "gte", "lte"] : field?.type === "shortText" || field?.type === "longText" ? ["contains", "equals"] : field?.type === "multiChoice" && field.options.length ? ["anyOf"] : field?.type === "boolean" || field?.type === "choice" && field.options.length ? ["in"] : [])];
      const update = (next: ResponseCondition) => onChange(conditions.map((row, position) => position === index ? next : row));
      return <div key={index} className="grid items-start gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <FormField label={t("rules.question")} error={fieldPath && index === 0 ? error : undefined}>
          <NativeSelect data-suggestion-field={index === 0 ? fieldPath : undefined} data-condition-position={index} disabled={blocked} value={condition.fieldId} onChange={event => update({ fieldId: event.target.value, operator: "answered", values: [] })}>
            {condition.fieldId && !field && missingQuestionLabel ? <option value={condition.fieldId}>{missingQuestionLabel}</option> : null}
            {columns.map(column => <option key={column.fieldId} value={column.fieldId}>{column.label}</option>)}
          </NativeSelect>
        </FormField>
        <FormField label={t("rules.operator")}>
          <NativeSelect disabled={blocked} value={condition.operator} onChange={event => update({ ...condition, operator: event.target.value, values: ["answered", "unanswered", "notAsked"].includes(event.target.value) || field?.type === "choice" || field?.type === "multiChoice" ? [] : [field?.type === "boolean" ? "true" : ""] })}>
            {operators.map(operator => <option key={operator} value={operator}>{t("rules.operators." + operator)}</option>)}
          </NativeSelect>
        </FormField>
        {!presence ? <FormField label={t("rules.value")}>
          {field?.type === "boolean" ? <NativeSelect disabled={blocked} value={condition.values?.[0] ?? ""} onChange={event => update({ ...condition, values: [event.target.value] })}><option value="true">{t("responses.yes")}</option><option value="false">{t("responses.no")}</option></NativeSelect>
            : field?.type === "choice" || field?.type === "multiChoice" ? <MultiSelect disabled={blocked} value={condition.values ?? []} options={field.options.map(choice => ({ value: choice.id, label: choice.label }))} placeholder={t("rules.chooseValues")} onChange={values => update({ ...condition, values })}/>
            : <Input disabled={blocked} type={field?.type === "date" ? "date" : "text"} inputMode={field?.type === "decimal" ? "decimal" : undefined} value={condition.values?.[0] ?? ""} onChange={event => update({ ...condition, values: [event.target.value] })}/>}
        </FormField> : <span/>}
        <IconButton className="sm:mt-6" label={t("rules.removeCondition", { number: index + 1 })} disabled={blocked} onClick={() => { pendingFocus.current = Math.min(index, conditions.length - 2); onChange(conditions.filter((_, position) => position !== index)); }}><TrashIcon className="size-4"/></IconButton>
      </div>;
    })}
    {error && (!fieldPath || !conditions.length) ? <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    <p className="text-xs text-[var(--color-content-muted)]">{t("rules.always")}</p>
    <DisabledReason reason={blocked ? null : !columns.length ? t("rules.noQuestions") : conditions.length >= 10 ? t("rules.errors.tooMany") : null}><Button data-suggestion-field={!conditions.length ? fieldPath : undefined} aria-invalid={!!fieldPath && !!error && !conditions.length} aria-describedby={fieldPath && error && !conditions.length ? errorId : undefined} data-add-condition variant="outline" disabled={blocked || !columns.length || conditions.length >= 10} onClick={() => onChange([...conditions, { fieldId: columns[0].fieldId, operator: "answered", values: [] }])}>{t("rules.addCondition")}</Button></DisabledReason>
  </div>;
}
