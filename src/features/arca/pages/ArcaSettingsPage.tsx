import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useRef, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { ActionsMenu } from "@/shared/ui/ActionsMenu";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { ActiveSections } from "../connection/ActiveSections";
import { arcaConnectionQueryKey, arcaQueryKey, fetchArcaConnection, type ArcaConnection, type ArcaTest } from "../connection/api";
import { DisconnectDialog } from "../connection/DisconnectDialog";
import type { ArcaFamilyActiveProps, ArcaFamilyGuideStep, ArcaFamilySetupProps } from "../connection/families";
import { certificateOf, expiryOf, isDelegation, phaseOf, platformOf } from "../connection/model";
import { SetupZones } from "../connection/SetupZones";
import { useArcaAction } from "../connection/useArcaAction";
import { useArcaFormat } from "../connection/useArcaFormat";
import { pointOfSaleGuideStep } from "../invoicing/guide";
import { PointOfSaleZone } from "../invoicing/PointOfSaleZone";
import { InvoicingSections } from "../invoicing/VoucherDataSection";
import { CompanySection } from "../registry/CompanySection";

/// Las familias que suman una zona propia, por su nombre en el servidor, los pasos que suman a la guía de la delegación y
/// el motivo de «Activar la conexión» apagado mientras les falta lo suyo (MA1-A): quitar una es borrar su carpeta y su línea.
const familyZones: Record<string, {
  Setup: ComponentType<ArcaFamilySetupProps>; Active: ComponentType<ArcaFamilyActiveProps>; guideSteps?: readonly ArcaFamilyGuideStep[];
  missing: string;
}> = {
  Invoicing: { Setup: PointOfSaleZone, Active: InvoicingSections, guideSteps: [pointOfSaleGuideStep], missing: "invoicing.missing" },
};

