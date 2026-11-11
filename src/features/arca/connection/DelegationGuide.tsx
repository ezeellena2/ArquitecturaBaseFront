import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/ui/badge";
import { IconButton } from "@/shared/ui/IconButton";
import { CheckIcon, CopyIcon, DocumentIcon, LinkIcon, ShieldIcon } from "@/shared/ui/icons";
import { notify } from "@/shared/ui/notifications";
import { StepList, type Step } from "@/shared/ui/StepList";
import type { ArcaConnection } from "./api";
import type { ArcaFamilyGuideStep } from "./families";
import { delegationStepsOf, formatCuit, platformOf, type DelegationStep } from "./model";

export interface DelegationGuideProps {
  connection: ArcaConnection;
  /// El alias del certificado de la plataforma: el computador fiscal al que se asigna cada servicio.
  alias: string;
  /// Los pasos que las familias elegidas suman del lado de la empresa, como el punto de venta.
  familySteps?: readonly ArcaFamilyGuideStep[];
  /// Desde dónde seguir, cuando el robot de la etapa 6 se frenó en ese paso (RB3-A).
  startAt?: string | null;
  /// Los pasos que ya hizo el robot, con la marca `doneLabel`.
  done?: readonly string[];
  doneLabel?: string;
}

/// La guía de la delegación (DG2-A): lo que hace la empresa y lo que hace la plataforma, cada una con su clave fiscal, en
/// dos listas. La app no pide ninguna clave: cada uno hace sus pasos en ARCA. En homologación hay un solo paso, de la
/// plataforma, en WSASS. Cada paso tiene la clave estable que comparte con el robot.
export function DelegationGuide({ connection, alias, familySteps = [], startAt, done = [], doneLabel }: DelegationGuideProps) {
  const { t } = useTranslation("arca");
  const environment = connection.environment ?? "Production";
  const chosen = connection.installedServices.filter(service => connection.enabledServices.includes(service.code));
  const steps = delegationStepsOf(chosen, environment);
  const platform = platformOf(connection);
  const company = connection.cuit ? formatCuit(connection.cuit) : "";
  const name = (code: string) => t(`services.arcaNames.${code}`, { defaultValue: t(`services.names.${code}`, { defaultValue: code }) });

  async function copy(cuit: string) {
    try {
      await navigator.clipboard.writeText(cuit);
      notify({ id: "arca:copy", kind: "success", message: t("delegation.copied") });
    } catch {
      // Sin permiso para el portapapeles, la CUIT sigue escrita en el paso.
    }
  }

  function text(step: DelegationStep): ReactNode {
    const service = step.service ?? "";
    if (step.key.startsWith("company.delegate.")) return <span className="flex flex-wrap items-center gap-1">
      {t("delegation.delegate", { service: name(service), cuit: platform.cuit })}
      <IconButton label={t("delegation.copyCuit", { cuit: platform.cuit })} onClick={() => void copy(platform.cuit.replace(/-/g, ""))}><CopyIcon /></IconButton>
    </span>;
    if (step.key === "platform.accept") return t("delegation.accept", { cuit: company });
    if (environment === "Testing") return t("delegation.assignTesting", { alias, cuit: company, code: service });
    return t("delegation.assign", { service: name(service), alias });
  }

  function item(key: string, icon: ReactNode, content: ReactNode): Step {
    const isDone = done.includes(key);
    return {
      key,
      icon: isDone ? <CheckIcon /> : icon,
      content: <span data-guide-step={key} className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={isDone ? "text-[var(--color-content-muted)]" : undefined}>{content}</span>
        {isDone && doneLabel ? <Badge variant="outline">{doneLabel}</Badge> : null}
        {!isDone && startAt === key ? <Badge variant="warning">{t("delegation.current")}</Badge> : null}
      </span>,
    };
  }

  const companyItems = environment === "Testing" ? [] : [
    ...steps.company.map(step => item(step.key, <LinkIcon />, text(step))),
    ...familySteps.map(step => item(step.key, <DocumentIcon />, t(step.textKey))),
  ];
  const platformItems = steps.platform.map(step => item(step.key, step.key === "platform.accept" ? <CheckIcon /> : <ShieldIcon />, text(step)));

  return <div className="flex flex-col gap-4">
    {companyItems.length > 0 ? <section aria-label={t("delegation.company")} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("delegation.company")}</p>
      <StepList steps={companyItems} />
    </section> : null}
    {platformItems.length > 0 ? <section aria-label={t("delegation.platform", { platform: platform.name })} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("delegation.platform", { platform: platform.name })}</p>
      <StepList steps={platformItems} />
    </section> : null}
  </div>;
}
