import { useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Surface } from "@/shared/ui/Surface";
import type { ZoneState } from "./model";

interface ArcaZoneProps {
  step: number;
  title: string;
  state: ZoneState;
  /// Lo que se hizo en la zona, en la banda mientras está plegada.
  summary?: ReactNode;
  actions?: ReactNode;
  help?: string;
  children?: ReactNode;
}

/// Una zona del alta (AC1-A): abierta con su contenido, hecha y plegada con su resumen, o apagada hasta que le toque.
/// La que se abre recibe el foco en su título; al cargar la página no se lo roba a nadie.
export function ArcaZone({ step, title, state, summary, actions, help, children }: ArcaZoneProps) {
  const { t } = useTranslation("arca");
  const heading = useRef<HTMLHeadingElement>(null);
  const previous = useRef(state);
  useEffect(() => {
    if (state === "open" && previous.current !== "open") heading.current?.focus();
    previous.current = state;
  }, [state]);
  const label = t("zone", { step, title });
  if (state === "off") return <div aria-disabled="true" className="opacity-60"><Surface title={label}>{null}</Surface></div>;
  return <Surface title={label} titleRef={heading} padded={state === "open"} help={state === "open" ? help : undefined} actions={<>
    {state === "done" && summary ? <span className="text-xs text-[var(--color-content-muted)]">{summary}</span> : null}
    {actions}
  </>}>{state === "open" ? children : null}</Surface>;
}
