import { useTranslation } from "react-i18next";

// Página mínima: la muestra el router cuando ninguna ruta conocida coincide.
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("errors.notFound.title")}</h1>
      <p>{t("errors.notFound.description")}</p>
    </div>
  );
}
