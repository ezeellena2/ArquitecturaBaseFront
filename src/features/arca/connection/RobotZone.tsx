import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { AlertTriangleIcon, CheckIcon, ClockIcon, RefreshIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Skeleton } from "@/shared/ui/skeleton";
import { StepList } from "@/shared/ui/StepList";
import { testArcaConnection, type ArcaConnection, type ArcaTest } from "./api";
import { ArcaZone } from "./ArcaZone";
import { formatCuit, normalizeCuit } from "./model";
import { arcaRobotQueryKey, robotPointOfSaleStep, startArcaRobotRun, useArcaRobotRun, type ArcaRobotSide } from "./robot";
import { companyStepsOf, guideFallbackOf, platformStepsOf, robotViewOf, stepsOf, type RobotStep } from "./robotSteps";
import { useArcaAction } from "./useArcaAction";
import { useArcaFormat } from "./useArcaFormat";

/// Dónde abre la guía de la etapa 5 cuando el robot se frena, y con qué marca lo que ya hizo.
export interface RobotGuideFallback { step: string | null; done: string[]; doneLabel: string }

export interface RobotZoneProps {
  step: number;
  /// Apagada mientras «Datos» está abierta, como cualquier zona que sigue (AC1-A).
  available?: boolean;
  connection: ArcaConnection;
  canManage: boolean;
  /// La plataforma configurada, en la que el cliente delega.
  platform: { name: string; cuit: string };
  /// Los servicios elegidos que la empresa delega, y las consultas que la plataforma autoriza con su CUIT.
  delegatedServices: string[];
  authorizedServices: string[];
  /// Los pasos del lado del cliente que aportan las familias elegidas (el punto de venta de Facturación).
  familySteps: string[];
  /// La guía de la etapa 5, abierta en el paso donde se frenó el robot (RB3-A).
  renderGuide: (fallback: RobotGuideFallback) => ReactNode;
  onTested: (test: ArcaTest) => void;
  onConflict: () => void;
}

/// La delegación automática en el alta (ADR 0026 del backend): la autorización y la clave en la zona (RB1-A), el avance de
/// los dos lados en pasos (RB2-A) y, si el robot se frena, la guía de la etapa 5 en ese paso (RB3-A).
export function RobotZone({ step, available = true, connection, canManage, platform, delegatedServices, authorizedServices, familySteps, renderGuide, onTested, onConflict }: RobotZoneProps) {
  const { t } = useTranslation(["arcaRobot", "arca"]);
  const queryClient = useQueryClient();
  const robot = useArcaRobotRun();
  const action = useArcaAction(onConflict);
  const format = useArcaFormat();
  const [retrying, setRetrying] = useState(false);
  const company = robot.data?.company ?? null;
  const platformSide = robot.data?.platform ?? null;
  const view = retrying || (!company && canManage) ? "form" : robotViewOf(company, platformSide);
  const pointOfSale = company?.outputs[robotPointOfSaleStep];
  const serviceName = (code: string) => t(`arca:services.names.${code}`, { defaultValue: code });
  /// El nombre de un paso: los de un servicio llevan su nombre; los de las familias, el suyo, o la clave si no hay texto.
  const stepLabel = (key: string) => {
    const [part, name, service] = key.split(".");
    if (service) return t(`steps.${part}.${name}`, { service: serviceName(service), platform: platform.name });
    return t(`steps.${key}`, { platform: platform.name, defaultValue: key });
  };

  async function check() {
    const test = await action.run("check", testArcaConnection);
    if (!test) return;
    onTested(test);
    await queryClient.invalidateQueries({ queryKey: arcaRobotQueryKey });
  }

  if (!available) return <ArcaZone step={step} title={t("title")} state="off" />;
  if (robot.isPending) return <ArcaZone step={step} title={t("title")} state="open"><Skeleton className="h-16" /></ArcaZone>;

  const badge = company?.state === "Running" ? <Badge variant="outline">{t("running")}</Badge>
    : view === "progress" && company?.state === "Succeeded" ? <Badge variant="warning">{t("waitingPlatform")}</Badge> : null;

  if (view === "form" && canManage) return <ArcaZone step={step} title={t("title")} state="open" help={t("consentHelp")}>
    <RobotForm connection={connection} platform={platform} services={delegatedServices.map(serviceName)}
      rejected={!retrying && company?.failure === "LoginRejected"} onConflict={onConflict}
      onStarted={run => { setRetrying(false); queryClient.setQueryData(arcaRobotQueryKey, run); }} />
  </ArcaZone>;

  if (view === "guide" && company) return <ArcaZone step={step} title={t("title")} state="open"
    actions={canManage ? <Button variant="outline" onClick={() => setRetrying(true)}>{t("retry")}</Button> : undefined}>
    <Banner tone="warning">{t(`stopped.${company.failure ?? "Interrupted"}`)}</Banner>
    {renderGuide({ ...guideFallbackOf(company), doneLabel: t("doneByRobot") })}
  </ArcaZone>;

  const done = view === "done";
  const companySteps = stepsOf(company, companyStepsOf(delegatedServices, familySteps));
  const platformSteps = stepsOf(platformSide, platformStepsOf(delegatedServices, authorizedServices));
  const platformStopped = company?.state === "Succeeded" && platformSide?.state === "Failed";
  const waiting = company?.state === "Succeeded" && !done;
  return <ArcaZone step={step} title={t("title")} state={done ? "done" : "open"}
    summary={pointOfSale ? t("summary", { pointOfSale: pointOfSale.padStart(4, "0") }) : t("summaryWithoutPoint")}
    actions={<>{badge}{waiting && canManage ? <Button variant="outline" pending={action.pending === "check"} disabled={action.pending !== null}
      onClick={() => void check()}>{t(action.pending === "check" ? "checking" : "check")}</Button> : null}</>}>
    {platformStopped ? <Banner tone="warning">{t("platformStopped")}</Banner> : null}
    <div className="grid gap-5 sm:grid-cols-2">
      <RobotSteps title={t("columns.company")} steps={companySteps} side={company} label={stepLabel} retryAt={format.time} />
      <RobotSteps title={t("columns.platform", { platform: platform.name })} steps={platformSteps} side={platformSide} label={stepLabel}
        retryAt={format.time} />
    </div>
  </ArcaZone>;
}

