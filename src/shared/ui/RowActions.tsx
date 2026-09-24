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
  /// Lo que no se puede deshacer. Va última del grupo y se tiñe de rojo solo al interactuar: un ícono rojo
  /// permanente grita en un listado de veinte filas.
  destructive?: boolean;
  /// Sin permiso no se dibuja. No se deja deshabilitada: un botón deshabilitado no recibe foco, así que con
  /// teclado no hay forma de llegar a saber por qué está apagado.
  hidden?: boolean;
}

/// El tooltip es CSS puro sobre `:hover` y `:focus-visible`, no un Tooltip de Radix: un listado de cien filas
/// con tres acciones montaría trescientos componentes para mostrar una palabra.
///
/// Sin `border-*`: el separador lo pone el `divide-x` del grupo, que Tailwind 4 genera con `:where()`, de
/// especificidad cero. Cualquier borde del botón le gana, y con el `border-0` que tuvo hasta el 2026-09-23 el
/// grupo se dibujaba sin separadores. El borde en cero ya lo pone el preflight, en una capa que sí pierde.
const boton =
  "group/act relative inline-flex h-7 w-8 items-center justify-center bg-transparent text-[var(--color-content-muted)] transition-colors cursor-pointer " +
  "hover:bg-[var(--color-brand-50)] hover:text-[var(--color-brand-700)] " +
  "focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--color-brand-500)]";

const peligro = "hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]";

const tooltip =
  "pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md " +
  "bg-[var(--color-content)] px-2 py-1.5 text-xs font-medium leading-none text-white opacity-0 transition-opacity " +
  "group-hover/act:opacity-100 group-focus-visible/act:opacity-100";

/// Grupo segmentado: un solo borde alrededor y separadores entre los botones. Uno solo para todas las
/// acciones, incluida la destructiva: separarla en una caja aparte fue una idea propia que el tablero no
/// tiene, y en una fila de 44 px se lee como dos controles distintos en vez de uno.
const grupo = "inline-flex overflow-hidden rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] divide-x divide-[var(--color-border)]";

function Grupo({ acciones }: { acciones: RowAction[] }) {
  return (
    <span className={grupo}>
      {acciones.map((accion, posicion) => {
        const Icono = accion.icon;

        // La key es el lugar en el grupo, no el nombre accesible. El nombre lleva el dato de la fila, y ese dato
        // cambia con lo que hacen las acciones (agregarle el correo a quien solo tenía número, activar a quien
        // estaba inactivo). Con el nombre de key, React tiraba el botón y montaba otro, y el foco que un diálogo le
        // devolvía al que lo abrió iba a parar a un nodo que ya no estaba: a <body>. El orden de las acciones es
        // fijo por construcción, así que el lugar identifica a cada una.
        return (
          <button
            key={posicion}
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
/// El orden lo decide este componente, no quien lo usa: las inocuas primero y la destructiva última. Que sea
/// por construcción es lo que hace que la memoria muscular sirva en todas las pantallas.
export function RowActions({ actions }: { actions: RowAction[] }): ReactNode {
  const visibles = actions.filter((accion) => !accion.hidden);

  if (visibles.length === 0) {
    // Sin esto, la columna dejaría un borde flotando en las filas donde no hay nada que hacer.
    return null;
  }

  return (
    <span className="inline-flex justify-end">
      <Grupo acciones={[...visibles.filter((accion) => !accion.destructive), ...visibles.filter((accion) => accion.destructive)]} />
    </span>
  );
}
