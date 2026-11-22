import { useId, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { IconButton } from "@/shared/ui/IconButton";
import { InfoTip } from "@/shared/ui/InfoTip";
import { TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Picker } from "@/shared/ui/Picker";
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
    host.current?.querySelector<HTMLElement>(pendingFocus.current < 0 ? "[data-add-condition]" : '[data-condition-position="' + pendingFocus.current + '"] button[aria-haspopup]')?.focus();
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
        {/* The marks of the first question (its owner's error) and of the position (the focus after removing a row) go around
            the field: the Picker takes only its own props. */}
        <div data-suggestion-field={index === 0 ? fieldPath : undefined} data-condition-position={index}><FormField label={t("rules.question")} error={fieldPath && index === 0 ? error : undefined}>
          <Picker label={t("rules.question")} disabled={blocked} value={condition.fieldId} onChange={fieldId => {
            const next = questions.find(column => column.fieldId === fieldId);
            update(next ? start(next) : { fieldId, operator: "answered", values: [] });
          }} options={[
            ...condition.fieldId && !field && missingQuestionLabel ? [{ id: condition.fieldId, label: missingQuestionLabel }] : [],
            ...columns.flatMap(column => column.type === "group"
              ? (column.questions ?? []).map(question => ({ id: question.fieldId, label: t("rules.blockQuestion", { block: column.label, question: question.label }) }))
              : [{ id: column.fieldId, label: column.label }])]} />
        </FormField></div>
        <FormField label={t("rules.operator")}>
          <Picker label={t("rules.operator")} disabled={blocked} value={condition.operator} onChange={operator => update({ ...condition, operator, values: firstValues(operator, field) })}
            options={operatorsOf(field).map(operator => ({ id: operator, label: t("rules.operators." + operator) }))} />
        </FormField>
        {/* Sí or No, and the options of a question, several, in the only piece to choose (DS1-A, 2026-11-22). */}
        {presence ? <span/>
          : <FormField label={t("rules.value")}>
            {field?.type === "boolean" ? <Picker label={t("rules.value")} disabled={blocked} value={condition.values?.[0] ?? null}
              options={(["true", "false"] as const).map(choice => ({ id: choice, label: t(choice === "true" ? "responses.yes" : "responses.no") }))}
              onChange={choice => { if (choice !== condition.values?.[0]) update({ ...condition, values: [choice] }); }}/>
              : field?.type === "choice" || field?.type === "multiChoice" ? <Picker label={t("rules.value")} multiple disabled={blocked} value={condition.values ?? []} options={field.options.map(choice => ({ id: choice.id, label: choice.label }))} placeholder={t("rules.chooseValues")} onChange={values => update({ ...condition, values })}/>
              : <Input disabled={blocked} type={field?.type === "date" ? "date" : "text"} inputMode={field?.type === "decimal" ? "decimal" : undefined} value={condition.values?.[0] ?? ""} onChange={event => update({ ...condition, values: [event.target.value] })}/>}
          </FormField>}
        <IconButton className="sm:mt-6" label={t("rules.removeCondition", { number: index + 1 })} disabled={blocked} onClick={() => { pendingFocus.current = Math.min(index, conditions.length - 2); onChange(conditions.filter((_, position) => position !== index)); }}><TrashIcon className="size-4"/></IconButton>
      </div>;
    })}
    {error && (!fieldPath || !conditions.length) ? <p id={errorId} role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    <DisabledReason reason={blocked ? null : !selectable.length ? t("rules.noQuestions") : conditions.length >= 10 ? t("rules.errors.tooMany") : null}><Button data-suggestion-field={!conditions.length ? fieldPath : undefined} aria-invalid={!!fieldPath && !!error && !conditions.length} aria-describedby={fieldPath && error && !conditions.length ? errorId : undefined} data-add-condition variant="outline" disabled={blocked || !selectable.length || conditions.length >= 10} onClick={() => onChange([...conditions, start(selectable[0])])}>{t("rules.addCondition")}</Button></DisabledReason>
  </div>;
}
