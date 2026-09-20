import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { changeLanguage, supportedLanguages } from "@/shared/i18n";

/// Chrome común del flujo de ingreso (sección 5.2): marca arriba, tarjeta centrada con la pantalla activa
/// adentro (`Outlet`) y, afuera de la tarjeta, el cambio de idioma.
export function AuthLayout() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--color-surface-muted)] px-4 py-10">
      <div className="flex items-center gap-2">
        {/* Cuadrado de marca: placeholder hasta que haya un logo real. */}
        <span aria-hidden="true" className="size-8 rounded-lg bg-[var(--color-brand-600)]" />
        <span className="text-lg font-semibold text-[var(--color-content)]">{t("app.name")}</span>
      </div>

      <div className="w-full max-w-[28rem] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm sm:p-8">
        <Outlet />
      </div>

      <div className="flex items-center gap-2 text-sm text-[var(--color-content-muted)]">
        <span>{t("language.label")}:</span>
        {supportedLanguages.map((language) => (
          <button
            key={language}
            type="button"
            aria-pressed={i18n.language === language}
            onClick={() => void changeLanguage(language)}
            className={
              i18n.language === language
                ? "font-semibold text-[var(--color-content)] underline"
                : "hover:text-[var(--color-content)] hover:underline"
            }
          >
            {t(`language.${language}`)}
          </button>
        ))}
      </div>
    </div>
  );
}
