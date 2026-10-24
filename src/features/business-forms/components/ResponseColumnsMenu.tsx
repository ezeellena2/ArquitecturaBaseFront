import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { responseCatalogColumnId, responseColumnDescriptors, type ResponseCatalogFieldSelection, type ResponseColumn } from "../responses";
export function ResponseColumnsMenu({
  columns,
  visible,
  visibleCatalogFields = [],
  onChange,
}: {
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  visibleCatalogFields?: readonly ResponseCatalogFieldSelection[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const selected = new Set([...visible.map(column => column.fieldId), ...visibleCatalogFields.map(field => responseCatalogColumnId(field.questionId, field.fieldId))]);
  // Questions and catalog subcolumns; the fixed columns are always shown.
  const hidden = responseColumnDescriptors(columns).filter(column => !selected.has(column.id)).length;
  const toggle = (id: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) next.add(id); else next.delete(id);
    onChange(responseColumnDescriptors(columns).filter(column => next.has(column.id)).map(column => column.id));
  };
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
