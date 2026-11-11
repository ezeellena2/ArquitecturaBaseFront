import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { InfoTip } from "./InfoTip";
import { Label } from "./label";

/// El título de un grupo de opciones o de casillas, con su (i) (lista de chequeo, 2026-11-09): del nivel de letra de un
/// rótulo, no de un título de zona. Quien arma el grupo lo nombra con este título (`aria-labelledby` con su `id`), así
/// el grupo se llama como lo que se ve: «Columnas» del Excel, los dos grupos de «Nuevo catálogo».
export function GroupLabel({ id, children, help }: { id: string; children: string; help?: string }): ReactNode {
  const { t } = useTranslation();
  const title = <Label asChild><span id={id}>{children}</span></Label>;
  if (!help) return title;
  return (
    <div className="flex items-center gap-1">
      {title}
      {/* La (i) no agranda el renglón del título, como junto a la etiqueta de un campo. */}
      <span className="-my-1 inline-flex"><InfoTip text={help} label={t("actions.moreInfo", { label: children })} /></span>
    </div>
  );
}
