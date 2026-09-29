import type { ReactNode } from "react";
import { Link } from "react-router";
import { ChevronLeftIcon } from "./icons";

/// El caparazón de una pantalla: el encabezado y el contenido, en ese orden.
///
/// Es un solo componente y no un `PageHeader` suelto a propósito. El encabezado tiene que llegar a los bordes
/// y el contenido no, así que el padding dejó de estar en `<main>` — y un padding que cada pantalla tiene que
/// acordarse de poner es exactamente el tipo de criterio que el fundamento visual existe para evitar. Acá no
/// hay forma de dibujar una pantalla sin su encabezado ni de olvidarse el margen del contenido.
///
/// El encabezado ya no es una banda de otro color con el ícono de la sección adentro de un cuadradito: es el
/// título sobre el mismo fondo, en la línea de las acciones, y una sola línea que lo separa del contenido.
/// La banda tintada y el ícono enmarcado son lo que hace que cualquier panel se parezca a cualquier otro.
/// El ícono de la sección tampoco aporta: el título ya dice dónde estás, y el menú también.
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
      <header className="sticky top-0 z-20 flex h-12 items-center justify-between gap-5 border-b border-[var(--color-border)] bg-[var(--color-canvas)] px-5">
        <span className="flex min-w-0 items-baseline gap-2.5">
          {backTo ? (
            // Solo la flecha: el nombre accesible dice a dónde vuelve, y el `title` se lo dice a quien pasa el
            // mouse, como en `IconButton`.
            <Link
              to={backTo.to}
              aria-label={backTo.label}
              title={backTo.label}
              className="inline-flex size-6 shrink-0 translate-y-[3px] items-center justify-center rounded-[var(--radius-control)] text-[var(--color-content-muted)] transition-colors hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-content)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-500)]"
            >
              <ChevronLeftIcon className="size-3.5" />
            </Link>
          ) : null}
          <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--color-content)]">{title}</h1>
          {status ? <span className="flex shrink-0 items-center gap-2">{status}</span> : null}
        </span>
        {actions ? <span className="flex shrink-0 items-center gap-2">{actions}</span> : null}
      </header>

      <div className="px-5 py-4">{children}</div>
    </>
  );
}
