import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useResponseFeedback, useResponseNavigation } from "../hooks/useResponseQueries";
import { usePagination } from "@/shared/hooks/usePagination";
import { useSystemPresentation } from "@/shared/api/presentation";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { FilterBar } from "@/shared/ui/FilterBar";
import { SearchInput } from "@/shared/ui/SearchInput";
import { DataTable } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
export function ResponseFormsPage() {
  const { t } = useTranslation("forms");
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const { query, scope } = useResponseNavigation(
    pagination.page,
    pagination.pageSize,
    pagination.search,
  );
  useResponseFeedback(query.error, `responses:forms-page:${scope.owner}`, query.refetch);
  if (
    !scope.allowed ||
    (query.error instanceof ApiError && query.error.status === 403)
  )
    return <ForbiddenPage />;
  return (
    <Page title={t("responses.title")}>
      <FilterBar>
        <SearchInput
          maxLength={100}
          label={t("responses.searchForms")}
          value={pagination.search ?? ""}
          onChange={pagination.setSearch}
        />
      </FilterBar>
      <Surface>
        <DataTable
          columns={[
            {
              id: "name",
              header: t("formColumn"),
              cell: (row) => (
                <Link
                  to={`/formularios/${row.id}/respuestas`}
                  className="font-medium text-[var(--color-brand-700)] underline"
                >
                  {row.name}
                </Link>
              ),
            },
            {
              id: "versionNumber",
              header: t("responses.version"),
              cell: (row) => row.versionNumber,
            },
          ]}
          rows={query.data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={query.isPending}
          hasData={!!query.data}
          error={query.error ? t("loadFailed") : undefined}
          onRetry={() => {
            void query.refetch();
          }}
          emptyTitle={t(pagination.search ? "noMatches" : "responses.noForms")}
          emptyDescription={t("responses.noFormsHint")}
        />
        {query.data ? (
          <Pagination
            {...query.data}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        ) : null}
      </Surface>
    </Page>
  );
}
