import type { UserListItem } from "./api/users";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { Column } from "@/shared/ui/DataTable";
import { PowerIcon, ShieldIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";

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

/// El estado va como un punto delante del correo y no como columna propia: así entra la columna de roles, que
/// es el dato que hace falta mirar fila por fila, y el estado —que casi siempre es "activo"— deja de ocupar
/// una columna entera para decir lo mismo veinte veces.
///
/// El punto es decorativo y la palabra va al lado, oculta para la vista pero no para el lector de pantalla.
/// Es la única concesión a "el color nunca comunica solo" del fundamento visual: para quien ve, el estado se
/// lee del color. Se aceptó a cambio de la densidad, y está anotada como excepción.
///
/// Son funciones que se llaman, no componentes que se montan: el archivo exporta la fábrica de columnas, y
/// declarar un componente al lado rompe el refresco en caliente.
function emailCell(row: UserListItem, statusLabel: string) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          row.isActive ? "bg-[var(--color-success)]" : "bg-[var(--color-content-muted)]",
        )}
      />
      <span className="sr-only">{statusLabel}</span>
      <span className="truncate font-medium text-[var(--color-content)]">{row.email}</span>
    </span>
  );
}

function rolesCell(roles: readonly string[]) {
  if (roles.length === 0) {
    return "—";
  }

  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="outline" className="text-[11px] font-medium text-[var(--color-content-muted)]">
          {role}
        </Badge>
      ))}
    </span>
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
    {
      id: "email",
      header: t("columns.email"),
      cell: (row) => emailCell(row, row.isActive ? t("status.active") : t("status.inactive")),
      sortable: true,
    },
    { id: "displayName", header: t("columns.displayName"), cell: (row) => row.displayName ?? "—", sortable: true },
    { id: "roles", header: t("columns.roles"), cell: (row) => rolesCell(row.roles) },
    {
      id: "createdAtUtc",
      header: t("columns.createdAtUtc"),
      align: "right",
      // Cifras tabulares: sin eso, las fechas de una columna alineada a la derecha bailan de fila en fila.
      cell: (row) => (
        <span className="tabular-nums">{formatDateInZone(row.createdAtUtc, language, timeZone)}</span>
      ),
      sortable: true,
    },
  ];

  if (!actions) {
    return columns;
  }

  // El nombre accesible de cada botón lleva el correo de la fila: sin eso, veinte filas dan veinte botones
  // llamados igual, y no hay forma de apretar el de una persona en concreto (ni con el teclado, ni en un test).
  // El orden y el rojo de la acción destructiva los decide `RowActions`, no esta lista.
  columns.push({
    id: "actions",
    header: t("columns.actions"),
    align: "right",
    cell: (row) => (
      <RowActions
        actions={[
          {
            label: t("actions.editRoles"),
            accessibleName: t("actions.editRolesFor", { email: row.email }),
            icon: ShieldIcon,
            onSelect: () => actions.onEditRoles(row),
          },
          {
            label: row.isActive ? t("actions.deactivate") : t("actions.activate"),
            accessibleName: row.isActive
              ? t("actions.deactivateFor", { email: row.email })
              : t("actions.activateFor", { email: row.email }),
            icon: PowerIcon,
            onSelect: () => actions.onToggleActive(row),
          },
          {
            label: t("actions.delete"),
            accessibleName: t("actions.deleteFor", { email: row.email }),
            icon: TrashIcon,
            onSelect: () => actions.onDelete(row),
            destructive: true,
          },
        ]}
      />
    ),
  });

  return columns;
}
