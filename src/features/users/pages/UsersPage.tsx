import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { notify } from "@/shared/ui/notifications";
import {
  deleteUser,
  fetchUsers,
  setUserActive,
  userQueryKey,
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
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { rolesQueryKey } from "@/shared/api/roles";
import { usePagination } from "@/shared/hooks/usePagination";
import { useSystemPresentation } from "@/shared/api/presentation";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable } from "@/shared/ui/DataTable";
import { Surface } from "@/shared/ui/Surface";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { userFilterKeys } from "../api/users";
import { UsersFilterBar } from "../components/UsersFilterBar";
import { useFilters } from "@/shared/hooks/useFilters";

/// Sin un orden elegido, el backend lista primero las cuentas más nuevas: es una columna, así que su flecha se ve y el primer
/// toque en «Creado» la invierte (OT1-C).
const usualSort = "-createdAtUtc";

/// Las acciones de acceso y borrado pasan primero por el diálogo de confirmación.
interface PendingConfirmation {
  kind: "activate" | "deactivate" | "delete";
  user: UserListItem;
}

/// `/usuarios` (sección 7.4 del spec maestro y sección 11 del de la Fase 4): listado real contra `/api/users`,
/// con búsqueda, orden y paginado a cargo del backend, más el alta y las acciones por fila, todo en diálogos.
export function UsersPage() {
  const { t, i18n } = useTranslation("users");
  const { data: currentUser } = useCurrentUser();
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const presentation = useSystemPresentation();
  const { page, pageSize, sort, search, ready, setPage, setPageSize, setSearch, toggleSort, setSort } = usePagination(presentation.data?.defaultPageSize, true, usualSort);
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

  // `keepPreviousData`: al buscar, filtrar, ordenar o paginar, las filas anteriores quedan a la vista mientras llegan
  // las nuevas, y la tabla las atenúa (`refreshing`).
  const { data, error, isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey: usersQueryKey(query),
    queryFn: () => fetchUsers(query),
    placeholderData: keepPreviousData,
    enabled: ready,
  });

  // Las dos acciones de fila que no abren un formulario. La confirmación espera abierta la respuesta (`pending`) y el
  // resultado va a un aviso.
  const activation = useMutation({
    mutationFn: ({ user, isActive }: { user: UserListItem; isActive: boolean }) => setUserActive(user.id, isActive),
    onSuccess: async (_result, variables) => {
      notify({ id: `users:active:${variables.user.id}`, kind: "success", message: variables.isActive ? t("feedback.activated") : t("feedback.deactivated") });
      // El detalle también: activar y desactivar avanzan su revisión (N2), y la edición se abre con la que tiene.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(variables.user.id) }),
      ]);
    },
    onError: (mutationError, variables) => notify({ id: `users:active:${variables.user.id}`, kind: "error", message: userActionErrorMessage(mutationError, t) }),
  });

  const removal = useMutation({
    mutationFn: (user: UserListItem) => deleteUser(user.id),
    onSuccess: async (_result, user) => {
      notify({ id: `users:delete:${user.id}`, kind: "success", message: t("feedback.deleted") });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: usersQueryKeyRoot }),
        queryClient.invalidateQueries({ queryKey: userQueryKey(user.id) }),
        // Eliminar o restaurar una cuenta cambia el `userCount` de sus roles: sin esto, /roles muestra el
        // conteo viejo durante los 30 s de staleTime.
        queryClient.invalidateQueries({ queryKey: rolesQueryKey }),
      ]);
    },
    onError: (mutationError, user) => notify({ id: `users:delete:${user.id}`, kind: "error", message: userActionErrorMessage(mutationError, t) }),
  });

  const apiError = error instanceof ApiError ? error : undefined;

  const columns = createUserColumns(
    t,
    i18n.language,
    currentUser?.timeZoneId,
    canManage
      ? {
          onEdit: (user) => setEditingUser(user),
          onToggleActive: (user) => setConfirmation({ kind: user.isActive ? "deactivate" : "activate", user }),
          onDelete: (user) => setConfirmation({ kind: "delete", user }),
        }
      : undefined,
  );

  // La pantalla pide el permiso para no entrar (experiencia de uso), pero quien decide es el backend: un 403
  // acá muestra la misma falta de permiso que ProtectedRoute.
  if (apiError?.status === 403) {
    return <ForbiddenPage title={t("title")} />;
  }

  const isDeletion = confirmation?.kind === "delete";

  return (
    <Page
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
        columns={columns}
        sort={sort ?? usualSort}
        onSortChange={setSort}
      />

      {/* Sin padding y con `overflow-hidden`: la banda del encabezado llega a los bordes de la caja y se
          recorta con su radio. Con padding, la tabla flota adentro y la banda deja de ser la cabecera de la
          caja para ser un rectángulo suelto. */}
      <Surface>
        <DataTable
          columns={columns}
          rows={data?.items ?? []}
          hasData={data !== undefined}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          refreshing={isPlaceholderData}
          error={error ? t("common:states.loadFailed") : undefined}
          onRetry={() => void refetch()}
          sort={sort ?? usualSort}
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
            onPageSizeChange={setPageSize}
          />
        ) : null}
      </Surface>

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
          title={t(`${confirmation.kind}.title`, { user: userIdentifier(confirmation.user) })}
          description={t(`${confirmation.kind}.description`)}
          confirmLabel={t(`${confirmation.kind}.confirm`)}
          destructive={confirmation.kind !== "activate"}
          // Espera abierta la respuesta, también si falla: se cierra cuando llega, con el resultado en un aviso.
          pending={activation.isPending || removal.isPending}
          pendingLabel={{ activate: t("activate.activating"), deactivate: t("deactivate.deactivating"), delete: t("delete.deleting") }[confirmation.kind]}
          onConfirm={() => {
            const close = { onSettled: () => setConfirmation(undefined) };

            if (isDeletion) {
              removal.mutate(confirmation.user, close);

              return;
            }

            activation.mutate({ user: confirmation.user, isActive: confirmation.kind === "activate" }, close);
          }}
        />
      ) : null}
    </Page>
  );
}