/// La conexión con ARCA en una sola pantalla: sin conexión, el alta por zonas (AC1-A) o la conexión activa (AC2-A).
/// Nada vive en la URL.
export function ArcaSettingsPage() {
  const { t, i18n } = useTranslation("arca");
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: arcaConnectionQueryKey, queryFn: ({ signal }) => fetchArcaConnection(signal), refetchOnMount: "always", retry: false });
  const canManage = permissions.has("arca.manage");
  const [starting, setStarting] = useState(false);
  const [lastTest, setLastTest] = useState<ArcaTest | null>(null);
  const [conflict, setConflict] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  // AC1-A: «Desconectar» is in ⋮; closing its confirmation gives the focus back there.
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  const [completions, setCompletions] = useState<Record<string, (() => Promise<void>) | null>>({});
  // Los avisos de vencimiento se calculan con la hora en que se abrió la pantalla.
  const [now] = useState(() => Date.now());
  const openConflict = useCallback(() => setConflict(true), []);
  const action = useArcaAction(openConflict);
  const format = useArcaFormat();

  // Las familias leen de la misma conexión: cualquier cambio las vuelve a pedir.
  function changed(connection: ArcaConnection) {
    queryClient.setQueryData(arcaConnectionQueryKey, connection);
    void queryClient.invalidateQueries({ queryKey: arcaQueryKey, predicate: item => item.queryKey[1] !== "connection" });
  }
  function tested(test: ArcaTest) { setLastTest(test); changed(test.connection); }
  // Un manejador estable por familia: la zona lo llama cuando cambia lo que eligió.
  const readyHandlers = useMemo(() => Object.fromEntries(Object.keys(familyZones).map(family => [family,
    (complete: (() => Promise<void>) | null) => setCompletions(previous => previous[family] === complete ? previous : { ...previous, [family]: complete })])), []);
  async function readCurrent() {
    await action.run("read", () => queryClient.invalidateQueries({ queryKey: arcaQueryKey }));
    setConflict(false);
  }

  if (query.error instanceof ApiError && query.error.status === 403) return <ForbiddenPage title={t("title")} />;
  if (query.isPending) return <Page title={t("title")}><div className="flex flex-col gap-5">
    {[0, 1].map(item => <Surface key={item} padded><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/5" /></Surface>)}
  </div></Page>;
  if (query.isError) return <Page title={t("title")}>
    <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />
  </Page>;

  const connection = query.data;
  const phase = phaseOf(connection);
  const active = certificateOf(connection, "Active");
  const expiry = expiryOf(active?.notAfterUtc, now, connection.certificateNoticeDays);
  const families = [...new Set(connection.installedServices.filter(service => connection.enabledServices.includes(service.code)).map(service => service.family))]
    .filter(family => family in familyZones);
  const canActivate = connection.lastTestPassed === true && families.length > 0 && families.every(family => !!completions[family]);
  // MA1-A: por qué sigue apagado, en el orden del alta; mientras trabaja, sin motivo.
  const missing = families.find(family => !completions[family]);
  const activateReason = canActivate || action.pending !== null ? null
    : connection.lastTestPassed === null ? t("activateReason.notTested")
    : connection.lastTestPassed === false ? t("activateReason.failed")
    : missing ? t(familyZones[missing].missing) : null;
  const delegation = isDelegation(connection.mode);
  const guideSteps = families.flatMap(family => familyZones[family].guideSteps ?? []);
  // En delegación, la prueba de esta visita dice si la empresa revocó un servicio: el servidor guarda sólo el resultado general.
  const revoked = delegation && phase === "active"
    ? connection.installedServices.filter(service => lastTest?.checks.some(check => check.service === service.code && check.status === "NotDelegated")) : [];

  async function activate() {
    const done = await action.run("activate", async () => {
      for (const family of families) await completions[family]?.();
      return true;
    });
    if (done) await queryClient.invalidateQueries({ queryKey: arcaQueryKey });
  }

  const status = phase === "empty" && !canManage ? <span className="text-xs text-[var(--color-content-muted)]">{t("readOnly")}</span> : <span className="flex flex-wrap items-center gap-2">
    <Badge variant={connection.status === "Active" ? "success" : connection.status === "NeedsAttention" ? expiry === "expired" ? "danger" : "warning" : "outline"}>
      {t(`status.${connection.status ?? "none"}`)}</Badge>
    {connection.environment ? <Badge variant="outline">{t(`environment.${connection.environment}`)}</Badge> : null}
    {phase !== "empty" && !canManage ? <span className="text-xs text-[var(--color-content-muted)]">{t("readOnly")}</span> : null}
  </span>;
  const actions = !canManage ? undefined
    : phase === "active" ? <ActionsMenu label={t("connectionActions")} triggerRef={actionsTrigger}
      items={[{ label: t("disconnect.action"), destructive: true, onSelect: () => setDisconnecting(true) }]} />
    : connection.status === "Unverified" && families.length > 0 ? <DisabledReason reason={activateReason}>
      <Button pending={action.pending === "activate"} disabled={!canActivate || action.pending !== null} onClick={() => void activate()}>
        {t(action.pending === "activate" ? "activating" : "activate")}</Button></DisabledReason>
    : undefined;

  return <Page title={t("title")} status={status} actions={actions}>
    <div className="flex flex-col gap-5">
      {conflict ? <Surface title={t("conflict.title")} padded actions={<Button pending={action.pending === "read"} disabled={action.pending !== null}
        onClick={() => void readCurrent()}>{t(action.pending === "read" ? "conflict.reading" : "conflict.read")}</Button>}>
        <p className="text-sm">{t("conflict.text")}</p>
      </Surface> : null}
      {phase === "empty" && !starting ? <EmptyState title={t("empty.title")}
        action={canManage ? <Button onClick={() => setStarting(true)}>{t("empty.connect")}</Button> : undefined} /> : null}
      {phase === "setup" || (phase === "empty" && starting) ? <SetupZones connection={connection} canManage={canManage} lastTest={lastTest}
        onChanged={changed} onTested={tested} onConflict={openConflict} testDetail={<CompanySection cuit={connection.cuit} embedded />} guideSteps={guideSteps}>
        {families.map((family, index) => {
          const Zone = familyZones[family].Setup;
          // En la delegación automática hay tres zonas antes de las familias: el robot hace el pedido y el certificado.
          return <Zone key={family} step={(connection.mode === "PlatformDelegationAutomated" ? 4 : 5) + index} connection={connection} canManage={canManage} open={connection.lastTestPassed === true} onReady={readyHandlers[family]} />;
        })}
      </SetupZones> : null}
      {phase === "active" ? <>
        {expiry !== "valid" && active?.notAfterUtc ? <Banner tone={expiry === "expired" ? "danger" : "warning"}
          action={canManage && !certificateOf(connection, "Pending") ? <Button variant="outline" onClick={() => setRenewing(true)}>{t("certificate.renew")}</Button> : undefined}>
          {t(expiry === "expired" ? "certificate.expiredBanner" : "certificate.soon", { date: format.date(active.notAfterUtc) })}
        </Banner> : null}
        {revoked.length > 0 ? <Banner tone="danger" action={guideOpen ? undefined : <Button variant="outline" onClick={() => setGuideOpen(true)}>{t("delegation.showGuide")}</Button>}>
          {t("delegation.revoked", {
            services: new Intl.ListFormat(i18n.language, { type: "conjunction" }).format(revoked.map(service => t(`services.names.${service.code}`, { defaultValue: service.code }))),
            platform: platformOf(connection).name,
          })}
        </Banner> : null}
        <CompanySection cuit={connection.cuit} />
        <ActiveSections connection={connection} canManage={canManage} lastTest={lastTest} renewing={renewing} onRenewingChange={setRenewing}
          onChanged={changed} onTested={tested} onConflict={openConflict} guideOpen={guideOpen} onGuideOpenChange={setGuideOpen} guideSteps={guideSteps} />
        {families.map(family => {
          const Section = familyZones[family].Active;
          return <Section key={family} connection={connection} canManage={canManage} onConflict={openConflict} />;
        })}
      </> : null}
    </div>
    <DisconnectDialog open={disconnecting} onOpenChange={setDisconnecting} revision={connection.revision} onConflict={openConflict} focusFallback={actionsTrigger}
      onDisconnected={() => { setLastTest(null); setStarting(false); void queryClient.invalidateQueries({ queryKey: arcaQueryKey }); }} />
  </Page>;
}
