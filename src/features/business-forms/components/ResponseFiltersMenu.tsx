import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { calendarDateInZone } from "@/shared/lib/dateTime";
import { FilterPanel, type FilterPanelSection } from "@/shared/ui/FilterPanel";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { normalizeResponseQuery, receivedDateBoundary, replaceResponseCondition, type ResponseColumn, type ResponseFilter, type ResponseQuery } from "../responses";
import { useResponseFeedback, useResponseScope } from "../hooks/useResponseQueries";
import { ResponseFacetControl, ResponsePresenceControl } from "./ResponseFacetControl";

const presence = ["answered", "unanswered", "notAsked"];
const decimal = /^[-+]?\d+([.,]\d+)?$/;
const canonicalDecimal = (value: string) => value.trim().replace(",", ".");

/**
 * What is typed in a filter applies a moment after the last key and only when it is valid, so the sheet does not read again
 * with every letter. A change from outside (a chip, «Quitar», «Limpiar todo») replaces what is written.
 */
function TypedFilter({ label, value, type = "text", number = false, maxLength, onCommit }: {
  label: string; value: string; type?: "text" | "date"; number?: boolean; maxLength?: number; onCommit: (value: string) => void;
}) {
  const { t } = useTranslation("forms");
  const same = (left: string, right: string) => number ? canonicalDecimal(left) === canonicalDecimal(right) : left === right;
  const [text, setText] = useState(value);
  const [applied, setApplied] = useState(value);
  if (!same(value, applied)) { setApplied(value); setText(value); }
  const wrong = number && text.trim() !== "" && !decimal.test(text.trim());
  const commit = useRef(onCommit);
  useEffect(() => { commit.current = onCommit; });
  const pending = !wrong && !same(text, applied);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => { setApplied(text); commit.current(text); }, 400);
    return () => window.clearTimeout(timer);
  }, [pending, text]);
  return <FormField label={label} error={wrong ? t("responses.invalidNumber") : undefined}>
    <Input type={type} inputMode={number ? "decimal" : undefined} maxLength={maxLength} value={text} onChange={event => setText(event.target.value)}/>
  </FormField>;
}

/** «Recibida» from and to: both dates apply together, and an inverted range waits with its message. */
function ReceivedRange({ query, zone, onApply }: { query: ResponseQuery; zone: string; onApply: (fromUtc: string | undefined, toUtc: string | undefined) => void }) {
  const { t } = useTranslation("forms");
  const from = query.receivedFromUtc ? calendarDateInZone(query.receivedFromUtc, zone) : "";
  const to = query.receivedToUtc ? calendarDateInZone(new Date(Date.parse(query.receivedToUtc) - 1).toISOString(), zone) : "";
  const [range, setRange] = useState({ from, to, applied: from + "|" + to });
  if (range.applied !== from + "|" + to) setRange({ from, to, applied: from + "|" + to });
  const inverted = !!range.from && !!range.to && range.from > range.to;
  const change = (nextFrom: string, nextTo: string) => {
    setRange(previous => ({ ...previous, from: nextFrom, to: nextTo }));
    if (!nextFrom || !nextTo || nextFrom <= nextTo) onApply(receivedDateBoundary(nextFrom, zone), receivedDateBoundary(nextTo, zone, true));
  };
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <FormField label={t("responses.receivedFrom")} error={inverted ? t("responses.invalidRange") : undefined}><Input type="date" value={range.from} onChange={event => change(event.target.value, range.to)}/></FormField>
    <FormField label={t("responses.receivedTo")}><Input type="date" value={range.to} onChange={event => change(range.from, event.target.value)}/></FormField>
  </div>;
}

/**
 * «Filtros» of the sheet (board PL1-A): Recibida, each question in the form's order, Cargó and Versión, each with what is
 * chosen in it and the counts of the server, which leave an option with zero off. Each change applies at once, as in
 * «Columnas»: there is no draft, «Ver N respuestas» nor Cancelar, and the sheet shows it reads again.
 */
