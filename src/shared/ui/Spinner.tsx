import { useTranslation } from "react-i18next";

/// Indicador de carga con nombre accesible. El texto sale de common.json.
export function Spinner({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <span role="status" aria-live="polite" className={className}>
      <span
        aria-hidden="true"
        className="inline-block size-5 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-brand-500)]"
      />
      <span className="sr-only">{t("states.loading")}</span>
    </span>
  );
}
