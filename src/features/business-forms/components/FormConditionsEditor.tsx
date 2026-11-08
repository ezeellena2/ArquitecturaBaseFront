import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { InfoTip } from "@/shared/ui/InfoTip";
import { TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { MultiSelect } from "@/shared/ui/MultiSelect";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { responseQuestionColumns, type ResponseColumn, type ResponseCondition } from "../responses";

const presenceOperators = ["answered", "unanswered", "notAsked"];
/** The operators that take a value, by the type of the question. */
function valueOperators(field: ResponseColumn | undefined) {
  return field?.type === "decimal" || field?.type === "date" ? ["equals", "gte", "lte"] : field?.type === "shortText" || field?.type === "longText" ? ["contains", "equals"]
    : field?.type === "multiChoice" && field.options.length ? ["anyOf"] : field?.type === "boolean" || field?.type === "choice" && field.options.length ? ["in"] : [];
}
/** What an operator starts with: nothing for presence and choices, «Sí» for a yes or no and an empty text otherwise. */
const firstValues = (operator: string, field: ResponseColumn | undefined) =>
  presenceOperators.includes(operator) || field?.type === "choice" || field?.type === "multiChoice" ? [] : [field?.type === "boolean" ? "true" : ""];
const someItemClass = "whitespace-nowrap text-sm text-[var(--color-content-muted)] sm:mt-6 sm:flex sm:h-[var(--height-control)] sm:items-center";

// `help` says what the conditions do for their owner (a rule or a suggestion): in the (i) next to the heading, never as a
// note above «Agregar condición».
export function FormConditionsEditor({ conditions, columns, blocked, error, onChange, heading, help, fieldPath, missingQuestionLabel }: {
  conditions: readonly ResponseCondition[];
  columns: readonly ResponseColumn[];
  blocked: boolean;
  error?: string;
  onChange: (conditions: readonly ResponseCondition[]) => void;
  heading?: string;
  help?: string;
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
  const questions = responseQuestionColumns(columns);
  // A question of a block of rows (RG5-A) is chosen after the block's name and is met by any item, so it only takes the
  // operators with a value, as in «Filtros»; the block itself is never chosen.
  const inBlock = new Set(columns.flatMap(column => column.questions?.map(question => question.fieldId) ?? []));
  const selectable = columns.flatMap(column => column.type === "group" ? column.questions ?? [] : [column]);
  const operatorsOf = (field: ResponseColumn | undefined) => {
    const withValue = valueOperators(field);
    return field && inBlock.has(field.fieldId) && withValue.length ? withValue : [...presenceOperators, ...withValue];
  };
  const start = (field: ResponseColumn): ResponseCondition => {
    const operator = inBlock.has(field.fieldId) ? operatorsOf(field)[0] : "answered";
    return { fieldId: field.fieldId, operator, values: firstValues(operator, field) };
  };
  // With a condition of the block, every row keeps the place of «Algún ítem con» so the controls stay aligned.
  const anyInBlock = conditions.some(condition => inBlock.has(condition.fieldId));
  return <div ref={host} className="space-y-3">
    {heading ? <div className="flex items-center gap-1"><h3 className="text-sm font-medium">{heading}</h3>{help ? <span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: heading })} text={help} /></span> : null}</div> : null}
    {conditions.map((condition, index) => {
      const field = questions.find(column => column.fieldId === condition.fieldId);
      const presence = presenceOperators.includes(condition.operator);
      const update = (next: ResponseCondition) => onChange(conditions.map((row, position) => position === index ? next : row));
      return <div key={index} className={"grid items-start gap-2 " + (anyInBlock ? "sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]")}>
        {inBlock.has(condition.fieldId) ? <span className={someItemClass}>{t("rules.someItem")}</span>
          : anyInBlock ? <span aria-hidden="true" className={"invisible hidden " + someItemClass}>{t("rules.someItem")}</span> : null}
        <FormField label={t("rules.question")} error={fieldPath && index === 0 ? error : undefined}>
          <NativeSelect data-suggestion-field={index === 0 ? fieldPath : undefined} data-condition-position={index} disabled={blocked} value={condition.fieldId} onChange={event => {
            const next = questions.find(column => column.fieldId === event.target.value);
            update(next ? start(next) : { fieldId: event.target.value, operator: "answered", values: [] });
          }}>
            {condition.fieldId && !field && missingQuestionLabel ? <option value={condition.fieldId}>{missingQuestionLabel}</option> : null}
            {columns.flatMap(column => column.type === "group"
              ? (column.questions ?? []).map(question => <option key={question.fieldId} value={question.fieldId}>{t("rules.blockQuestion", { block: column.label, question: question.label })}</option>)
              : [<option key={column.fieldId} value={column.fieldId}>{column.label}</option>])}
          </NativeSelect>
        </FormField>
        <FormField label={t("rules.operator")}>
          <NativeSelect disabled={blocked} value={condition.operator} onChange={event => update({ ...condition, operator: event.target.value, values: firstValues(event.target.value, field) })}>
            {operatorsOf(field).map(operator => <option key={operator} value={operator}>{t("rules.operators." + operator)}</option>)}
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
    <DisabledReason reason={blocked ? null : !selectable.length ? t("rules.noQuestions") : conditions.length >= 10 ? t("rules.errors.tooMany") : null}><Button data-suggestion-field={!conditions.length ? fieldPath : undefined} aria-invalid={!!fieldPath && !!error && !conditions.length} aria-describedby={fieldPath && error && !conditions.length ? errorId : undefined} data-add-condition variant="outline" disabled={blocked || !selectable.length || conditions.length >= 10} onClick={() => onChange([...conditions, start(selectable[0])])}>{t("rules.addCondition")}</Button></DisabledReason>
  </div>;
}
