import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { deleteRole } from "../api/roles";
import { RoleFormDialog } from "../components/RoleFormDialog";
import { roleActionErrorMessage } from "../errors";
import { Can } from "@/auth/Can";
import { usePermissions } from "@/auth/usePermissions";
import { ForbiddenPage } from "@/features/errors/pages/ForbiddenPage";
import { ApiError } from "@/shared/api/ApiError";
import { fetchRoles, rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DataTable, type Column } from "@/shared/ui/DataTable";
import { PencilIcon, ShieldIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { Page } from "@/shared/ui/Page";

/// `/roles` (sección 11 del spec de la Fase 4). El endpoint devuelve la lista entera, no una página: son
/// pocos y se usan como catálogo desde otras pantallas, así que no hay buscador ni paginado.
export function RolesPage() {
  const { t } = useTranslation("roles");
  const { has } = usePermissions();
  const queryClient = useQueryClient();

  const [isCreating, setIsCreating] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleListItem | undefined>();
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
    // Los roles del sistema se ven igual que el resto, pero en lugar de los botones queda dicho que no se
    // cambian, y debajo de la tabla, por qué. Botones deshabilitados no servirían: no reciben foco, así que
    // con el teclado no habría forma de llegar a la explicación.
    columns.push({
      id: "actions",
      header: t("columns.actions"),
      align: "right",
      cell: (row) =>
        row.isSystemRole ? (
          <span className="text-sm text-[var(--color-content-muted)]">{t("systemLocked")}</span>
        ) : (
          <RowActions
            actions={[
              {
                label: t("actions.edit"),
                accessibleName: t("actions.editFor", { name: row.name }),
                icon: PencilIcon,
                onSelect: () => setEditingRole(row),
              },
              {
                label: t("actions.delete"),
                accessibleName: t("actions.deleteFor", { name: row.name }),
                icon: TrashIcon,
                onSelect: () => setDeletingRole(row),
                destructive: true,
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
          <Button type="button" onClick={() => setIsCreating(true)}>
            {t("actions.new")}
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

      {isCreating ? <RoleFormDialog onClose={() => setIsCreating(false)} /> : null}

      {editingRole ? <RoleFormDialog role={editingRole} onClose={() => setEditingRole(undefined)} /> : null}

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
