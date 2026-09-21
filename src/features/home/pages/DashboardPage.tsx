import { useTranslation } from "react-i18next";
import { PageHeader } from "@/shared/ui/PageHeader";

/// `/` (sección 7.2): la pantalla de inicio. Va vacía a propósito: es el punto de partida de quien use la
/// plantilla, no un lugar para mostrar datos del perfil que nadie pidió.
export function DashboardPage() {
  const { t } = useTranslation();

  return <PageHeader title={t("home.title")} />;
}
