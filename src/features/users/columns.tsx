import type { UserListItem } from "./api/users";
import { Badge } from "@/shared/ui/badge";
import type { Column } from "@/shared/ui/DataTable";

/// Firma mínima que necesitamos de `t`: alcanza con la del namespace "users" (sin acoplar el tipo exacto de
/// react-i18next, que cambia de versión en versión).
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// La fecha llega en UTC (sección 6.3 del spec): se muestra en la zona horaria del perfil, no la cadena cruda.
function formatCreatedAt(valueUtc: string, language: string, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone }).format(
    new Date(valueUtc),
  );
}

/// Las columnas ordenables (email, displayName, createdAtUtc) coinciden con la lista blanca del backend
/// (`GetUsersQuery.SortableFields`): el nombre es el que viaja en `sort`.
export function createUserColumns(t: Translate, language: string, timeZone: string | undefined): Column<UserListItem>[] {
  return [
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
}
