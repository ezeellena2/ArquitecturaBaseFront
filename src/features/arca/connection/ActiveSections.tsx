import { useState } from "react";
import { useTranslation } from "react-i18next";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { Button } from "@/shared/ui/button";
import { DataList } from "@/shared/ui/DataList";
import { FormField } from "@/shared/ui/FormField";
import { DownloadIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { notify } from "@/shared/ui/notifications";
import { Surface } from "@/shared/ui/Surface";
import { Switch } from "@/shared/ui/switch";
import { ApiError } from "@/shared/api/ApiError";
import {
  cancelArcaRenewal, chooseArcaServices, downloadArcaRequest, startArcaCertificateRequest, testArcaConnection, uploadArcaCertificate,
  type ArcaConnection, type ArcaTest,
} from "./api";
import { CertificatePicker } from "./CertificatePicker";
import { DelegationGuide } from "./DelegationGuide";
import type { ArcaFamilyGuideStep } from "./families";
import { certificateOf, expiryOf, isDelegation, isValidAlias, platformOf } from "./model";
import { ServiceRows } from "./ServiceRows";
import { useArcaAction } from "./useArcaAction";
import { useArcaFormat } from "./useArcaFormat";

interface ActiveSectionsProps {
  connection: ArcaConnection;
  canManage: boolean;
  lastTest: ArcaTest | null;
  renewing: boolean;
  onRenewingChange: (renewing: boolean) => void;
  onChanged: (connection: ArcaConnection) => void;
  onTested: (test: ArcaTest) => void;
  onConflict: () => void;
  /// En delegación, si la guía se ve dentro de «Delegación» y los pasos que suman las familias elegidas.
  guideOpen?: boolean;
  onGuideOpenChange?: (open: boolean) => void;
  guideSteps?: readonly ArcaFamilyGuideStep[];
}

/// La conexión activa (AC2-A): los servicios con «Lo usa esta empresa» y la prueba, y el certificado con su renovación. En
/// delegación (DG3), «Delegación» con la plataforma en lugar de «Servicios», y el certificado de la plataforma.
export function ActiveSections(props: ActiveSectionsProps) {
  return <>
    <ServicesSection {...props} />
    <CertificateSection {...props} />
  </>;
}

function ServicesSection({ connection, canManage, lastTest, onChanged, onTested, onConflict, guideOpen = false, onGuideOpenChange, guideSteps }: ActiveSectionsProps) {
  const { t } = useTranslation("arca");
  const format = useArcaFormat();
  const action = useArcaAction(onConflict);
  const alias = certificateOf(connection, "Active")?.alias ?? "";
  const delegation = isDelegation(connection.mode);
  const platform = platformOf(connection);
  async function test() {
    const result = await action.run("test", testArcaConnection);
    if (result) onTested(result);
  }
  async function toggle(code: string, uses: boolean) {
    const services = uses ? [...connection.enabledServices, code] : connection.enabledServices.filter(item => item !== code);
    const result = await action.run(`toggle:${code}`, () => chooseArcaServices(services, connection.revision));
    if (!result) return;
    onChanged(result);
    // Un servicio nuevo se autoriza en ARCA antes de probarlo; en delegación, la empresa lo delega en la plataforma.
    const service = t(`services.names.${code}`, { defaultValue: code });
    const delegated = delegation && connection.installedServices.some(item => item.code === code && item.delegated);
    if (uses) notify({ id: "arca:service", kind: "info",
      message: delegated ? t("delegation.delegateService", { service, platform: platform.name }) : t("services.authorize", { service }) });
  }
  return <Surface title={t(delegation ? "delegation.title" : "services.title")} padded actions={<>
    {delegation ? <Button variant="link" onClick={() => onGuideOpenChange?.(!guideOpen)}>{t(guideOpen ? "delegation.hideGuide" : "delegation.showGuide")}</Button> : null}
    {connection.lastTestedAtUtc ? <span className="text-xs text-[var(--color-content-muted)]">
      {t("test.lastTested", { date: format.date(connection.lastTestedAtUtc), time: format.time(connection.lastTestedAtUtc) })}</span> : null}
    {canManage ? <Button variant="outline" pending={action.pending === "test"} disabled={action.pending !== null} onClick={() => void test()}>
      {t(action.pending === "test" ? "test.running" : "test.run")}</Button> : null}
  </>}>
    {delegation && guideOpen ? <DelegationGuide connection={connection} alias={alias} familySteps={guideSteps} /> : null}
    <ServiceRows services={connection.installedServices} checks={lastTest?.checks.filter(check => connection.enabledServices.includes(check.service))}
      tested={connection.lastTestedAtUtc !== null} alias={alias} delegation={delegation}
      before={delegation ? [{ key: "platform", label: t("delegation.platformRow"), value: `${platform.name} · ${platform.cuit}` }] : undefined}
      trailing={service => <span className="ml-auto inline-flex items-center gap-2 text-xs text-[var(--color-content-muted)]">
        <span aria-hidden="true">{t("services.usesLabel")}</span>
        <Switch checked={service.required || connection.enabledServices.includes(service.code)}
          disabled={!canManage || service.required || action.pending !== null}
          aria-label={t("services.uses", { service: t(`services.names.${service.code}`, { defaultValue: service.code }) })}
          onCheckedChange={checked => void toggle(service.code, checked)} />
      </span>} />
  </Surface>;
}

function CertificateSection({ connection, canManage, renewing, onRenewingChange, onChanged, onTested, onConflict }: ActiveSectionsProps) {
  const { t } = useTranslation("arca");
  const format = useArcaFormat();
  const action = useArcaAction(onConflict);
  const active = certificateOf(connection, "Active");
  const pending = certificateOf(connection, "Pending");
  const delegation = isDelegation(connection.mode);
  // En delegación conviene renovar con el mismo alias: las delegaciones siguen asignadas a él.
  const [alias, setAlias] = useState(delegation ? active?.alias ?? "" : "");
  const [aliasError, setAliasError] = useState<string>();
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const expired = expiryOf(active?.notAfterUtc, now) === "expired";

  async function request() {
    if (!isValidAlias(alias)) { setAliasError(t("data.aliasInvalid")); return; }
    setAliasError(undefined);
    const result = await action.run("renew", () => startArcaCertificateRequest({
      cuit: connection.cuit ?? "", environment: connection.environment ?? "Production", alias, services: connection.enabledServices, expectedRevision: connection.revision,
      mode: connection.mode ?? undefined,
    }));
    if (result) { onRenewingChange(false); setAlias(delegation ? alias : ""); onChanged(result); }
  }
  async function download() {
    const file = await action.run("download", downloadArcaRequest);
    if (file) savePrivateBlob(file.blob, file.fileName ?? `arca-${pending?.alias ?? "pedido"}.csr`);
  }
  async function upload(pem: string) {
    setCertificateError(null);
    const result = await action.run("upload", () => uploadArcaCertificate(pem, connection.revision), error => {
      if (!(error instanceof ApiError) || !error.code?.startsWith("Arca.Connection.Certificate")) return false;
      setCertificateError(error.detail ?? error.message);
      return true;
    });
    if (result) onTested(result);
  }
  async function cancel() {
    const result = await action.run("cancel", () => cancelArcaRenewal(connection.revision));
    if (result) onChanged(result);
  }

  const expiry = active?.notAfterUtc ? format.date(active.notAfterUtc) : "—";
  return <Surface title={t(delegation ? "certificate.platformTitle" : "certificate.title")} padded actions={canManage && !pending && !renewing
    ? <Button variant="outline" disabled={action.pending !== null} onClick={() => onRenewingChange(true)}>{t("certificate.renew")}</Button> : undefined}>
    {pending ? <>
      <DataList items={[
        { key: "current", label: t("certificate.current"), value: `${active?.alias ?? ""} · ${expiry}` },
        { key: "next", label: t("certificate.next"), value: `${pending.alias} · ${t(pending.isLoaded ? "certificate.pendingLoaded" : "certificate.pendingRequest")}` },
      ]} />
      {canManage ? <div className="flex flex-wrap items-start gap-2">
        <Button variant="outline" pending={action.pending === "download"} disabled={action.pending !== null} onClick={() => void download()}>
          <DownloadIcon className="size-4" />{t(action.pending === "download" ? "request.downloading" : "request.download")}</Button>
        <CertificatePicker label={t("certificate.upload")} pending={action.pending === "upload"} disabled={action.pending !== null} error={certificateError}
          primary onPick={pem => void upload(pem)} />
        <Button variant="muted-link" pending={action.pending === "cancel"} disabled={action.pending !== null} onClick={() => void cancel()}>
          {t(action.pending === "cancel" ? "certificate.cancelling" : "certificate.cancelRenewal")}</Button>
      </div> : null}
    </> : <DataList items={[
      { key: "alias", label: t("certificate.alias"), value: active?.alias ?? "—" },
      { key: "expires", label: t(expired ? "certificate.expired" : "certificate.expires"), value: expiry },
    ]} />}
    {renewing && !pending ? <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 sm:max-w-sm"><FormField label={t("certificate.renewAlias")} help={t(delegation ? "certificate.renewAliasHelp" : "data.aliasHelp")} error={aliasError} required>
        <Input value={alias} autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={30} disabled={action.pending !== null} onChange={event => setAlias(event.target.value)} />
      </FormField></div>
      <Button variant="outline" disabled={action.pending !== null} onClick={() => onRenewingChange(false)}>{t("data.cancel")}</Button>
      <Button pending={action.pending === "renew"} disabled={action.pending !== null} onClick={() => void request()}>
        {t(action.pending === "renew" ? "data.generating" : "certificate.renewGenerate")}</Button>
    </div> : null}
  </Surface>;
}
