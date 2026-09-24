import type { FocusEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent } from "react";
import type { UserListItem } from "./api/users";
import { userIdentifier } from "./identity";
import { formatDateInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";
import type { Column } from "@/shared/ui/DataTable";
import { PencilIcon, PowerIcon, SmartphoneIcon, TrashIcon } from "@/shared/ui/icons";
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

/// La ayuda de lo que el tablero explica al pie del listado (qué quiere decir el ícono del teléfono al lado del correo
/// y "Sin verificar"), puesta sobre la pieza que explica. CSS puro, como el tooltip de `RowActions`: un Tooltip de
/// Radix por fila montaría cien componentes para una frase. Va arriba y no abajo: debajo de la última fila estiraría
/// la caja de la tabla, que desborda con scroll.
///
/// Aparece al pasar el mouse y al llegar con el teclado ("lo que hace el puntero también lo hace el teclado", fundamento
/// visual), así que la pieza que la lleva recibe el foco (`hintTrigger`). Y como tapa la fila de arriba, cumple WCAG
/// 1.4.13: el puntero puede ir hasta ella sin que se cierre (el `before:` tiende un puente sobre los 6 px que la
/// separan de la pieza; oculta, no atrapa el puntero) y se cierra con Esc (`data-dismissed`, ver `hintEvents`).
const hint =
  "pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-10 w-max max-w-72 -translate-x-1/2 rounded-md " +
  "bg-[var(--color-content)] px-2 py-1.5 text-xs font-medium leading-snug whitespace-normal text-white opacity-0 " +
  "transition-opacity before:absolute before:inset-x-0 before:top-full before:h-1.5 before:content-[''] " +
  "group-hover/hint:pointer-events-auto group-hover/hint:opacity-100 group-focus-visible/hint:opacity-100 " +
  "group-data-dismissed/hint:pointer-events-none! group-data-dismissed/hint:opacity-0!";

/// La pieza que lleva la ayuda. Recibe el foco, con el mismo anillo que las acciones de la fila.
const hintTrigger =
  "group/hint relative inline-flex shrink-0 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]";

/// Los Esc que siguen escuchando mientras el puntero está sobre una pieza.
const escapeWhileHovered = new WeakMap<HTMLElement, (event: KeyboardEvent) => void>();

function dismissHint(trigger: HTMLElement) {
  trigger.setAttribute("data-dismissed", "");
}

function restoreHint(trigger: HTMLElement) {
  trigger.removeAttribute("data-dismissed");
}

/// Esc cierra la ayuda sin mover ni el puntero ni el foco, y la ayuda vuelve la próxima vez que se llega a la pieza.
/// Con el foco, el Esc llega a la pieza; con el puntero encima, el foco puede estar en cualquier lado, así que mientras
/// dura el hover escucha también el documento. Es un atributo del DOM y no estado de React porque esto son funciones
/// que se llaman, no componentes: un estado por fila es justo lo que se evitó al no usar un Tooltip de Radix.
const hintEvents = {
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      dismissHint(event.currentTarget);
    }
  },
  onBlur: (event: FocusEvent<HTMLElement>) => {
    // Con el puntero todavía encima, sigue cerrada hasta que se vaya.
    if (!escapeWhileHovered.has(event.currentTarget)) {
      restoreHint(event.currentTarget);
    }
  },
  onMouseEnter: (event: MouseEvent<HTMLElement>) => {
    const trigger = event.currentTarget;

    if (escapeWhileHovered.has(trigger)) {
      return;
    }

    const onEscape = (key: KeyboardEvent) => {
      // La fila se pudo ir con el puntero encima (el listado se volvió a pedir): el que escucha se va con ella.
      if (!trigger.isConnected) {
        document.removeEventListener("keydown", onEscape);
      } else if (key.key === "Escape") {
        dismissHint(trigger);
      }
    };

    escapeWhileHovered.set(trigger, onEscape);
    document.addEventListener("keydown", onEscape);
  },
  onMouseLeave: (event: MouseEvent<HTMLElement>) => {
    const trigger = event.currentTarget;
    const onEscape = escapeWhileHovered.get(trigger);

    if (onEscape !== undefined) {
      document.removeEventListener("keydown", onEscape);
      escapeWhileHovered.delete(trigger);
    }

    // Con el foco todavía adentro, sigue cerrada hasta que el foco se vaya.
    if (document.activeElement !== trigger) {
      restoreHint(trigger);
    }
  },
};

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
    <span
      role="img"
      aria-label={label}
      tabIndex={0}
      className={cn(hintTrigger, "rounded-sm text-[var(--color-content-muted)]")}
      {...hintEvents}
    >
      <SmartphoneIcon className="size-3.5" />
      <span aria-hidden="true" className={hint}>
        {label}
      </span>
    </span>
  );
}

/// "Sin verificar": un número que cargó un admin y con el que la persona todavía no entró. Lo que quiere decir es texto
/// de la fila, no un `aria-describedby`: NVDA y JAWS no anuncian la descripción de algo que no recibe foco en modo
/// exploración. A la vista, es la ayuda que aparece al pasar el mouse o al llegar con el teclado.
function unverifiedBadge(t: Translate) {
  return (
    <span tabIndex={0} className={cn(hintTrigger, "rounded-full")} {...hintEvents}>
      <VerificationBadge verified={false} className="text-[11px]">
        {t("methods.unverified")}
      </VerificationBadge>
      <span className={hint}>{t("identity.unverifiedHint")}</span>
    </span>
  );
}

/// La columna "Usuario" (tablero "WhatsApp · Usuarios: alta con teléfono", punto 1): quién es, con el correo o, si
/// no tiene, con el número formateado que manda el backend. El E.164 no se muestra nunca.
///
/// El estado va como un punto delante y no como columna propia: así entra la columna de roles, que es el dato que
/// hace falta mirar fila por fila, y el estado —que casi siempre es "activo"— deja de ocupar una columna entera
/// para decir lo mismo veinte veces. Una cuenta inactiva, además, se escribe apagada.
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
          "size-1.5 shrink-0 rounded-full",
          row.isActive ? "bg-[var(--color-success)]" : "bg-[var(--color-content-muted)]",
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
              icon: PowerIcon,
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
