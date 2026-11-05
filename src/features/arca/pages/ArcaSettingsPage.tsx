import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState, type ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { Navigate } from "react-router";
import { usePermissions } from "@/auth/usePermissions";
import { ApiError } from "@/shared/api/ApiError";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Page } from "@/shared/ui/Page";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { ActiveSections } from "../connection/ActiveSections";
import { arcaConnectionQueryKey, arcaQueryKey, fetchArcaConnection, type ArcaConnection, type ArcaTest } from "../connection/api";
import { DisconnectDialog } from "../connection/DisconnectDialog";
import type { ArcaFamilyActiveProps, ArcaFamilySetupProps } from "../connection/families";
import { certificateOf, expiryOf, phaseOf } from "../connection/model";
import { SetupZones } from "../connection/SetupZones";
import { useArcaAction } from "../connection/useArcaAction";
import { useArcaFormat } from "../connection/useArcaFormat";
import { PointOfSaleSection, PointOfSaleZone } from "../invoicing/PointOfSaleZone";
import { CompanySection } from "../registry/CompanySection";

/// Las familias que suman una zona propia, por su nombre en el servidor: quitar una es borrar su carpeta y su línea.
const familyZones: Record<string, { Setup: ComponentType<ArcaFamilySetupProps>; Active: ComponentType<ArcaFamilyActiveProps> }> = {
  Invoicing: { Setup: PointOfSaleZone, Active: PointOfSaleSection },
};

/// La conexión con ARCA en una sola pantalla: sin conexión, el alta por zonas (AC1-A) o la conexión activa (AC2-A).
/// Nada vive en la URL.
export function ArcaSettingsPage() {
  const { t } = useTranslation("arca");
  const permissions = usePermissions();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: arcaConnectionQueryKey, queryFn: ({ signal }) => fetchArcaConnection(signal), refetchOnMount: "always", retry: false });
  const canManage = permissions.has("arca.manage");
  const [starting, setStarting] = useState(false);
  const [lastTest, setLastTest] = useState<ArcaTest | null>(null);
  const [conflict, setConflict] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [renewing, setRenewing] = useState(false);
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

  if (query.error instanceof ApiError && query.error.status === 403) return <Navigate to="/sin-permiso" replace />;
  if (query.isPending) return <Page title={t("title")}><div className="flex flex-col gap-5">
    {[0, 1].map(item => <Surface key={item} padded><Skeleton className="h-4 w-3/5" /><Skeleton className="h-4 w-2/5" /></Surface>)}
  </div></Page>;
  if (query.isError) return <Page title={t("title")}>
    <EmptyState title={t("unavailable")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} />
  </Page>;

  const connection = query.data;
  const phase = phaseOf(connection);
  const active = certificateOf(connection, "Active");
  const expiry = expiryOf(active?.notAfterUtc, now);
  const families = [...new Set(connection.installedServices.filter(service => connection.enabledServices.includes(service.code)).map(service => service.family))]
    .filter(family => family in familyZones);
  const canActivate = connection.lastTestPassed === true && families.length > 0 && families.every(family => !!completions[family]);

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
    : phase === "active" ? <Button variant="destructive-outline" onClick={() => setDisconnecting(true)}>{t("disconnect.action")}</Button>
    : connection.status === "Unverified" && families.length > 0 ? <Button pending={action.pending === "activate"} disabled={!canActivate || action.pending !== null} onClick={() => void activate()}>
      {t(action.pending === "activate" ? "activating" : "activate")}</Button>
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
        onChanged={changed} onTested={tested} onConflict={openConflict} testDetail={<CompanySection cuit={connection.cuit} embedded />}>
        {families.map((family, index) => {
          const Zone = familyZones[family].Setup;
          return <Zone key={family} step={5 + index} connection={connection} canManage={canManage} open={connection.lastTestPassed === true} onReady={readyHandlers[family]} />;
        })}
      </SetupZones> : null}
      {phase === "active" ? <>
        {expiry !== "valid" && active?.notAfterUtc ? <Banner tone={expiry === "expired" ? "danger" : "warning"}
          action={canManage && !certificateOf(connection, "Pending") ? <Button variant="outline" onClick={() => setRenewing(true)}>{t("certificate.renew")}</Button> : undefined}>
          {t(expiry === "expired" ? "certificate.expiredBanner" : "certificate.soon", { date: format.date(active.notAfterUtc) })}
        </Banner> : null}
        <CompanySection cuit={connection.cuit} />
        <ActiveSections connection={connection} canManage={canManage} lastTest={lastTest} renewing={renewing} onRenewingChange={setRenewing}
          onChanged={changed} onTested={tested} onConflict={openConflict} />
        {families.map(family => {
          const Section = familyZones[family].Active;
          return <Section key={family} connection={connection} canManage={canManage} onConflict={openConflict} />;
        })}
      </> : null}
    </div>
    <DisconnectDialog open={disconnecting} onOpenChange={setDisconnecting} revision={connection.revision} onConflict={openConflict}
      onDisconnected={() => { setLastTest(null); setStarting(false); void queryClient.invalidateQueries({ queryKey: arcaQueryKey }); }} />
  </Page>;
}
