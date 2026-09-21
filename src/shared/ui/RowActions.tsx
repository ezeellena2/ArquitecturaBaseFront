import type { ComponentType, ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

export interface RowAction {
  /// Texto corto del tooltip: "Roles", "Desactivar", "Eliminar".
  label: string;
  /// Nombre accesible completo, con el dato de la fila: "Eliminar a ana@ejemplo.com". Sin el dato, veinte
  /// filas dan veinte botones llamados igual y no hay forma de apretar el de una persona en concreto.
  accessibleName: string;
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
  /// Lo que no se puede deshacer. Va última y se tiñe de rojo solo al interactuar: un ícono rojo permanente
  /// grita en un listado de veinte filas.
  destructive?: boolean;
  /// Sin permiso no se dibuja. No se deja deshabilitada: un botón deshabilitado no recibe foco, así que con
  /// teclado no hay forma de llegar a saber por qué está apagado.
  hidden?: boolean;
}

/// El tooltip es CSS puro sobre `:hover` y `:focus-visible`, no un Tooltip de Radix: un listado de cien filas
/// con tres acciones montaría trescientos componentes para mostrar una palabra.
const boton =
  "group/act relative inline-flex size-8 items-center justify-center border-0 bg-transparent text-[var(--color-content-muted)] transition-colors cursor-pointer " +
  "hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)]";

const peligro = "hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]";

const tooltip =
  "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md " +
  "bg-[var(--color-content)] px-2 py-1.5 text-xs font-medium leading-none text-white opacity-0 transition-opacity " +
  "group-hover/act:opacity-100 group-focus-visible/act:opacity-100";

/// Grupo segmentado: un solo borde alrededor y separadores entre los botones.
const grupo = "inline-flex overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] divide-x divide-[var(--color-border)]";

function Grupo({ acciones }: { acciones: RowAction[] }) {
  return (
    <span className={grupo}>
      {acciones.map((accion) => {
        const Icono = accion.icon;

        return (
          <button
            key={accion.accessibleName}
            type="button"
            aria-label={accion.accessibleName}
            onClick={accion.onSelect}
            className={cn(boton, accion.destructive ? peligro : undefined)}
          >
            {/* El envoltorio garantiza que el ícono quede oculto para el lector aunque venga de fuera del
                set propio: el nombre accesible lo pone el botón, no el dibujo. */}
            <span aria-hidden="true" className="inline-flex">
              <Icono className="size-[18px]" />
            </span>
            <span aria-hidden="true" className={tooltip}>
              {accion.label}
            </span>
          </button>
        );
      })}
    </span>
  );
}

/// Las acciones de una fila (sección "Íconos y acciones" del fundamento visual): ícono, tooltip al pasar por
/// encima o al llegar con el teclado, y nombre accesible con el dato de la fila.
///
/// El orden lo decide este componente, no quien lo usa: las inocuas primero y la destructiva última, separada
/// del grupo. Que sea por construcción es lo que hace que la memoria muscular sirva en todas las pantallas.
export function RowActions({ actions }: { actions: RowAction[] }): ReactNode {
  const visibles = actions.filter((accion) => !accion.hidden);

  if (visibles.length === 0) {
    // Sin esto, la columna dejaría un borde flotando en las filas donde no hay nada que hacer.
    return null;
  }

  const inocuas = visibles.filter((accion) => !accion.destructive);
  const destructivas = visibles.filter((accion) => accion.destructive);

  return (
    <span className="inline-flex items-center gap-1.5">
      {inocuas.length > 0 ? <Grupo acciones={inocuas} /> : null}
      {destructivas.length > 0 ? <Grupo acciones={destructivas} /> : null}
    </span>
  );
}
