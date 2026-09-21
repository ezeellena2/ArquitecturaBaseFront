import type { UserListItem } from "./api/users";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
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

/// Estado como punto y texto, no como píldora de color: en veinte filas, veinte fondos teñidos compiten con
/// los datos. El punto es decorativo (`aria-hidden`) y quien lee el estado lee la palabra, que es además lo
/// que hace que el estado no dependa del color para entenderse.
/// Es una función que se llama, no un componente que se monta: el archivo exporta la fábrica de columnas, y
/// declarar un componente al lado rompe el refresco en caliente (y lo avisa el lint).
function statusCell(isActive: boolean, label: string) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-[var(--color-content)]">
      <span
        aria-hidden="true"
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          isActive ? "bg-[var(--color-success)]" : "bg-[var(--color-content-muted)]",
        )}
      />
      {label}
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
    { id: "email", header: t("columns.email"), cell: (row) => row.email, sortable: true },
    { id: "displayName", header: t("columns.displayName"), cell: (row) => row.displayName ?? "—", sortable: true },
    {
      id: "isActive",
      header: t("columns.isActive"),
      cell: (row) => statusCell(row.isActive, row.isActive ? t("status.active") : t("status.inactive")),
    },
    {
      id: "createdAtUtc",
      header: t("columns.createdAtUtc"),
      cell: (row) => formatDateTimeInZone(row.createdAtUtc, language, timeZone),
      sortable: true,
    },
  ];

  if (!actions) {
    return columns;
  }

  // El nombre accesible de cada botón lleva el correo de la fila: sin eso, veinte filas dan veinte botones
  // llamados igual, y no hay forma de apretar el de una persona en concreto (ni con el teclado, ni en un test).
  // El orden y la separación de la acción destructiva los decide `RowActions`, no esta lista.
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
