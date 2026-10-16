import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import type { ResponseColumn } from "../responses";
export function ResponseColumnsMenu({
  columns,
  visible,
  onChange,
}: {
  columns: readonly ResponseColumn[];
  visible: readonly ResponseColumn[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  return (
    <DropdownMenu>
      <FilterMenuTrigger>{t("responses.columns")}</FilterMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-96 overflow-y-auto">
        <DropdownMenuLabel>{t("responses.fixedColumns")}</DropdownMenuLabel>
        {["number", "received", "actor"].map((key) => (
          <DropdownMenuCheckboxItem key={key} checked disabled>
            {t(`responses.${key}`)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.fieldId}
            checked={visible.some((item) => item.fieldId === column.fieldId)}
            onSelect={(event) => event.preventDefault()}
            onCheckedChange={(checked) =>
              onChange(
                checked
                  ? [...visible.map((item) => item.fieldId), column.fieldId]
                  : visible
                      .filter((item) => item.fieldId !== column.fieldId)
                      .map((item) => item.fieldId),
              )
            }
          >
            {column.label}
            {column.introducedInVersion > 1
              ? " " +
                t("responses.sinceVersion", {
                  version: column.introducedInVersion,
                })
              : ""}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
