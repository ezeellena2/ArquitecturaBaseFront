import { useTranslation } from "react-i18next";
import { Outlet } from "react-router";
import { changeLanguage, supportedLanguages } from "@/shared/i18n";

/// Chrome común del flujo de ingreso (sección 5.2): marca arriba, tarjeta centrada con la pantalla activa
/// adentro (`Outlet`) y, afuera de la tarjeta, el cambio de idioma.
export function AuthLayout() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-[var(--color-canvas)] px-4 py-10">
      {/* La marca es el nombre escrito, como en el menú: un cuadrado de color es el placeholder que pone
          cualquier maqueta, y acá arriba de la tarjeta es lo único que hay. */}
      <span className="text-lg tracking-[-0.02em]">
        <span className="font-bold text-[var(--color-content)]">Arquitectura</span>
        <span className="text-[var(--color-content-muted)]">Base</span>
      </span>

      <div className="w-full max-w-[28rem] rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 sm:p-7">
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
