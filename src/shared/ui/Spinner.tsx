import { useTranslation } from "react-i18next";

const ringClassName =
  "inline-block size-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand-500)]";

/// Indicador de carga con nombre accesible. El texto sale de common.json.
///
/// `decorative` es para el que vive adentro de una región que ya dice qué está pasando (un `role="status"` con su
/// propio texto, como "Iniciando sesión…"): queda solo el aro, oculto al lector de pantalla. Si no, se anunciarían
/// dos estados a la vez, y uno de los dos sería el "Cargando…" genérico.
export function Spinner({ className, decorative = false }: { className?: string; decorative?: boolean }) {
  const { t } = useTranslation();

  if (decorative) {
    return (
      <span aria-hidden="true" className={className}>
        <span className={ringClassName} />
      </span>
    );
  }

  return (
    <span role="status" aria-live="polite" className={className}>
      <span aria-hidden="true" className={ringClassName} />
      <span className="sr-only">{t("states.loading")}</span>
    </span>
  );
}
