import { useTranslation } from "react-i18next";

// Página mínima: la lleva ProtectedRoute cuando la sesión no tiene el permiso pedido.
export function ForbiddenPage() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t("errors.forbidden.title")}</h1>
      <p>{t("errors.forbidden.description")}</p>
    </div>
  );
}
