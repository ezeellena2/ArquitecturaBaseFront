import { useTranslation } from "react-i18next";

// Estado compartido de falta de permiso, usado por la ruta y las áreas que reciben un 403.
export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("errors.forbidden.title")}</h1>
      <p>{t("errors.forbidden.description")}</p>
    </div>
  );
}
