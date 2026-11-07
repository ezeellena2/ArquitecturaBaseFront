import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Page } from "./Page";
import { Skeleton } from "./skeleton";
import { Surface } from "./Surface";

/// Lo que se ve al cambiar de pantalla mientras llega su módulo (tablero ES2): la banda de `Page` con su alto y su
/// borde, el título como un bloque de carga y una zona con barras en el cuerpo. No conoce el título ni la forma
/// de la pantalla que viene, por eso es genérico: acierta en la banda y los márgenes, y la pantalla, al llegar,
/// completa el resto (o dibuja su propio esqueleto, como Perfil o el editor de rol).
export function PageLoading(): ReactNode {
  const { t } = useTranslation();
  return (
    <Page title={t("states.loading")} loading>
      <div role="status" aria-label={t("states.loading")}>
        <Surface padded>
          <Skeleton aria-hidden="true" className="h-3.5 w-1/3" />
          <Skeleton aria-hidden="true" className="h-3.5 w-5/6" />
          <Skeleton aria-hidden="true" className="h-3.5 w-3/5" />
        </Surface>
      </div>
    </Page>
  );
}
