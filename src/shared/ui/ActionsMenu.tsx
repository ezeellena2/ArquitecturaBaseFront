import type { ComponentType, ReactNode, Ref } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./dropdown-menu";
import { IconButton } from "./IconButton";
import { MoreVerticalIcon } from "./icons";

export interface ActionsMenuItem {
  separator?: false;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  /// Lo que destruye (eliminar, anular): va al final, en rojo y después de una línea.
  destructive?: boolean;
  /// Apagado: elegirlo no hace nada y el menú sigue abierto. Con `reason`, también queda apagado.
  unavailable?: boolean;
  /// Por qué está apagado, adentro del ítem y debajo de su texto: un ítem de menú muestra su motivo adentro (MA1-A).
  reason?: string | null;
  onSelect: () => void;
}

/// Una línea entre grupos de ítems; la de antes de lo destructivo la pone el menú.
export type ActionsMenuEntry = ActionsMenuItem | { separator: true };

interface ActionsMenuProps {
  /// El nombre de ⋮: «Más acciones», «Acciones del formulario».
  label: string;
  items: readonly ActionsMenuEntry[];
  /// Una aclaración al final, que no es una acción.
  note?: string;
  triggerRef?: Ref<HTMLButtonElement>;
  /// ⋮ trabaja, por una descarga pedida desde el menú; quien lo usa también cambia su nombre por lo que hace.
  pending?: boolean;
  disabled?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /// Para que el foco no vuelva a ⋮ cuando un ítem abre un diálogo que lo maneja.
  onCloseAutoFocus?: (event: Event) => void;
}

const isSeparator = (entry: ActionsMenuEntry): entry is { separator: true } => entry.separator === true;

/// La línea antes del primer ítem destructivo, si no la tiene.
function withLineBeforeDestructive(items: readonly ActionsMenuEntry[]): ActionsMenuEntry[] {
  const entries: ActionsMenuEntry[] = [];
  for (const entry of items) {
    const previous = entries.at(-1);
    if (!isSeparator(entry) && entry.destructive && previous && !isSeparator(previous) && !previous.destructive) entries.push({ separator: true });
    entries.push(entry);
  }
  return entries;
}

/// ⋮ con lo demás que se hace con el objeto (AC1-A, 2026-11-11): corregir, anular, dar de baja, reactivar, eliminar,
/// descargar la plantilla, ordenar. A la vista queda la tarea de la pantalla y lo que lleva a otro lado. Lo destructivo va
/// al final, en rojo y después de una línea, y un ítem apagado dice su motivo adentro. Al cerrarse, el foco vuelve a ⋮.
export function ActionsMenu({ label, items, note, triggerRef, pending, disabled, open, onOpenChange, onCloseAutoFocus }: ActionsMenuProps): ReactNode {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <IconButton ref={triggerRef} label={label} pending={pending} disabled={disabled}>
          <MoreVerticalIcon className="size-4" aria-hidden="true" />
        </IconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onCloseAutoFocus={onCloseAutoFocus}>
        {withLineBeforeDestructive(items).map((entry, index) => isSeparator(entry)
          ? <DropdownMenuSeparator key={`separator-${index}`} />
          : <ActionsMenuEntryItem key={`${entry.label}-${index}`} item={entry} />)}
        {note ? <DropdownMenuLabel className="max-w-64 whitespace-normal">{note}</DropdownMenuLabel> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ActionsMenuEntryItem({ item }: { item: ActionsMenuItem }): ReactNode {
  const unavailable = item.unavailable || !!item.reason;
  const Icon = item.icon;
  return (
    <DropdownMenuItem variant={item.destructive ? "destructive" : "default"} aria-disabled={unavailable || undefined}
      onSelect={event => { if (unavailable) event.preventDefault(); else item.onSelect(); }}>
      {Icon ? <Icon className="size-4" /> : null}
      <span>{item.label}{item.reason ? <span className="block text-xs">{item.reason}</span> : null}</span>
    </DropdownMenuItem>
  );
}
