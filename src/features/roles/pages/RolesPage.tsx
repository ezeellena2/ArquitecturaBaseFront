import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { notify } from "@/shared/ui/notifications";
import { fetchPagedRoles, deleteRole } from "../api/roles";
import { roleActionErrorMessage } from "../errors";
import { isAdminRole } from "../lib/systemRoles";
import { Can } from "@/auth/Can";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { FilterBar } from "@/shared/ui/FilterBar";
import { EyeIcon, PencilIcon,  TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { SortMenu } from "@/shared/ui/SortMenu";
import { Surface } from "@/shared/ui/Surface";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { usePagination } from "@/shared/hooks/usePagination";
import { useSystemPresentation } from "@/shared/api/presentation";
import { formatNumber } from "@/shared/lib/numberFormat";

/// Sin un orden elegido, el backend ordena por nombre: es una columna, así que su flecha se ve y el primer toque la invierte
/// (OT1-C).
const usualSort = "name";

/// `/roles` usa el endpoint paginado; los selectores conservan el catálogo completo.
///
/// El alta y la edición no se hacen acá: "Nuevo rol" y "Editar" llevan a la pantalla del rol (`/roles/nuevo` y
/// `/roles/{id}`, `RoleEditorPage`). Eliminar sí sigue siendo una confirmación sobre el listado.
export function RolesPage() {
  const { t, i18n } = useTranslation("roles");
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const presentation = useSystemPresentation();
  const { page, pageSize, sort, ready, setPage, setPageSize, toggleSort, setSort } = usePagination(presentation.data?.defaultPageSize, true, usualSort);

  const [deletingRole, setDeletingRole] = useState<RoleListItem | undefined>();

  const canManage = has("roles.manage");

  // `keepPreviousData`: al ordenar o paginar, las filas anteriores quedan a la vista, atenuadas, mientras llegan las nuevas.
  const { data, error, isLoading, isPlaceholderData, refetch } = useQuery({
    queryKey: [...rolesQueryKey, "paged", page, pageSize, sort],
    queryFn: () => fetchPagedRoles(page, pageSize, sort),
    placeholderData: keepPreviousData,
    enabled: ready,
  });

  const removal = useMutation({
    mutationFn: (role: RoleListItem) => deleteRole(role.id),
    onSuccess: async (_result, role) => {
      notify({ id: `roles:delete:${role.id}`, kind: "success", message: t("feedback.deleted") });
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey });
    },
    // La confirmación espera abierta la respuesta y se cierra con ella, también si falla: el porqué va a un aviso.
    onError: (mutationError, role) => notify({ id: `roles:delete:${role.id}`, kind: "error", message: roleActionErrorMessage(mutationError, t) }),
  });

  const apiError = error instanceof ApiError ? error : undefined;

  // Toda columna con un dato ordena en el servidor (OT1-C), con su `id` como campo; «Permisos» ordena por la cantidad.
  const columns: Column<RoleListItem>[] = [
    { id: "name", header: t("columns.name"), cell: (row) => row.name, sortable: true, sortKind: "text" },
    { id: "description", header: t("columns.description"), cell: (row) => row.description ?? "—", sortable: true, sortKind: "text" },
    { id: "userCount", header: t("columns.userCount"), numeric: true, cell: (row) => formatNumber(row.userCount, i18n.language), sortable: true, sortKind: "number" },
    {
      id: "permissions",
      header: t("columns.permissions"),
      cell: (row) => t("permissionsCount", { count: row.permissions.length }),
      sortable: true,
      sortKind: "number",
    },
  ];

  if (canManage) {
    // Los roles del sistema también se abren (tablero "Roles · Acciones del listado"): Admin, para mirarlo,
    // porque su pantalla es de solo lectura; User, para editarlo, porque la descripción y los permisos sí se
    // cambian. Ninguno de los dos se elimina: la acción ni se dibuja, como una sin permiso.
    columns.push({
      sortable: false,
      id: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (row) => (
        <RowActions
          actions={[
            isAdminRole(row)
              ? {
                  label: t("actions.view"),
                  accessibleName: t("actions.viewFor", { name: row.name }),
                  icon: EyeIcon,
                  onSelect: () => void navigate(`/roles/${row.id}`),
                }
              : {
                  label: t("actions.edit"),
                  accessibleName: t("actions.editFor", { name: row.name }),
                  icon: PencilIcon,
                  onSelect: () => void navigate(`/roles/${row.id}`),
                },
            {
              label: t("actions.delete"),
              accessibleName: t("actions.deleteFor", { name: row.name }),
              icon: TrashIcon,
              onSelect: () => setDeletingRole(row),
              destructive: true,
              hidden: row.isSystemRole,
            },
          ]}
        />
      ),
    });
  }

  if (apiError?.status === 403) {
    return <ForbiddenPage />;
  }

  return (
    <Page
      title={t("title")}
      actions={
        <Can permission="roles.manage">
          <Button asChild>
            <Link to="/roles/nuevo">{t("actions.new")}</Link>
          </Button>
        </Can>
      }
    >
      {/* Sin filtros: la barra lleva sólo «Ordenar por» (OT1-C). */}
      <FilterBar>
        <SortMenu columns={columns} sort={sort ?? usualSort} onSortChange={setSort} />
      </FilterBar>

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
          // Sin una frase que explique para qué sirve un rol: «Nuevo rol» está en la banda.
          emptyTitle={t("empty.title")}
        />
        {data ? <Pagination {...data} onPageChange={setPage} onPageSizeChange={setPageSize} /> : null}
      </Surface>

      {deletingRole ? (
        <ConfirmDialog
          open
          onOpenChange={(next) => {
            if (!next) {
              setDeletingRole(undefined);
            }
          }}
          title={t("delete.title", { name: deletingRole.name })}
          description={t("delete.description")}
          confirmLabel={t("delete.confirm")}
          destructive
          pending={removal.isPending}
          pendingLabel={t("delete.deleting")}
          onConfirm={() => removal.mutate(deletingRole, { onSettled: () => setDeletingRole(undefined) })}
        />
      ) : null}
    </Page>
  );
}
