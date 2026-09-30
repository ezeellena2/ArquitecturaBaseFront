import { ActionTooltip } from "@/shared/ui/ActionTooltip";
import type { UserListItem } from "./api/users";
import { userIdentifier } from "./identity";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { Column } from "@/shared/ui/DataTable";
import { CheckIcon, PencilIcon, PowerIcon, SmartphoneIcon, TrashIcon } from "@/shared/ui/icons";
import { RowActions } from "@/shared/ui/RowActions";
import { VerificationBadge } from "@/shared/ui/VerificationBadge";

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

/// El ícono del teléfono delante del número: el número ya dice que entra con WhatsApp, así que el ícono queda para la
/// vista, oculto para el lector como en el tablero. No lleva ayuda: sin foco, le llegaría solo al puntero.
function phoneIcon() {
  return (
    <span aria-hidden="true" className="inline-flex shrink-0 text-[var(--color-content-muted)]">
      <SmartphoneIcon className="size-3.5" />
    </span>
  );
}

/// El ícono del teléfono al lado del correo: dice algo que no está escrito ("también entra con WhatsApp"), así que se
/// anuncia con eso y lo muestra en la ayuda. Adentro de un `img`, lo demás es presentación: la ayuda no se lee dos veces.
function alsoWhatsAppMark(t: Translate) {
  const label = t("identity.alsoWhatsApp");

  return (
    <ActionTooltip label={label}>
    <span
      role="img"
      aria-label={label}
      tabIndex={0}
      className={cn(hintTrigger, "rounded-sm text-[var(--color-content-muted)]")}
    >
      <SmartphoneIcon className="size-3.5" />
    </span>
    </ActionTooltip>
  );
}

/// "Sin verificar": un número que cargó un admin y con el que la persona todavía no entró. Lo que quiere decir es texto
/// de la fila, no un `aria-describedby`: NVDA y JAWS no anuncian la descripción de algo que no recibe foco en modo
/// exploración. A la vista, es la ayuda que aparece al pasar el mouse o al llegar con el teclado.
function unverifiedBadge(t: Translate) {
  return (
    <ActionTooltip label={t("identity.unverifiedHint")}>
    <span tabIndex={0} className={cn(hintTrigger, "rounded-[var(--radius-control)]")}>
      <VerificationBadge verified={false} className="text-[11px]">
        {t("methods.unverified")}
      </VerificationBadge>
      <span className="sr-only">{t("identity.unverifiedHint")}</span>
    </span>
    </ActionTooltip>
  );
}

/// La columna "Usuario" (tablero "WhatsApp · Usuarios: alta con teléfono", punto 1): quién es, con el correo o, si
/// no tiene, con el número formateado que manda el backend. El E.164 no se muestra nunca.
///
/// El estado va como un punto delante y no como columna propia: así entra la columna de roles, que es el dato que
/// hace falta mirar fila por fila, y el estado —que casi siempre es "activo"— deja de ocupar una columna entera
/// para decir lo mismo veinte veces. El punto es verde si está activa y rojo si está inactiva; la cuenta inactiva,
/// además, se escribe apagada. La acción de habilitar usa un check y la de deshabilitar, el ícono de encendido.
///
/// El punto es decorativo y la palabra va al lado, oculta para la vista pero no para el lector de pantalla.
/// Es la única concesión a "el color nunca comunica solo" del fundamento visual: para quien ve, el estado se
/// lee del color. Se aceptó a cambio de la densidad, y está anotada como excepción.
///
/// Son funciones que se llaman, no componentes que se montan: el archivo exporta la fábrica de columnas, y
/// declarar un componente al lado rompe el refresco en caliente.
function identityCell(row: UserListItem, t: Translate) {
  const phone = row.formattedPhoneNumber;
  const text = cn(
    "truncate font-medium",
    row.isActive ? "text-[var(--color-content)]" : "text-[var(--color-content-muted)]",
  );

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
        <>
          <span className={text}>{row.email}</span>
          {phone !== null ? alsoWhatsAppMark(t) : null}
        </>
      ) : phone !== null ? (
        <>
          {phoneIcon()}
          <span className={cn(text, "whitespace-nowrap")}>{phone}</span>
        </>
      ) : (
        // Sin correo ni número: se le desvinculó el WhatsApp a alguien que no tenía correo.
        <span className="text-[var(--color-content-muted)]">—</span>
      )}
      {phone !== null && !row.phoneNumberConfirmed ? unverifiedBadge(t) : null}
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
/// (`GetUsersQuery.SortableFields`): el nombre es el que viaja en `sort`. La columna "Usuario" ordena por correo.
export function createUserColumns(
  t: Translate,
  language: string,
  timeZone: string | undefined,
  actions?: UserRowActions,
): Column<UserListItem>[] {
  const columns: Column<UserListItem>[] = [
    { id: "email", header: t("columns.user"), cell: (row) => identityCell(row, t), sortable: true },
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
