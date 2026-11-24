import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";

// La muestra el router cuando ninguna ruta coincide. Con sesión se ve adentro del caparazón (SP1-B, 2026-11-24), con la
// forma del error de una ruta: no hay pantalla que nombrar en la banda, así que el título dice que no está y debajo va la
// salida, un enlace con aspecto de botón.
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <Page title={t("errors.notFound.title")}>
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <Button asChild>
          <Link to="/">{t("actions.backHome")}</Link>
        </Button>
      </div>
    </Page>
  );
}
