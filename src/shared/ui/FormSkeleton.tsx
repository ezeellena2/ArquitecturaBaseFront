import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Skeleton } from "./skeleton";
import { Surface } from "./Surface";

/// Una zona del formulario que viene: `fields` son pares de etiqueta y control, en dos columnas; `rows`, bloques
/// de una fila alta (una elección, una lista).
export interface FormSkeletonZone {
  fields?: number;
  rows?: number;
}

/// Lo que se ve mientras llegan los ajustes de una pantalla de formulario (tablero ES3): las zonas con las barras de
/// sus campos, en el alto del formulario que viene, para que no salte al llegar. Cada pantalla pasa las zonas de
/// su formulario; los botones de la banda no se dibujan, porque la banda mide lo mismo con o sin ellos.
export function FormSkeleton({ zones }: { zones: readonly FormSkeletonZone[] }): ReactNode {
  const { t } = useTranslation();
  return (
    <div role="status" aria-label={t("states.loading")} className="flex flex-col gap-4">
      {zones.map((zone, index) => (
        <Surface key={index} padded>
          <Skeleton aria-hidden="true" className="h-4 w-2/5" />
          {zone.fields ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: zone.fields }, (_, field) => (
                <div key={field} className="flex flex-col gap-2">
                  <Skeleton aria-hidden="true" className="h-3 w-1/3" />
                  <Skeleton aria-hidden="true" className="h-7.5" />
                </div>
              ))}
            </div>
          ) : null}
          {Array.from({ length: zone.rows ?? 0 }, (_, row) => (
            <Skeleton key={row} aria-hidden="true" className="h-11" />
          ))}
        </Surface>
      ))}
    </div>
  );
}
