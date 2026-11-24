import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router";
import { Button } from "./button";
import { EmptyState } from "./EmptyState";
import { Page } from "./Page";

/// La falta de permiso de una pantalla (SP1-B, 2026-11-24). Queda adentro del caparazón y con la dirección de la pantalla:
/// la banda lleva el nombre de la que se quiso abrir y, adentro, el vacío estándar con una sola salida, como el error de
/// Inicio. Una pantalla hija conserva su `backTo`. En Inicio la salida no va: ya está ahí. Es sólo para pantallas; un
/// panel, un filtro o un diálogo que recibe un 403 contesta en su lugar con `EmptyState embedded` (SP2).
export function ForbiddenPage({ title, backTo }: { title: string; backTo?: { to: string; label: string } }) {
  const { t } = useTranslation();
  const home = useLocation().pathname === "/";

  return (
    <Page title={title} backTo={backTo}>
      <EmptyState
        title={t("errors.forbidden.title")}
        action={home ? undefined : <Button asChild variant="outline"><Link to="/">{t("actions.backHome")}</Link></Button>}
      />
    </Page>
  );
}
