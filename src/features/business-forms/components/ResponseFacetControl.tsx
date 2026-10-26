import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useElementVisibility } from "@/shared/hooks/useElementVisibility";
import { useResponseFacet } from "../hooks/useResponseQueries";
import type { ResponseQuery } from "../responses";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
export function ResponseFacetControl({
  formId,
  filter,
  dimension,
  fieldId,
  selected,
  searchable = true,
  onReadError,
  onChange,
}: {
  formId: string;
  filter: ResponseQuery | null;
  dimension: string;
  fieldId?: string;
  selected: readonly string[];
  searchable?: boolean;
  onReadError?: (key: string, error: unknown) => void;
  onChange: (ids: readonly string[]) => void;
}) {
  const { t } = useTranslation("forms");
  const { ref: visibilityRef, visible } = useElementVisibility<HTMLDivElement>();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const query = useResponseFacet(
    formId,
    filter,
    dimension,
    fieldId,
    page,
    search,
    visible,
    !onReadError,
  );
  useEffect(() => { onReadError?.(`${dimension}:${fieldId ?? ""}`, query.error); }, [onReadError, dimension, fieldId, query.error]);
  if (query.error instanceof ApiError && query.error.status === 403)
    return <ForbiddenPage />;
  // The wait of a 429 is the reason of the controls it turns off (`DisabledReason`), never a text in the region.
  const wait = query.cooldown.isRunning ? t("wait", { count: query.cooldown.seconds }) : null;
  return (
    <div ref={visibilityRef} className="flex flex-col gap-3">
      {searchable ? (
        <SearchInput
          maxLength={100}
          label={t("responses.searchOptions")}
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
        />
      ) : null}
      {query.isPending && filter ? (
        <Spinner />
      ) : query.isError && !query.data && (query.error instanceof ApiError && (query.error.isNetworkError || query.error.status === 429)) ? (
        <DisabledReason reason={wait}>
          <Button
            type="button"
            variant="outline"
            disabled={query.cooldown.isRunning}
            onClick={() => {
              query.retry();
            }}
          >
            {t("common:actions.retry")}
          </Button>
        </DisabledReason>
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
                        : dimension === "actor" && !option.label
                          ? t("responses.unknownPerson")
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
  onReadError,
}: {
  formId: string;
  filter: ResponseQuery | null;
  fieldId: string;
  value: string;
  onReadError?: (key: string, error: unknown) => void;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation("forms");
  const { ref: visibilityRef, visible } = useElementVisibility<HTMLDivElement>();
  const query = useResponseFacet(formId, filter, "presence", fieldId, 1, "", visible, !onReadError);
  useEffect(() => { onReadError?.(`presence:${fieldId}`, query.error); }, [onReadError, fieldId, query.error]);
  const wait = query.cooldown.isRunning ? t("wait", { count: query.cooldown.seconds }) : null;
  return <div ref={visibilityRef} className="flex flex-col gap-2">
    {query.isError && query.error instanceof ApiError && (query.error.isNetworkError || query.error.status === 429) ? <DisabledReason reason={wait}><Button type="button" variant="outline" disabled={query.cooldown.isRunning} onClick={() => query.retry()}>{t("common:actions.retry")}</Button></DisabledReason> : null}
    <DisabledReason reason={wait} className="grid w-full">
    <NativeSelect
      aria-label={t("responses.answerState")}
      value={value}
      disabled={query.isPending || query.cooldown.isRunning}
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
    </DisabledReason>
  </div>;
}
