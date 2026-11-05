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
import { certificateOf, expiryOf, isValidAlias } from "./model";
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
}

/// La conexión activa (AC2-A): los servicios con «Lo usa esta empresa» y la prueba, y el certificado con su renovación.
export function ActiveSections(props: ActiveSectionsProps) {
  return <>
    <ServicesSection {...props} />
    <CertificateSection {...props} />
  </>;
}

function ServicesSection({ connection, canManage, lastTest, onChanged, onTested, onConflict }: ActiveSectionsProps) {
  const { t } = useTranslation("arca");
  const format = useArcaFormat();
  const action = useArcaAction(onConflict);
  const alias = certificateOf(connection, "Active")?.alias ?? "";
  async function test() {
    const result = await action.run("test", testArcaConnection);
    if (result) onTested(result);
  }
  async function toggle(code: string, uses: boolean) {
    const services = uses ? [...connection.enabledServices, code] : connection.enabledServices.filter(item => item !== code);
    const result = await action.run(`toggle:${code}`, () => chooseArcaServices(services, connection.revision));
    if (!result) return;
    onChanged(result);
    // Un servicio nuevo se autoriza en ARCA antes de probarlo.
    if (uses) notify({ id: "arca:service", kind: "info", message: t("services.authorize", { service: t(`services.names.${code}`, { defaultValue: code }) }) });
  }
  return <Surface title={t("services.title")} padded actions={<>
    {connection.lastTestedAtUtc ? <span className="text-xs text-[var(--color-content-muted)]">
      {t("test.lastTested", { date: format.date(connection.lastTestedAtUtc), time: format.time(connection.lastTestedAtUtc) })}</span> : null}
    {canManage ? <Button variant="outline" pending={action.pending === "test"} disabled={action.pending !== null} onClick={() => void test()}>
      {t(action.pending === "test" ? "test.running" : "test.run")}</Button> : null}
  </>}>
    <ServiceRows services={connection.installedServices} checks={lastTest?.checks.filter(check => connection.enabledServices.includes(check.service))}
      tested={connection.lastTestedAtUtc !== null} alias={alias}
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
  const [alias, setAlias] = useState("");
  const [aliasError, setAliasError] = useState<string>();
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const expired = expiryOf(active?.notAfterUtc, now) === "expired";

  async function request() {
    if (!isValidAlias(alias)) { setAliasError(t("data.aliasInvalid")); return; }
    setAliasError(undefined);
    const result = await action.run("renew", () => startArcaCertificateRequest({
      cuit: connection.cuit ?? "", environment: connection.environment ?? "Production", alias, services: connection.enabledServices, expectedRevision: connection.revision,
    }));
    if (result) { onRenewingChange(false); setAlias(""); onChanged(result); }
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
  return <Surface title={t("certificate.title")} padded actions={canManage && !pending && !renewing
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
      <div className="min-w-0 flex-1 sm:max-w-sm"><FormField label={t("certificate.renewAlias")} help={t("data.aliasHelp")} error={aliasError} required>
        <Input value={alias} autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={30} disabled={action.pending !== null} onChange={event => setAlias(event.target.value)} />
      </FormField></div>
      <Button variant="outline" disabled={action.pending !== null} onClick={() => onRenewingChange(false)}>{t("data.cancel")}</Button>
      <Button pending={action.pending === "renew"} disabled={action.pending !== null} onClick={() => void request()}>
        {t(action.pending === "renew" ? "data.generating" : "certificate.renewGenerate")}</Button>
    </div> : null}
  </Surface>;
}