export function ResponseFiltersMenu({ formId, query, columns, zone, disabled, onApply }: {
  formId: string; query: ResponseQuery; columns: readonly ResponseColumn[]; zone: string; disabled?: boolean;
  onApply: (filter: ResponseFilter, versionIds: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const scope = useResponseScope();
  const [facetErrors, setFacetErrors] = useState<Record<string, unknown>>({});
  const onReadError = useCallback((key: string, error: unknown) => setFacetErrors(previous => previous[key] === error ? previous : { ...previous, [key]: error }), []);
  useResponseFeedback(Object.values(facetErrors).find(Boolean) ?? null, `responses:filters:${scope.owner}:${formId}`);
  const facetFilter = normalizeResponseQuery(query, columns) ?? query;
  const conditions = query.conditions ?? [];
  const apply = (next: Partial<ResponseQuery>, versionIds: readonly string[] = query.versionIds ?? []) => {
    const { state, enteredInApp, search, actorIds, receivedFromUtc, receivedToUtc, conditions } = { ...query, ...next };
    onApply({ state, enteredInApp, search, actorIds, receivedFromUtc, receivedToUtc, conditions }, versionIds);
  };
  const question = (column: ResponseColumn) => {
    const own = conditions.filter(item => item.fieldId === column.fieldId);
    const value = (operator: string) => own.find(item => item.operator === operator)?.values?.[0] ?? "";
    const set = (operator: string, values: readonly string[]) => apply({ conditions: replaceResponseCondition(conditions, column.fieldId, operator, values) });
    const listOperator = column.type === "multiChoice" ? "anyOf" : "in";
    return <div className="flex flex-col gap-3">
      {column.type === "choice" || column.type === "multiChoice" || column.type === "boolean"
        ? <ResponseFacetControl formId={formId} filter={facetFilter} onReadError={onReadError} dimension="choice" fieldId={column.fieldId} searchable={column.type !== "boolean"}
          selected={own.find(item => item.operator === listOperator)?.values ?? []} onChange={ids => set(listOperator, ids)}/>
        : column.type === "decimal" || column.type === "date"
          ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">{(["gte", "lte"] as const).map(operator => <TypedFilter key={operator} label={t(operator === "gte" ? "responses.from" : "responses.to")}
            type={column.type === "date" ? "date" : "text"} number={column.type === "decimal"} value={value(operator)}
            onCommit={text => set(operator, text.trim() ? [column.type === "decimal" ? canonicalDecimal(text) : text] : [])}/>)}</div>
          : column.type === "shortText" || column.type === "longText"
            ? <TypedFilter label={t("responses.contains")} maxLength={600} value={value("contains")} onCommit={text => set("contains", text.trim() ? [text] : [])}/>
            : null}
      <FormField label={t("responses.answerState")}>
        <ResponsePresenceControl formId={formId} filter={facetFilter} onReadError={onReadError} fieldId={column.fieldId}
          value={own.find(item => presence.includes(item.operator))?.operator ?? "all"}
          onChange={operator => apply({ conditions: [...conditions.filter(item => item.fieldId !== column.fieldId || !presence.includes(item.operator)),
            ...operator === "all" ? [] : [{ fieldId: column.fieldId, operator, values: null }]] })}/>
      </FormField>
    </div>;
  };
  const sections: FilterPanelSection[] = [
    { key: "received", label: t("responses.received"), applied: !!query.receivedFromUtc || !!query.receivedToUtc,
      onClear: () => apply({ receivedFromUtc: undefined, receivedToUtc: undefined }),
      content: <ReceivedRange query={query} zone={zone} onApply={(receivedFromUtc, receivedToUtc) => apply({ receivedFromUtc, receivedToUtc })}/> },
    ...columns.map(column => ({ key: column.fieldId, label: column.label, applied: conditions.some(item => item.fieldId === column.fieldId),
      onClear: () => apply({ conditions: conditions.filter(item => item.fieldId !== column.fieldId) }), content: question(column) })),
    { key: "actor", label: t("responses.actor"), separated: true, applied: !!query.actorIds?.length, onClear: () => apply({ actorIds: [] }),
      content: <ResponseFacetControl formId={formId} filter={facetFilter} onReadError={onReadError} dimension="actor" selected={query.actorIds ?? []} onChange={ids => apply({ actorIds: ids })}/> },
    { key: "version", label: t("responses.version"), applied: !!query.versionIds?.length, onClear: () => apply({}, []),
      content: <ResponseFacetControl formId={formId} filter={facetFilter} onReadError={onReadError} dimension="version" selected={query.versionIds ?? []} onChange={ids => apply({}, ids)}/> },
  ];
  return <FilterPanel label={t("responses.filters")} sections={sections} disabled={disabled}/>;
}
