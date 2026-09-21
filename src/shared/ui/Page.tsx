import type { ComponentType, ReactNode } from "react";

/// El caparazón de una pantalla: la banda de encabezado y el contenido, en ese orden.
///
/// Es un solo componente y no un `PageHeader` suelto a propósito. La banda tiene que llegar a los bordes y el
/// contenido no, así que el padding dejó de estar en `<main>` — y un padding que cada pantalla tiene que
/// acordarse de poner es exactamente el tipo de criterio que el fundamento visual existe para evitar. Acá no
/// hay forma de dibujar una pantalla sin su banda ni de olvidarse el margen del contenido.
///
/// La banda queda adherida arriba: en un listado largo, el título y la acción primaria no se van de pantalla.
/// No tiene estado expandido ni descripción (fundamento visual, "Encabezados").
export function Page({
  icon: Icono,
  title,
  actions,
  children,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  actions?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between gap-5 border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-6">
        <span className="flex min-w-0 items-center gap-3">
          {Icono ? (
            // Decorativo: el título ya dice dónde estás. Va envuelto para que el `aria-hidden` valga aunque
            // el ícono venga de fuera del set propio.
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--color-brand-100)] text-[var(--color-brand-700)]"
            >
              <Icono className="size-4" />
            </span>
          ) : null}
          <h1 className="truncate text-lg font-semibold text-[var(--color-content)]">{title}</h1>
        </span>
        {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
      </header>

      <div className="p-6">{children}</div>
    </>
  );
}
