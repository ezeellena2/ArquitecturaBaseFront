import type { UserListItem } from "./api/users";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import type { Column } from "@/shared/ui/DataTable";

/// Firma mínima que necesitamos de `t`: alcanza con la del namespace "users" (sin acoplar el tipo exacto de
/// react-i18next, que cambia de versión en versión).
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// Lo que hace la pantalla cuando se aprieta una acción de la fila. Si no viene, la columna no se arma: es
/// lo que pasa cuando el usuario no tiene `users.manage`.
export interface UserRowActions {
  onEditRoles: (user: UserListItem) => void;
  onToggleActive: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
}

/// La fecha llega en UTC (sección 6.3 del spec): se muestra en la zona horaria del perfil, no la cadena cruda.
function formatCreatedAt(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(valueUtc),
  );
}

/// Las columnas ordenables (email, displayName, createdAtUtc) coinciden con la lista blanca del backend
/// (`GetUsersQuery.SortableFields`): el nombre es el que viaja en `sort`.
export function createUserColumns(
  t: Translate,
  language: string,
  timeZone: string | undefined,
  actions?: UserRowActions,
): Column<UserListItem>[] {
  const columns: Column<UserListItem>[] = [
    { id: "email", header: t("columns.email"), cell: (row) => row.email, sortable: true },
    { id: "displayName", header: t("columns.displayName"), cell: (row) => row.displayName ?? "—", sortable: true },
    {
      id: "isActive",
      header: t("columns.isActive"),
      cell: (row) =>
        row.isActive ? (
          <Badge variant="outline" className="border-transparent bg-[var(--color-success)]/15 text-[var(--color-success)]">
            {t("status.active")}
          </Badge>
        ) : (
          <Badge variant="secondary">{t("status.inactive")}</Badge>
        ),
    },
    {
      id: "createdAtUtc",
      header: t("columns.createdAtUtc"),
      cell: (row) => formatCreatedAt(row.createdAtUtc, language, timeZone),
      sortable: true,
    },
  ];

  if (!actions) {
    return columns;
  }

  // El nombre accesible de cada botón lleva el correo de la fila: sin eso, veinte filas dan veinte botones
  // llamados igual, y no hay forma de apretar el de una persona en concreto (ni con el teclado, ni en un test).
  columns.push({
    id: "actions",
    header: t("columns.actions"),
    align: "right",
    cell: (row) => (
      <div className="flex justify-end gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={t("actions.editRolesFor", { email: row.email })}
          onClick={() => actions.onEditRoles(row)}
        >
          {t("actions.editRoles")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={
            row.isActive
              ? t("actions.deactivateFor", { email: row.email })
              : t("actions.activateFor", { email: row.email })
          }
          onClick={() => actions.onToggleActive(row)}
        >
          {row.isActive ? t("actions.deactivate") : t("actions.activate")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-[var(--color-danger)]"
          aria-label={t("actions.deleteFor", { email: row.email })}
          onClick={() => actions.onDelete(row)}
        >
          {t("actions.delete")}
        </Button>
      </div>
    ),
  });

  return columns;
}
