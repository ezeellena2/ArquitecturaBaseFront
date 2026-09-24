import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { HomeIcon } from "@/shared/ui/icons";
import { Page } from "@/shared/ui/Page";

/// `/` (sección 7.2): la pantalla de inicio. Va vacía a propósito: es el punto de partida de quien use la
/// plantilla, no un lugar para mostrar datos del perfil que nadie pidió.
///
/// La única excepción es una cuenta sin correo (creada desde WhatsApp): mientras no lo tenga, un aviso le pide que
/// lo agregue, porque sin él cambiar de número es perder la cuenta. Lleva a Mi perfil, donde se agrega, y desaparece
/// solo cuando el perfil ya trae el correo (tablero "WhatsApp · Perfil: correo y WhatsApp", punto 2).
export function DashboardPage() {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();

  return (
    <Page icon={HomeIcon} title={t("home.title")}>
      {user && !user.email ? (
        <Banner
          action={
            <Button asChild variant="outline">
              <Link to="/perfil">{t("home.addEmail")}</Link>
            </Button>
          }
        >
          {t("home.addEmailNotice")}
        </Banner>
      ) : null}
    </Page>
  );
}
