import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useResponseFacet } from "../hooks/useResponseQueries";
import type { ResponseQuery } from "../responses";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Button } from "@/shared/ui/button";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
export function ResponseFacetControl({
  formId,
  filter,
  dimension,
  fieldId,
  selected,
  onChange,
}: {
  formId: string;
  filter: ResponseQuery;
  dimension: string;
  fieldId?: string;
  selected: readonly string[];
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useResponseFacet(
    formId,
    filter,
    dimension,
    fieldId,
    page,
    search,
  );
  if (query.error instanceof ApiError && query.error.status === 403)
    return <ForbiddenPage />;
  return (
    <div className="flex flex-col gap-3">
      <SearchInput
        maxLength={100}
        label={t("responses.searchOptions")}
        value={search}
        onChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
      />
      {query.isPending ? (
        <Spinner />
      ) : query.isError && !query.data ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void query.refetch();
          }}
        >
          {t("common:actions.retry")}
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          {query.data?.items.map((option) => (
            <CheckboxField
              key={option.id}
              label={
                dimension === "presence"
                  ? t(`responses.${option.id}`)
                  : option.id === "true"
                    ? t("responses.yes")
                    : option.id === "false"
                      ? t("responses.no")
                      : dimension === "version"
                        ? t("responses.versionLabel", { version: option.label })
                        : option.label
              }
              description={t("responses.count", { count: option.count })}
              checked={selected.includes(option.id)}
              disabled={option.count === 0 && !selected.includes(option.id)}
              onCheckedChange={(checked) =>
                onChange(
                  checked
                    ? [...selected, option.id]
                    : selected.filter((id) => id !== option.id),
                )
              }
            />
          ))}
        </div>
      )}
      {query.data?.items.length === 0 ? (
        <p className="text-sm">{t("responses.noOptions")}</p>
      ) : null}
      {query.data && query.data.totalPages > 1 ? (
        <Pagination {...query.data} onPageChange={setPage} />
      ) : null}
    </div>
  );
}

export function ResponsePresenceControl({
  formId,
  filter,
  fieldId,
  value,
  onChange,
}: {
  formId: string;
  filter: ResponseQuery;
  fieldId: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("forms");
  const query = useResponseFacet(formId, filter, "presence", fieldId, 1, "");
  return (
    <NativeSelect
      aria-label={t("responses.answerState")}
      value={value}
      disabled={query.isPending}
      onChange={(event) => onChange(event.target.value)}
    >
      {["all", "answered", "unanswered", "notAsked"].map((id) => {
        const count = query.data?.items.find((item) => item.id === id)?.count;
        return (
          <option key={id} value={id} disabled={count === 0 && value !== id}>
            {t(`responses.${id}`)}
            {count === undefined ? "" : ` (${count})`}
          </option>
        );
      })}
    </NativeSelect>
  );
}
