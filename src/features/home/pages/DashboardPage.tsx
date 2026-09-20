import { useTranslation } from "react-i18next";

// Página mínima: el layout y el contenido real del tablero llegan en tareas posteriores.
export function DashboardPage() {
  const { t } = useTranslation();

  return <h1>{t("home.title")}</h1>;
}
