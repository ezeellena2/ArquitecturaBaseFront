import { useId, type ReactNode } from "react";
import { ActionTooltip } from "./ActionTooltip";
import { Button } from "./button";
import { InfoIcon } from "./icons";

/// La (i) con su tooltip: la explicación que no hace falta leer siempre va acá y no en un renglón debajo o al costado
/// del control (decisión del usuario, 2026-10-31; tablero LC3). Junto a una etiqueta, al título de una superficie o de
/// una pantalla, o al final de una opción. El texto también queda como descripción accesible del botón; quien la pone
/// junto a un control le pasa `id` para que el control lo use en su `aria-describedby`.
export function InfoTip({ label, text, id }: { label: string; text: string; id?: string }): ReactNode {
  const generatedId = useId();
  const textId = id ?? generatedId;
  return (
    <ActionTooltip label={text}>
      <Button type="button" variant="ghost" size="icon-xs" aria-label={label} aria-describedby={textId} data-info-tip="" className="relative z-10">
        <InfoIcon className="size-3.5" />
        <span id={textId} hidden>{text}</span>
      </Button>
    </ActionTooltip>
  );
}
