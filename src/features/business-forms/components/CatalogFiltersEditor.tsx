import { useTranslation } from "react-i18next";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Surface } from "@/shared/ui/Surface";

interface LabeledChoice { readonly key: string; readonly label: string }
// UI choices supplied by the authorized view adapter; these types are not serialized to HTTP.
export interface CatalogFilterColumn extends LabeledChoice {
  readonly operators: readonly LabeledChoice[];
  readonly choices?: readonly LabeledChoice[];
  readonly canDisplay?: boolean;
  readonly canFilter?: boolean;
  readonly canSort?: boolean;
}
export interface CatalogFiltersEditorValue {
  readonly textColumn: string;
  readonly detailColumn: string | null;
  readonly conditions: readonly { readonly localId: string; readonly column: string; readonly operator: string; readonly value: string }[];
  readonly excludeRecipient: boolean;
  readonly sortColumn: string;
  readonly sortDescending: boolean;
}

export function CatalogFiltersEditor({ view, columns, value, canManage, busy = false, errors = {}, onChange }: {
  view: LabeledChoice;
  columns: readonly CatalogFilterColumn[];
  value: CatalogFiltersEditorValue;
  canManage: boolean;
  busy?: boolean;
  errors?: Readonly<Record<string, readonly string[]>>;
  onChange: (value: CatalogFiltersEditorValue) => void;
}) {
  const { t } = useTranslation("forms");
  const disabled = !canManage || busy;
  const displayColumns = columns.filter(column => column.canDisplay !== false);
  const filterColumns = columns.filter(column => column.canFilter !== false && column.operators.length > 0);
  const sortColumns = columns.filter(column => column.canSort !== false);
  const changeCondition = (localId: string, changes: Partial<CatalogFiltersEditorValue["conditions"][number]>) => onChange({ ...value, conditions: value.conditions.map(condition => condition.localId === localId ? { ...condition, ...changes } : condition) });
  return <Surface title={t("catalogs.filters.title")} padded>
    <div className="grid gap-4 sm:grid-cols-3">
      <FormField label={t("catalogs.filters.view")} hint={t("catalogs.filters.columns", { names: displayColumns.map(column => column.label).join(", ") })}>
        <NativeSelect value={view.key} disabled><option value={view.key}>{view.label}</option></NativeSelect>
      </FormField>
      <FormField label={t("catalogs.filters.textColumn")} error={errors["filters.textColumn"]?.join(" ")}><NativeSelect disabled={disabled} value={value.textColumn} onChange={event => onChange({ ...value, textColumn: event.target.value })}>{!displayColumns.some(column => column.key === value.textColumn) ? <option value={value.textColumn}>{t("catalogs.filters.unavailableColumn")}</option> : null}{displayColumns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</NativeSelect></FormField>
      <FormField label={t("catalogs.items.detail")} error={errors["filters.detailColumn"]?.join(" ")}><NativeSelect disabled={disabled} value={value.detailColumn ?? ""} onChange={event => onChange({ ...value, detailColumn: event.target.value || null })}><option value="">{t("catalogs.filters.noDetail")}</option>{value.detailColumn !== null && !displayColumns.some(column => column.key === value.detailColumn) ? <option value={value.detailColumn}>{t("catalogs.filters.unavailableColumn")}</option> : null}{displayColumns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</NativeSelect></FormField>
    </div>
    <div className="flex flex-col gap-3"><p className="text-sm font-medium">{t("catalogs.filters.conditions")}</p>
      {value.conditions.map((condition, index) => {
        const column = filterColumns.find(candidate => candidate.key === condition.column);
        return <div key={condition.localId} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <FormField label={t(index === 0 ? "catalogs.filters.if" : "catalogs.filters.and")}><NativeSelect aria-label={t("catalogs.filters.conditionColumn", { number: index + 1 })} disabled={disabled} value={condition.column} onChange={event => {
            const next = filterColumns.find(candidate => candidate.key === event.target.value);
            if (next?.operators[0]) changeCondition(condition.localId, { column: next.key, operator: next.operators[0].key, value: next.choices?.[0]?.key ?? "" });
          }}>{!column ? <option value={condition.column}>{t("catalogs.filters.unavailableColumn")}</option> : null}{filterColumns.map(candidate => <option key={candidate.key} value={candidate.key}>{candidate.label}</option>)}</NativeSelect></FormField>
          <FormField label={t("catalogs.filters.comparison")}><NativeSelect aria-label={t("catalogs.filters.conditionComparison", { number: index + 1 })} disabled={disabled || !column} value={condition.operator} onChange={event => changeCondition(condition.localId, { operator: event.target.value })}>{!column?.operators.some(operator => operator.key === condition.operator) ? <option value={condition.operator}>{t("catalogs.filters.unavailableOperator")}</option> : null}{column?.operators.map(operator => <option key={operator.key} value={operator.key}>{operator.label}</option>)}</NativeSelect></FormField>
          <FormField label={t("catalogs.filters.value")} error={errors[`filters.conditions[${index}]`]?.join(" ")}>{column?.choices ? <NativeSelect aria-label={t("catalogs.filters.conditionValue", { number: index + 1 })} disabled={disabled} value={condition.value} onChange={event => changeCondition(condition.localId, { value: event.target.value })}>{column.choices.map(choice => <option key={choice.key} value={choice.key}>{choice.label}</option>)}</NativeSelect>
            : <Input aria-label={t("catalogs.filters.conditionValue", { number: index + 1 })} readOnly={disabled || !column} value={condition.value} onChange={event => changeCondition(condition.localId, { value: event.target.value })} />}</FormField>
          {canManage ? <IconButton label={t("catalogs.filters.remove", { number: index + 1 })} disabled={busy} onClick={() => onChange({ ...value, conditions: value.conditions.filter(current => current.localId !== condition.localId) })}><TrashIcon className="size-4" /></IconButton> : null}
        </div>;
      })}
      {canManage ? <div><Button type="button" variant="outline" disabled={busy || filterColumns.length === 0} onClick={() => {
        const column = filterColumns[0]; if (!column?.operators[0]) return;
        onChange({ ...value, conditions: [...value.conditions, { localId: crypto.randomUUID(), column: column.key, operator: column.operators[0].key, value: column.choices?.[0]?.key ?? "" }] });
      }}><PlusIcon className="size-4" />{t("catalogs.filters.add")}</Button></div> : null}
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <CheckboxField label={t("catalogs.filters.excludeRecipient")} description={t("catalogs.filters.excludeRecipientHint")} disabled={disabled} checked={value.excludeRecipient} onCheckedChange={excludeRecipient => onChange({ ...value, excludeRecipient })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("catalogs.filters.order")} error={errors["filters.sortColumn"]?.join(" ")}><NativeSelect disabled={disabled} value={value.sortColumn} onChange={event => onChange({ ...value, sortColumn: event.target.value })}>{!sortColumns.some(column => column.key === value.sortColumn) ? <option value={value.sortColumn}>{t("catalogs.filters.unavailableColumn")}</option> : null}{sortColumns.map(column => <option key={column.key} value={column.key}>{column.label}</option>)}</NativeSelect></FormField>
        <FormField label={t("catalogs.filters.direction")}><NativeSelect disabled={disabled} value={value.sortDescending ? "desc" : "asc"} onChange={event => onChange({ ...value, sortDescending: event.target.value === "desc" })}><option value="asc">{t("catalogs.filters.ascending")}</option><option value="desc">{t("catalogs.filters.descending")}</option></NativeSelect></FormField>
      </div>
    </div>
  </Surface>;
}
