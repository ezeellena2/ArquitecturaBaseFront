import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchUsers, usersQueryKey } from "../api/users";
import { createUserColumns } from "../columns";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { usePagination } from "@/shared/hooks/usePagination";
import { DataTable } from "@/shared/ui/DataTable";
import { PageHeader } from "@/shared/ui/PageHeader";
import { Pagination } from "@/shared/ui/Pagination";
import { SearchInput } from "@/shared/ui/SearchInput";

/// El texto de "orden actual" junto al buscador (maqueta aprobada): el nombre de columna sale de las mismas
/// columnas que arma la tabla, para no duplicar traducciones por campo.
function sortDescription(
  t: (key: string, options?: Record<string, unknown>) => string,
  sort: string | undefined,
  columns: ReturnType<typeof createUserColumns>,
): string {
  if (!sort) {
    return t("sort.none");
  }

  const descending = sort.startsWith("-");
  const field = descending ? sort.slice(1) : sort;
  const fieldLabel = columns.find((column) => column.id === field)?.header ?? field;

  return t(descending ? "sort.descending" : "sort.ascending", { field: fieldLabel });
}

/// `/usuarios` (sección 7.4): listado real contra `/api/users`, con búsqueda, orden y paginado a cargo del
/// backend. `usePagination` guarda página, orden y búsqueda en la URL.
export function UsersPage() {
  const { t, i18n } = useTranslation("users");
  const { data: currentUser } = useCurrentUser();
  const { page, pageSize, sort, search, setPage, setSearch, toggleSort } = usePagination();

  const query = { page, pageSize, sort, search };
  const columns = createUserColumns(t, i18n.language, currentUser?.timeZoneId);

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: usersQueryKey(query),
    queryFn: () => fetchUsers(query),
    placeholderData: keepPreviousData,
  });

  const apiError = error instanceof ApiError ? error : undefined;

  // La pantalla pide el permiso para no entrar (experiencia de uso), pero quien decide es el backend: un 403
  // acá lleva a la misma pantalla de "sin permiso" que ProtectedRoute.
  if (apiError?.status === 403) {
    return <ForbiddenPage />;
  }

  return (
    <div>
      <PageHeader title={t("title")} description={t("description")} />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <SearchInput value={search ?? ""} onChange={setSearch} label={t("searchLabel")} />
        </div>
        <p className="text-sm text-[var(--color-content-muted)]">{sortDescription(t, sort, columns)}</p>
      </div>

      <div className="rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          error={apiError ? (apiError.isNetworkError ? t("common:errors.network") : (apiError.detail ?? apiError.message)) : undefined}
          errorDescription={apiError?.traceId ? t("errorTraceId", { traceId: apiError.traceId }) : undefined}
          onRetry={() => void refetch()}
          sort={sort}
          onSortChange={toggleSort}
          emptyTitle={t("empty.title")}
          emptyDescription={search ? t("empty.searchDescription") : t("empty.description")}
        />

        {data ? (
          <Pagination
            page={data.page}
            pageSize={data.pageSize}
            totalCount={data.totalCount}
            totalPages={data.totalPages}
            hasPrevious={data.hasPrevious}
            hasNext={data.hasNext}
            onPageChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}