const stateIcons: Record<RobotStep["state"], ReactNode> = {
  done: <CheckIcon />, running: <RefreshIcon className="motion-safe:animate-spin" />, failed: <AlertTriangleIcon />, pending: <ClockIcon />,
};

/// Una columna del avance (RB2-A): cada paso con el ícono de su estado. Lo pendiente va en gris; si la plataforma espera
/// para reintentar, el paso dice cuándo.
function RobotSteps({ title, steps, side, label, retryAt }: {
  title: string; steps: RobotStep[]; side: ArcaRobotSide | null; label: (key: string) => string; retryAt: (valueUtc: string) => string;
}) {
  const { t } = useTranslation("arcaRobot");
  return <section aria-label={title} className="flex min-w-0 flex-col gap-2">
    <h4 className="text-sm font-medium text-[var(--color-content-muted)]">{title}</h4>
    <StepList steps={steps.map(item => ({
      key: item.key,
      icon: stateIcons[item.state],
      content: <span className={item.state === "pending" ? "text-[var(--color-content-muted)]" : item.state === "failed" ? "font-medium" : undefined}>
        <span className="sr-only">{t(`stepState.${item.state}`)}: </span>{label(item.key)}
        {item.state === "failed" && side?.state === "Waiting" && side.nextAttemptAtUtc
          ? <span className="block text-xs text-[var(--color-content-muted)]">{t("retryAt", { time: retryAt(side.nextAttemptAtUtc) })}</span> : null}
      </span>,
    }))} />
  </section>;
}

/// La autorización y la clave (RB1-A). La clave vive sólo en el campo: se vacía al enviar y no pasa a ningún otro estado.
function RobotForm({ connection, platform, services, rejected, onConflict, onStarted }: {
  connection: ArcaConnection; platform: { name: string; cuit: string }; services: string[]; rejected: boolean; onConflict: () => void;
  onStarted: (run: Awaited<ReturnType<typeof startArcaRobotRun>>) => void;
}) {
  const { t, i18n } = useTranslation("arcaRobot");
  const action = useArcaAction(onConflict);
  const [login, setLogin] = useState("");
  const [key, setKey] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<{ login?: string; key?: string }>({});
  const [serverRejected, setServerRejected] = useState(rejected);
  const serviceList = new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(services.map(service => `«${service}»`));

  async function start() {
    const normalized = normalizeCuit(login);
    const next = { login: normalized ? undefined : t("loginInvalid"), key: key.trim() ? undefined : t("keyMissing") };
    setErrors(next);
    if (!normalized || next.key) return;
    const typed = key;
    setKey("");
    setServerRejected(false);
    const run = await action.run("start", () => startArcaRobotRun({ consent, loginCuit: normalized, fiscalKey: typed, expectedRevision: connection.revision }),
      error => error instanceof ApiError && error.code === "Arca.Connection.CuitInvalid" ? (setErrors({ login: t("loginInvalid") }), true) : false);
    if (run) onStarted(run);
  }

  const starting = action.pending === "start";
  const reason = !consent ? t("consentMissing") : null;
  return <div className="flex flex-col gap-4">
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <FormField label={t("login")} help={t("loginHelp")} error={errors.login} required>
        <Input value={login} inputMode="numeric" autoComplete="off" maxLength={13} disabled={starting} onChange={event => setLogin(event.target.value)} />
      </FormField>
      <FormField label={t("key")} error={errors.key ?? (serverRejected ? t("loginRejected") : undefined)} required>
        <Input type="password" value={key} autoComplete="off" spellCheck={false} disabled={starting} onChange={event => setKey(event.target.value)} />
      </FormField>
    </div>
    <CheckboxField label={t("consent", { services: serviceList, platform: platform.name, cuit: formatCuit(platform.cuit) })} checked={consent}
      disabled={starting} onCheckedChange={setConsent} />
    <div>
      <DisabledReason reason={reason}>
        <Button pending={starting} disabled={!consent || starting} onClick={() => void start()}>{t(starting ? "starting" : "start")}</Button>
      </DisabledReason>
    </div>
  </div>;
}
