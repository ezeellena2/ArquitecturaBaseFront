import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { Button } from "@/shared/ui/button";

// Página mínima: la muestra el router cuando ninguna ruta conocida coincide. En lugar de una instrucción, la salida:
// volver al inicio, un enlace con aspecto de botón.
export function NotFoundPage() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-start gap-4 p-5">
      <h1>{t("errors.notFound.title")}</h1>
      <Button asChild>
        <Link to="/">{t("errors.notFound.home")}</Link>
      </Button>
    </div>
  );
}
