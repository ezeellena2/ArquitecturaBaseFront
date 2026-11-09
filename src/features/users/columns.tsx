import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import type { UserListItem } from "./api/users";
import { userIdentifier } from "./identity";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { Column } from "@/shared/ui/DataTable";
import { CheckIcon, PencilIcon, PowerIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";

/// Firma mínima que necesitamos de `t`: alcanza con la del namespace "users" (sin acoplar el tipo exacto de
/// react-i18next, que cambia de versión en versión).
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// Lo que hace la pantalla cuando se aprieta una acción de la fila. Si no viene, la columna no se arma: es
/// lo que pasa cuando el usuario no tiene `users.manage`.
export interface UserRowActions {
  onEdit: (user: UserListItem) => void;
  onToggleActive: (user: UserListItem) => void;
  onDelete: (user: UserListItem) => void;
}

/// Foco visible para las marcas que también explican su significado con ActionTooltip.
const hintTrigger = "inline-flex shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]";

/// La columna "Correo" (un dato por columna, UD5, 2026-11-09): el correo, o la raya si la cuenta no tiene. El número va
/// en "WhatsApp" y si ya entró con él, en "Verificado".
///
/// El estado va como un punto delante del correo y no como columna propia (excepción C, confirmada el 2026-11-09): así
/// entra la columna de roles, y el estado —que casi siempre es "activo"— no ocupa una columna entera para decir lo mismo
/// veinte veces. El punto es verde si está activa y rojo si está inactiva; la cuenta inactiva, además, se escribe apagada.
/// La acción de habilitar usa un check y la de deshabilitar, el ícono de encendido.
///
/// El punto es decorativo y la palabra va al lado, oculta para la vista pero no para el lector de pantalla.
/// Es la única concesión a "el color nunca comunica solo" del fundamento visual: para quien ve, el estado se
/// lee del color. Se aceptó a cambio de la densidad, y está anotada como excepción.
///
/// Son funciones que se llaman, no componentes que se montan: el archivo exporta la fábrica de columnas, y
/// declarar un componente al lado rompe el refresco en caliente.
function emailCell(row: UserListItem, t: Translate) {
  return (
    <span className="inline-flex max-w-full min-w-0 items-center gap-2">
      <span
        aria-hidden="true"
        className={cn(
          "size-2 shrink-0 rounded-full",
          row.isActive ? "bg-[var(--color-success)]" : "bg-[var(--color-danger)]",
        )}
      />
      <span className="sr-only">{row.isActive ? t("status.active") : t("status.inactive")}</span>
      {row.email !== null ? (
        <span className={cn("truncate font-medium", row.isActive ? "text-[var(--color-content)]" : "text-[var(--color-content-muted)]")}>{row.email}</span>
      ) : (
        <span className="text-[var(--color-content-muted)]">—</span>
      )}
    </span>
  );
}

/// "Verificado": si la persona ya entró con ese número. Un «No» es un número que cargó un admin y con el que todavía no
/// entró, y lo que quiere decir es texto de la fila, no un `aria-describedby`: NVDA y JAWS no anuncian la descripción de
/// algo que no recibe foco en modo exploración. A la vista, es la ayuda que aparece al pasar el mouse o al llegar con Tab.
function verifiedCell(row: UserListItem, t: Translate) {
  if (row.formattedPhoneNumber === null) return "—";
  if (row.phoneNumberConfirmed) return t("identity.verified");

  return (
    <ActionTooltip label={t("identity.unverifiedHint")}>
    <span tabIndex={0} className={cn(hintTrigger, "rounded-sm")}>
      {t("identity.notVerified")}
      <span className="sr-only">{t("identity.unverifiedHint")}</span>
    </span>
    </ActionTooltip>
  );
}

function rolesCell(roles: readonly string[]) {
  if (roles.length === 0) {
    return "—";
  }

  return (
    <span className="flex flex-wrap gap-1">
      {roles.map((role) => (
        <Badge key={role} variant="outline" className="text-[length:var(--text-caption)] font-medium text-[var(--color-content-muted)]">
          {role}
        </Badge>
      ))}
    </span>
  );
}

/// Las columnas ordenables (email, displayName, createdAtUtc) coinciden con la lista blanca del backend
/// (`GetUsersQuery.SortableFields`): el nombre es el que viaja en `sort`. La columna "Usuario" ordena por correo.
export function createUserColumns(
  t: Translate,
  language: string,
  timeZone: string | undefined,
  actions?: UserRowActions,
): Column<UserListItem>[] {
  const columns: Column<UserListItem>[] = [
    { id: "email", header: t("columns.email"), cell: (row) => emailCell(row, t), sortable: true },
    // El número formateado que manda el backend, nunca el E.164; no se parte en renglones.
    { id: "whatsapp", header: t("columns.whatsapp"), cell: (row) => row.formattedPhoneNumber === null ? "—" : <span className="whitespace-nowrap">{row.formattedPhoneNumber}</span> },
    { id: "verified", header: t("columns.verified"), cell: (row) => verifiedCell(row, t) },
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

  // El nombre accesible de cada botón lleva el correo de la fila, o el número si no tiene: sin eso, veinte filas
  // dan veinte botones llamados igual, y no hay forma de apretar el de una persona en concreto (ni con el teclado,
  // ni en un test). El orden y el rojo de la acción destructiva los decide `RowActions`, no esta lista.
  columns.push({
    id: "actions",
    header: t("columns.actions"),
    align: "right",
    cell: (row) => {
      const user = userIdentifier(row);

      return (
        <RowActions
          actions={[
            {
              label: t("actions.edit"),
              accessibleName: t("actions.editFor", { user }),
              icon: PencilIcon,
              onSelect: () => actions.onEdit(row),
            },
            {
              label: row.isActive ? t("actions.deactivate") : t("actions.activate"),
              accessibleName: row.isActive
                ? t("actions.deactivateFor", { user })
                : t("actions.activateFor", { user }),
              icon: row.isActive ? PowerIcon : CheckIcon,
              onSelect: () => actions.onToggleActive(row),
            },
            {
              label: t("actions.delete"),
              accessibleName: t("actions.deleteFor", { user }),
              icon: TrashIcon,
              onSelect: () => actions.onDelete(row),
              destructive: true,
            },
          ]}
        />
      );
    },
  });

  return columns;
}
