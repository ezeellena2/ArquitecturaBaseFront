import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/ui/dropdown-menu";
import { FilterMenuTrigger } from "@/shared/ui/FilterMenuTrigger";
import { Spinner } from "@/shared/ui/Spinner";
import { useResponseFacet } from "../hooks/useResponseQueries";
import type { ResponseColumn, ResponseQuery } from "../responses";
export function ResponseChoiceMenu({
  formId,
  filter,
  column,
  onChange,
  onMore,
}: {
  formId: string;
  filter: ResponseQuery;
  column: ResponseColumn;
  onChange: (ids: readonly string[]) => void;
  onMore: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation("forms");
  const operator = column.type === "multiChoice" ? "anyOf" : "in";
  const selected =
    filter.conditions?.find(
      (condition) =>
        condition.fieldId === column.fieldId && condition.operator === operator,
    )?.values ?? [];
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <FilterMenuTrigger>
        {column.label}
        {selected.length ? column.type === "multiChoice" ? `: ${t("responses.anyOfCount", { count: selected.length })}` : ` (${selected.length})` : ""}
      </FilterMenuTrigger>
      <DropdownMenuContent align="start">
        {open ? (
          <Choices
            formId={formId}
            filter={filter}
            fieldId={column.fieldId}
            selected={selected}
            onChange={onChange}
            onMore={() => {
              setOpen(false);
              onMore();
            }}
          />
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onChange([])}>
          {t("responses.all")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function Choices({
  formId,
  filter,
  fieldId,
  selected,
  onChange,
  onMore,
}: {
  formId: string;
  filter: ResponseQuery;
  fieldId: string;
  selected: readonly string[];
  onChange: (ids: readonly string[]) => void;
  onMore: () => void;
}) {
  const { t } = useTranslation("forms");
  const query = useResponseFacet(formId, filter, "choice", fieldId, 1, "");
  return (
    <>
      {query.isPending ? <Spinner /> : null}
      {query.data?.items.map((option) => (
        <DropdownMenuCheckboxItem
          key={option.id}
          checked={selected.includes(option.id)}
          disabled={option.count === 0 && !selected.includes(option.id)}
          onSelect={(event) => event.preventDefault()}
          onCheckedChange={(checked) =>
            onChange(
              checked
                ? [...selected, option.id]
                : selected.filter((id) => id !== option.id),
            )
          }
        >
          <span>{option.label}</span>
          <span className="ml-4 text-xs tabular-nums">{option.count}</span>
        </DropdownMenuCheckboxItem>
      ))}
      {query.data?.hasNext ? (
        <DropdownMenuItem onSelect={onMore}>
          {t("responses.moreOptions")}
        </DropdownMenuItem>
      ) : null}
      {query.isError ? (
        <DropdownMenuItem
          onSelect={() => {
            void query.refetch();
          }}
        >
          {t("common:actions.retry")}
        </DropdownMenuItem>
      ) : null}
    </>
  );
}
