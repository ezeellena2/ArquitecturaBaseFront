import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import type { ResponseResultColumn } from "../api/responses";
import { responseCatalogColumnId, responseColumnDescriptors, responseResultColumnId, type ResponseCatalogFieldSelection, type ResponseColumn } from "../responses";
export function ResponseColumnsMenu({
  columns,
  visible,
  visibleCatalogFields = [],
  resultColumns = [],
  visibleResults = [],
  onChange,
}: {
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  visibleCatalogFields?: readonly ResponseCatalogFieldSelection[];
  /// RE1-A: the data external actions left, after the questions, each action as a group named after it.
  resultColumns?: readonly ResponseResultColumn[];
  visibleResults?: readonly ResponseResultColumn[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const selected = new Set([...visible.map(column => column.fieldId), ...visibleCatalogFields.map(field => responseCatalogColumnId(field.questionId, field.fieldId)),
    ...visibleResults.map(column => responseResultColumnId(column.id))]);
  // Questions, catalog subcolumns and result data; the fixed columns are always shown.
  const all = [...responseColumnDescriptors(columns).map(column => column.id), ...resultColumns.map(column => responseResultColumnId(column.id))];
  const hidden = all.filter(id => !selected.has(id)).length;
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    onChange(all.filter(columnId => next.has(columnId)));
  };
  const sources = [...new Set(resultColumns.map(column => column.source))];
  return (
    <DropdownMenu>
      <FilterMenuTrigger>{t(hidden ? "responses.columnsHidden" : "responses.columns", { count: hidden })}</FilterMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuLabel>{t("responses.fixedColumns")}</DropdownMenuLabel>
        {["number", "received", "actor"].map((key) => (
          <DropdownMenuCheckboxItem key={key} checked disabled>
            {t(`responses.${key}`)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {columns.map(column => <div key={column.fieldId}>
          <DropdownMenuCheckboxItem checked={selected.has(column.fieldId)} onSelect={event => event.preventDefault()} onCheckedChange={checked => toggle(column.fieldId, checked === true)}>{column.label}{column.introducedInVersion > 1 ? " " + t("responses.sinceVersion", { version: column.introducedInVersion }) : ""}</DropdownMenuCheckboxItem>
          {(column.fields ?? []).map(field => { const id = responseCatalogColumnId(column.fieldId, field.fieldId); return <DropdownMenuCheckboxItem key={id} className="ml-4 whitespace-normal" checked={selected.has(id)} onSelect={event => event.preventDefault()} onCheckedChange={checked => toggle(id, checked === true)}>{field.label} · {t("catalogs.fields.roles." + field.role).toLowerCase()}</DropdownMenuCheckboxItem>; })}
        </div>)}
        {sources.map(source => <div key={source}>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{resultColumns.find(column => column.source === source)?.sourceName}</DropdownMenuLabel>
          {resultColumns.filter(column => column.source === source).map(column => { const id = responseResultColumnId(column.id); return <DropdownMenuCheckboxItem key={id} checked={selected.has(id)} onSelect={event => event.preventDefault()} onCheckedChange={checked => toggle(id, checked === true)}>{column.label}</DropdownMenuCheckboxItem>; })}
        </div>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
