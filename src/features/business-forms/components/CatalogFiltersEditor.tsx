import { useTranslation } from "react-i18next";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { PlusIcon, TrashIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Picker, type PickerOption } from "@/shared/ui/Picker";
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
  const textColumns = displayColumns.filter(column => column.key === "name");
  const filterColumns = columns.filter(column => column.canFilter !== false && column.operators.length > 0);
  const sortColumns = columns.filter(column => column.canSort !== false);
  // A chosen key that is no longer offered stays first, named as unavailable, so the field still says what it keeps.
  const choices = (items: readonly LabeledChoice[], current: string | null, unavailable: string): PickerOption[] => [
    ...current === null || items.some(item => item.key === current) ? [] : [{ id: current, label: t(unavailable) }],
    ...items.map(item => ({ id: item.key, label: item.label }))];
  const changeCondition = (localId: string, changes: Partial<CatalogFiltersEditorValue["conditions"][number]>) => onChange({ ...value, conditions: value.conditions.map(condition => condition.localId === localId ? { ...condition, ...changes } : condition) });
  return <Surface title={t("catalogs.filters.title")} padded>
    <div className="grid gap-4 sm:grid-cols-3">
      <FormField label={t("catalogs.filters.view")} hint={t("catalogs.filters.columns", { names: displayColumns.map(column => column.label).join(", ") })}>
        <Picker label={t("catalogs.filters.view")} disabled value={view.key} options={[{ id: view.key, label: view.label }]} onChange={() => undefined} />
      </FormField>
      <FormField label={t("catalogs.filters.textColumn")} error={errors["filters.textColumn"]?.join(" ")}><Picker label={t("catalogs.filters.textColumn")} disabled={disabled} value={value.textColumn} onChange={textColumn => onChange({ ...value, textColumn })} options={choices(textColumns, value.textColumn, "catalogs.filters.unavailableColumn")} /></FormField>
      <FormField label={t("catalogs.items.detail")} error={errors["filters.detailColumn"]?.join(" ")}><Picker label={t("catalogs.items.detail")} disabled={disabled} value={value.detailColumn ?? ""} first={{ id: "", label: t("catalogs.filters.noDetail") }} onChange={detailColumn => onChange({ ...value, detailColumn: detailColumn || null })} options={choices(displayColumns, value.detailColumn, "catalogs.filters.unavailableColumn")} /></FormField>
    </div>
    <div className="flex flex-col gap-3"><p className="text-sm font-medium">{t("catalogs.filters.conditions")}</p>
      {value.conditions.map((condition, index) => {
        const column = filterColumns.find(candidate => candidate.key === condition.column);
        return <div key={condition.localId} className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
          <FormField label={t(index === 0 ? "catalogs.filters.if" : "catalogs.filters.and")}><Picker label={t("catalogs.filters.conditionColumn", { number: index + 1 })} disabled={disabled} value={condition.column} onChange={key => {
            const next = filterColumns.find(candidate => candidate.key === key);
            if (next?.operators[0]) changeCondition(condition.localId, { column: next.key, operator: next.operators[0].key, value: next.choices?.[0]?.key ?? "" });
          }} options={choices(filterColumns, condition.column, "catalogs.filters.unavailableColumn")} /></FormField>
          <FormField label={t("catalogs.filters.comparison")}><Picker label={t("catalogs.filters.conditionComparison", { number: index + 1 })} disabled={disabled || !column} value={condition.operator} onChange={operator => changeCondition(condition.localId, { operator })} options={choices(column?.operators ?? [], condition.operator, "catalogs.filters.unavailableOperator")} /></FormField>
          <FormField label={t("catalogs.filters.value")} error={errors[`filters.conditions[${index}]`]?.join(" ")}>{column?.choices ? <Picker label={t("catalogs.filters.conditionValue", { number: index + 1 })} disabled={disabled} value={condition.value} onChange={choice => changeCondition(condition.localId, { value: choice })} options={choices(column.choices, condition.value, "catalogs.filters.unavailableValue")} />
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
      <CheckboxField label={t("catalogs.filters.excludeRecipient")} disabled={disabled} checked={value.excludeRecipient} onCheckedChange={excludeRecipient => onChange({ ...value, excludeRecipient })} />
      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label={t("catalogs.filters.order")} error={errors["filters.sortColumn"]?.join(" ")}><Picker label={t("catalogs.filters.order")} disabled={disabled} value={value.sortColumn} onChange={sortColumn => onChange({ ...value, sortColumn })} options={choices(sortColumns, value.sortColumn, "catalogs.filters.unavailableColumn")} /></FormField>
        {/* «A → Z» and «Z → A» in the shared piece to choose, like the column (2026-11-22). */}
        <FormField label={t("catalogs.filters.direction")}><Picker label={t("catalogs.filters.direction")} disabled={disabled} value={value.sortDescending ? "desc" : "asc"}
          onChange={direction => onChange({ ...value, sortDescending: direction === "desc" })}
          options={[{ id: "asc", label: t("catalogs.filters.ascending") }, { id: "desc", label: t("catalogs.filters.descending") }]} /></FormField>
      </div>
    </div>
  </Surface>;
}
