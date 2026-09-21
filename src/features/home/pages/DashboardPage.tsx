import { useTranslation } from "react-i18next";
import { HomeIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";

/// `/` (sección 7.2): la pantalla de inicio. Va vacía a propósito: es el punto de partida de quien use la
/// plantilla, no un lugar para mostrar datos del perfil que nadie pidió.
export function DashboardPage() {
  const { t } = useTranslation();

  // Va vacía a propósito (ver el comentario de arriba): la banda alcanza para decir dónde estás.
  return (
    <Page icon={HomeIcon} title={t("home.title")}>
      <></>
    </Page>
  );
}
