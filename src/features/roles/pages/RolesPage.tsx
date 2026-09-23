import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { deleteRole } from "../api/roles";
import { roleActionErrorMessage } from "../errors";
import { isAdminRole } from "../lib/systemRoles";
import { Can } from "@/auth/Can";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { fetchRoles, rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { EyeIcon, PencilIcon, ShieldIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { Page } from "@/shared/ui/Page";

/// `/roles` (sección 11 del spec de la Fase 4). El endpoint devuelve la lista entera, no una página: son
/// pocos y se usan como catálogo desde otras pantallas, así que no hay buscador ni paginado.
///
/// El alta y la edición no se hacen acá: "Nuevo rol" y "Editar" llevan a la pantalla del rol (`/roles/nuevo` y
/// `/roles/{id}`, `RoleEditorPage`). Eliminar sí sigue siendo una confirmación sobre el listado.
export function RolesPage() {
  const { t } = useTranslation("roles");
  const { has } = usePermissions();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [deletingRole, setDeletingRole] = useState<RoleListItem | undefined>();

  const canManage = has("roles.manage");

  const { data, error, isLoading, refetch } = useQuery({ queryKey: rolesQueryKey, queryFn: fetchRoles });

  const removal = useMutation({
    mutationFn: (role: RoleListItem) => deleteRole(role.id),
    onSuccess: async () => {
      toast.success(t("feedback.deleted"));
      await queryClient.invalidateQueries({ queryKey: rolesQueryKey });
    },
    // `ConfirmDialog` se cierra al confirmar, así que el error llega cuando el diálogo ya no está: va a un aviso.
    onError: (mutationError) => toast.error(roleActionErrorMessage(mutationError, t)),
  });

  const apiError = error instanceof ApiError ? error : undefined;

  const columns: Column<RoleListItem>[] = [
    {
      id: "name",
      header: t("columns.name"),
      cell: (row) => (
        <span className="flex items-center gap-2">
          {row.name}
          {row.isSystemRole ? <Badge variant="secondary">{t("systemBadge")}</Badge> : null}
        </span>
      ),
    },
    { id: "description", header: t("columns.description"), cell: (row) => row.description ?? "—" },
    { id: "userCount", header: t("columns.userCount"), cell: (row) => String(row.userCount) },
    {
      id: "permissions",
      header: t("columns.permissions"),
      cell: (row) => t("permissionsCount", { count: row.permissions.length }),
    },
  ];

  if (canManage) {
    // Los roles del sistema también se abren (tablero "Roles · Acciones del listado"): Admin, para mirarlo,
    // porque su pantalla es de solo lectura; User, para editarlo, porque la descripción y los permisos sí se
    // cambian. Ninguno de los dos se elimina: la acción ni se dibuja, como una sin permiso.
    columns.push({
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
      icon={ShieldIcon}
      title={t("title")}
      actions={
        <Can permission="roles.manage">
          <Button asChild>
            <Link to="/roles/nuevo">{t("actions.new")}</Link>
          </Button>
        </Can>
      }
    >
      {/* Sin padding y con `overflow-hidden`: la banda del encabezado llega a los bordes de la caja y se
          recorta con su radio. Con padding, la tabla flota adentro y la banda deja de ser la cabecera de la
          caja para ser un rectángulo suelto. */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <DataTable
          columns={columns}
          rows={data ?? []}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          error={apiError ? (apiError.isNetworkError ? t("common:errors.network") : (apiError.detail ?? apiError.message)) : undefined}
          errorDescription={apiError?.traceId ? t("errorTraceId", { traceId: apiError.traceId }) : undefined}
          onRetry={() => void refetch()}
          emptyTitle={t("empty.title")}
          emptyDescription={t("empty.description")}
        />
      </div>

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
          onConfirm={() => removal.mutate(deletingRole)}
        />
      ) : null}
    </Page>
  );
}
