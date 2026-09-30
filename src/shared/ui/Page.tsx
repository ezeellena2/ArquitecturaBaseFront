import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "./icons";
import { ActionTooltip } from "./ActionTooltip";

/// El caparazón de una pantalla: el encabezado y el contenido, en ese orden.
///
/// Es un solo componente y no un `PageHeader` suelto a propósito. El encabezado tiene que llegar a los bordes
/// y el contenido no, así que el padding dejó de estar en `<main>` — y un padding que cada pantalla tiene que
/// acordarse de poner es exactamente el tipo de criterio que el fundamento visual existe para evitar. Acá no
/// hay forma de dibujar una pantalla sin su encabezado ni de olvidarse el margen del contenido.
///
/// El título comparte la línea con las acciones, sobre el tono suave del encabezado de pantalla de Jade.
/// No lleva ícono de sección: el título y el menú ya dicen dónde estás.
///
/// Queda adherido arriba: en un listado largo, el título y la acción primaria no se van de pantalla.
/// No tiene estado expandido ni descripción (fundamento visual, "Encabezados").
///
/// Una pantalla hija (el rol en `/roles/{id}`) pasa `backTo`: delante del título va el enlace para volver a
/// la sección de la que cuelga. Y `status` es lo que acompaña al título sin ser parte de él ("Del sistema",
/// "· Cambios sin guardar"): va al lado del `h1` y no adentro, para que el nombre de la pantalla no cambie
/// con cada tecla.
export function Page({
  title,
  backTo,
  status,
  actions,
  children,
}: {
  title: string;
  backTo?: { to: string; label: string };
  status?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}): ReactNode {
  return (
    <>
      <header className="sticky top-0 z-20 flex min-h-12 flex-wrap items-center justify-between gap-x-5 gap-y-2 border-b border-[var(--color-border)] bg-[var(--color-page-header)] px-5 py-2 sm:flex-nowrap sm:py-0 max-sm:static">
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1 sm:flex-nowrap max-sm:basis-full">
          {backTo ? (
            <ActionTooltip label={backTo.label}>
            <Link
              to={backTo.to}
              aria-label={backTo.label}
              className="inline-flex size-6 shrink-0 translate-y-[3px] items-center justify-center rounded-[var(--radius-control)] text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Link>
            </ActionTooltip>
          ) : null}
          <h1 className="min-w-0 truncate text-2xl font-semibold tracking-normal text-[var(--color-content)] max-sm:whitespace-normal max-sm:break-words">{title}</h1>
          {status ? <span className="flex shrink-0 items-center gap-2 max-sm:basis-full">{status}</span> : null}
        </span>
        {actions ? <span className="flex shrink-0 items-center gap-2 max-sm:ml-auto">{actions}</span> : null}
      </header>

      <div className="px-5 py-4">{children}</div>
    </>
  );
}
