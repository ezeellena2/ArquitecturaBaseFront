import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { DataList } from "@/shared/ui/DataList";
import type { ArcaCheck, ArcaInstalledService } from "./api";
import { useArcaFormat } from "./useArcaFormat";

interface ServiceRowsProps {
  services: readonly ArcaInstalledService[];
  /// Los resultados de la última prueba de esta visita.
  checks: readonly ArcaCheck[] | undefined;
  /// Si la conexión ya se probó alguna vez. El servidor guarda sólo el resultado general, y un servicio sumado después no
  /// se probó: sin la prueba de esta visita, el renglón queda sin estado, y dice «Sin probar» sólo si nunca hubo una.
  tested: boolean;
  alias: string;
  /// Lo que va al final de cada renglón, como «Lo usa esta empresa» con la conexión activa.
  trailing?: (service: ArcaInstalledService) => ReactNode;
}

/// Un renglón por servicio con lo que respondió en la prueba: si responde, hasta cuándo vale su ticket; si no, por qué.
export function ServiceRows({ services, checks, tested, alias, trailing }: ServiceRowsProps) {
  const { t } = useTranslation("arca");
  const format = useArcaFormat();
  function state(code: string) {
    const check = checks?.find(item => item.service === code);
    if (!check) return tested ? null : <span className="text-xs text-[var(--color-content-muted)]">{t("test.notTested")}</span>;
    if (check.status === "Ready") return <>
      <Badge variant="success">{t("checks.Ready")}</Badge>
      {check.ticketExpiresAtUtc ? <span className="text-xs text-[var(--color-content-muted)]">{t("checks.ticket", { time: format.time(check.ticketExpiresAtUtc) })}</span> : null}
    </>;
    const text = check.status === "NotAuthorized" ? t("checks.NotAuthorized", { alias })
      : check.status === "Blocked" && check.retryAfterUtc ? t("checks.Blocked", { time: format.time(check.retryAfterUtc) })
      : t(`checks.${check.status}`);
    return <Badge variant="danger">{text}</Badge>;
  }
  return <DataList items={services.map(service => ({
    key: service.code,
    label: t(`services.names.${service.code}`, { defaultValue: service.code }),
    value: <span className="flex w-full flex-wrap items-center gap-2">{state(service.code)}{trailing?.(service)}</span>,
  }))} />;
}
