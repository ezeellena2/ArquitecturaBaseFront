import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  deleteUser,
  fetchUsers,
  setUserActive,
  usersQueryKey,
  usersQueryKeyRoot,
  type UserListItem,
} from "../api/users";
import { createUserColumns } from "../columns";
import { UserFormDialog } from "../components/UserFormDialog";
import { UserEditDialog } from "../components/UserEditDialog";
import { userActionErrorMessage } from "../errors";
import { userIdentifier } from "../identity";
import { Can } from "@/auth/Can";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { rolesQueryKey } from "@/shared/api/roles";
import { usePagination } from "@/shared/hooks/usePagination";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable } from "@/shared/ui/DataTable";
import { Page } from "@/shared/ui/Page";
import { UsersIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { userFilterKeys } from "../api/users";
import { UsersFilterBar } from "../components/UsersFilterBar";
import { useFilters } from "@/shared/hooks/useFilters";

/// Las dos acciones que no se hacen de una: antes pasan por el diálogo de confirmación.
interface PendingConfirmation {
  kind: "deactivate" | "delete";
  user: UserListItem;
}

/// `/usuarios` (sección 7.4 del spec maestro y sección 11 del de la Fase 4): listado real contra `/api/users`,
/// con búsqueda, orden y paginado a cargo del backend, más el alta y las acciones por fila, todo en diálogos.
export function UsersPage() {
  const { t, i18n } = useTranslation("users");
  const { data: currentUser } = useCurrentUser();
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const { page, pageSize, sort, search, setPage, setSearch, toggleSort } = usePagination();
  const filters = useFilters(userFilterKeys);

  const [isCreating, setIsCreating] = useState(false);
  const [editingUser, setEditingUser] = useState<UserListItem | undefined>();
  const [confirmation, setConfirmation] = useState<PendingConfirmation | undefined>();

  const canManage = has("users.manage");
  // La búsqueda cuenta como filtro para el vacío: "ninguno coincide" tiene que aparecer igual si lo único
  // puesto es el buscador, y el botón de limpiar también lo tiene que sacar.
  const appliedCount = filters.active.length + (search ? 1 : 0);
  const hasFilters = appliedCount > 0;
  const query = { page, pageSize, sort, search, ...filters.values };

  const { data, error, isLoading, refetch } = useQuery({
    queryKey: usersQueryKey(query),
    queryFn: () => fetchUsers(query),
    placeholderData: keepPreviousData,
  });

  // Las dos acciones de fila que no abren un formulario. El resultado va a un aviso y no a un cartel dentro
  // del diálogo, porque `ConfirmDialog` se cierra al confirmar: cuando llega la respuesta ya no está.
  const activation = useMutation({
    mutationFn: ({ user, isActive }: { user: UserListItem; isActive: boolean }) => setUserActive(user.id, isActive),
    onSuccess: async (_result, variables) => {
      toast.success(variables.isActive ? t("feedback.activated") : t("feedback.deactivated"));
      await queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot });
    },
    onError: (mutationError) => toast.error(userActionErrorMessage(mutationError, t)),
  });

  const removal = useMutation({
    mutationFn: (user: UserListItem) => deleteUser(user.id),
    onSuccess: async () => {
      toast.success(t("feedback.deleted"));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        // Eliminar o restaurar una cuenta cambia el `userCount` de sus roles: sin esto, /roles muestra el
        // conteo viejo durante los 30 s de staleTime.
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
    },
    onError: (mutationError) => toast.error(userActionErrorMessage(mutationError, t)),
  });

  const apiError = error instanceof ApiError ? error : undefined;

  const columns = createUserColumns(
    t,
    i18n.language,
    currentUser?.timeZoneId,
    canManage
      ? {
          onEdit: (user) => setEditingUser(user),
          // Activar no se confirma: no se pierde nada. Desactivar sí, porque le corta el acceso en el acto.
          onToggleActive: (user) =>
            user.isActive
              ? setConfirmation({ kind: "deactivate", user })
              : activation.mutate({ user, isActive: true }),
          onDelete: (user) => setConfirmation({ kind: "delete", user }),
        }
      : undefined,
  );

  // La pantalla pide el permiso para no entrar (experiencia de uso), pero quien decide es el backend: un 403
  // acá lleva a la misma pantalla de "sin permiso" que ProtectedRoute.
  if (apiError?.status === 403) {
    return <ForbiddenPage />;
  }

  const isDeletion = confirmation?.kind === "delete";

  return (
    <Page
      icon={UsersIcon}
      title={t("title")}
      actions={
        <Can permission="users.manage">
          <Button type="button" onClick={() => setIsCreating(true)}>
            {t("actions.new")}
          </Button>
        </Can>
      }
    >
      <UsersFilterBar
        filters={filters}
        search={search ?? ""}
        onSearchChange={setSearch}
        totalLabel={data ? t("shownOfTotal", { count: data.items.length, total: data.totalCount }) : ""}
      />

      {/* Sin padding y con `overflow-hidden`: la banda del encabezado llega a los bordes de la caja y se
          recorta con su radio. Con padding, la tabla flota adentro y la banda deja de ser la cabecera de la
          caja para ser un rectángulo suelto. */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
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
          emptyTitle={hasFilters ? t("empty.filteredTitle") : t("empty.title")}
          emptyDescription={
            hasFilters
              ? t("empty.filteredDescription", { filters: t("filters.applied", { count: appliedCount }) })
              : t("empty.description")
          }
          emptyAction={
            hasFilters ? (
              <Button type="button" variant="outline" onClick={filters.clear}>
                {t("empty.clear")}
              </Button>
            ) : undefined
          }
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

      {isCreating ? <UserFormDialog onClose={() => setIsCreating(false)} /> : null}

      {editingUser ? <UserEditDialog user={editingUser} onClose={() => setEditingUser(undefined)} /> : null}

      {confirmation ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setConfirmation(undefined);
            }
          }}
          title={t(isDeletion ? "delete.title" : "deactivate.title", { user: userIdentifier(confirmation.user) })}
          description={t(isDeletion ? "delete.description" : "deactivate.description")}
          confirmLabel={t(isDeletion ? "delete.confirm" : "deactivate.confirm")}
          destructive
          onConfirm={() => {
            if (isDeletion) {
              removal.mutate(confirmation.user);

              return;
            }

            activation.mutate({ user: confirmation.user, isActive: false });
          }}
        />
      ) : null}
    </Page>
  );
}
