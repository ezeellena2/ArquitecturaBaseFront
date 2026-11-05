import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { FormField } from "@/shared/ui/FormField";
import { DocumentIcon, DownloadIcon, ExternalLinkIcon, ShieldIcon } from "@/shared/ui/icons";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Input } from "@/shared/ui/input";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { StepList } from "@/shared/ui/StepList";
import {
  chooseArcaServices, disconnectArca, downloadArcaRequest, startArcaCertificateRequest, testArcaConnection, uploadArcaCertificate,
  type ArcaConnection, type ArcaEnvironment, type ArcaTest,
} from "./api";
import { ArcaZone } from "./ArcaZone";
import { CertificatePicker } from "./CertificatePicker";
import { arcaPortal, certificateOf, formatCuit, isValidAlias, normalizeCuit, setupZonesOf } from "./model";
import { ServiceRows } from "./ServiceRows";
import { useArcaAction } from "./useArcaAction";
import { useArcaFormat } from "./useArcaFormat";

interface SetupZonesProps {
  connection: ArcaConnection;
  canManage: boolean;
  lastTest: ArcaTest | null;
  onChanged: (connection: ArcaConnection) => void;
  onTested: (test: ArcaTest) => void;
  onConflict: () => void;
  /// Los datos de la empresa que trae el padrón, debajo de los servicios de la prueba.
  testDetail?: ReactNode;
  /// Las zonas de las familias elegidas, numeradas desde el 5.
  children?: ReactNode;
}

/// Un certificado que no corresponde se dice junto a la carga, con el texto del servidor.
const isCertificateError = (error: unknown): error is ApiError =>
  error instanceof ApiError && !!error.code && (error.code.startsWith("Arca.Connection.Certificate") || error.code === "Arca.Connection.NoPendingRequest");

/// El alta por zonas (AC1-A): datos, pedido, certificado y prueba; después, la zona de cada familia elegida.
export function SetupZones({ connection, canManage, lastTest, onChanged, onTested, onConflict, testDetail, children }: SetupZonesProps) {
  const { t, i18n } = useTranslation("arca");
  const format = useArcaFormat();
  const action = useArcaAction(onConflict);
  const [editing, setEditing] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const zones = setupZonesOf(connection, editing);
  const pending = certificateOf(connection, "Pending");
  const active = certificateOf(connection, "Active");
  const alias = pending?.alias ?? active?.alias ?? "";
  const environment = connection.environment ?? "Production";
  const chosen = connection.installedServices.filter(service => connection.enabledServices.includes(service.code));
  const serviceNames = new Intl.ListFormat(i18n.language, { type: "conjunction" })
    .format(chosen.map(service => t(`services.names.${service.code}`, { defaultValue: service.code })));

  async function download() {
    const file = await action.run("download", downloadArcaRequest);
    if (file) savePrivateBlob(file.blob, file.fileName ?? `arca-${alias}.csr`);
  }

  async function upload(pem: string) {
    setCertificateError(null);
    const test = await action.run("upload", () => uploadArcaCertificate(pem, connection.revision), error => {
      if (!isCertificateError(error)) return false;
      setCertificateError(error.detail ?? error.message);
      return true;
    });
    if (test) onTested(test);
  }

  async function test() {
    const result = await action.run("test", testArcaConnection);
    if (result) onTested(result);
  }

  return <div className="flex flex-col gap-5">
    <DataZone connection={connection} state={zones.data} canManage={canManage} editing={editing} onEditingChange={setEditing}
      onChanged={next => { setEditing(false); onChanged(next); }} onConflict={onConflict}
      summary={connection.cuit ? t("data.summary", { cuit: formatCuit(connection.cuit), environment: t(`environment.${environment}`), alias }) : undefined} />
    <ArcaZone step={2} title={t("request.title")} state={zones.request} summary={t("request.summary", { alias })}
      actions={canManage && pending && !pending.isLoaded ? <Button variant="outline" pending={action.pending === "download"} disabled={action.pending !== null}
        onClick={() => void download()}><DownloadIcon className="size-4" />{t(action.pending === "download" ? "request.downloading" : "request.downloadAgain")}</Button> : undefined} />
    <ArcaZone step={3} title={t("certificate.title")} state={zones.certificate} help={environment === "Testing" ? t("certificate.testingHelp") : undefined}
      summary={active?.notAfterUtc ? t("certificate.summary", { date: format.date(active.notAfterUtc) }) : undefined}
      actions={zones.certificate === "open" ? <Button variant="link" asChild>
        <a href={arcaPortal[environment]} target="_blank" rel="noreferrer">{t("certificate.openArca")}<ExternalLinkIcon className="size-4" /></a>
      </Button> : undefined}>
      <StepList steps={[
        { key: "alias", icon: <DocumentIcon />, content: t("certificate.stepAlias", { alias }) },
        { key: "download", icon: <DownloadIcon />, content: t("certificate.stepDownload") },
        { key: "authorize", icon: <ShieldIcon />, content: t("certificate.stepAuthorize", { services: serviceNames }) },
      ]} />
      {canManage ? <CertificatePicker label={t("certificate.choose")} pending={action.pending === "upload"} disabled={action.pending !== null}
        error={certificateError} dropZone onPick={pem => void upload(pem)} /> : null}
    </ArcaZone>
    <ArcaZone step={4} title={t("test.title")} state={zones.test}
      actions={canManage ? <Button variant="outline" pending={action.pending === "test"} disabled={action.pending !== null} onClick={() => void test()}>
        {t(action.pending === "test" ? "test.running" : lastTest ? "test.again" : "test.run")}</Button> : undefined}>
      <ServiceRows services={chosen} checks={lastTest?.checks} tested={connection.lastTestedAtUtc !== null} alias={alias} />
      {testDetail}
    </ArcaZone>
    {children}
  </div>;
}

interface DataZoneProps {
  connection: ArcaConnection;
  state: ReturnType<typeof setupZonesOf>["data"];
  canManage: boolean;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onChanged: (connection: ArcaConnection) => void;
  onConflict: () => void;
  summary?: string;
}

/// El paso 1: CUIT con el dígito validado, ambiente, alias y los servicios que usa la empresa. «Generar el pedido» crea la
/// clave en el servidor y no llama a ARCA. Con otra CUIT u otro ambiente, la conexión del alta se reemplaza.
function DataZone({ connection, state, canManage, editing, onEditingChange, onChanged, onConflict, summary }: DataZoneProps) {
  const { t } = useTranslation("arca");
  const action = useArcaAction(onConflict);
  const pending = certificateOf(connection, "Pending");
  const [cuit, setCuit] = useState(connection.cuit ? formatCuit(connection.cuit) : "");
  const [environment, setEnvironment] = useState<ArcaEnvironment>(connection.environment ?? "Production");
  const [alias, setAlias] = useState(pending?.alias ?? "");
  const [services, setServices] = useState<string[]>(connection.status ? connection.enabledServices : connection.installedServices.map(service => service.code));
  const [errors, setErrors] = useState<{ cuit?: string; alias?: string }>({});
  const locked = !canManage || action.pending !== null;

  async function generate() {
    const normalized = normalizeCuit(cuit);
    const next = { cuit: normalized ? undefined : t("data.cuitInvalid"), alias: isValidAlias(alias) ? undefined : t("data.aliasInvalid") };
    setErrors(next);
    if (!normalized || next.alias) return;
    const result = await action.run("generate", async () => {
      let revision = connection.revision;
      const replacing = connection.status !== null && (normalized !== connection.cuit || environment !== connection.environment);
      if (replacing) { await disconnectArca(revision); revision = 0; }
      let started = await startArcaCertificateRequest({ cuit: normalized, environment, alias, services, expectedRevision: revision });
      // Con la misma conexión, el servidor conserva sus servicios: los elegidos de nuevo se guardan aparte.
      const sameServices = started.enabledServices.length === services.length && services.every(code => started.enabledServices.includes(code));
      if (!sameServices) started = await chooseArcaServices(services, started.revision);
      return started;
    });
    if (result) onChanged(result);
  }

  return <ArcaZone step={1} title={t("data.title")} state={state} summary={summary}
    actions={state === "open" ? canManage ? <>
      {editing ? <Button variant="outline" disabled={locked} onClick={() => onEditingChange(false)}>{t("data.cancel")}</Button> : null}
      <Button pending={action.pending === "generate"} disabled={locked} onClick={() => void generate()}>{t(action.pending === "generate" ? "data.generating" : "data.generate")}</Button>
    </> : undefined : canManage && connection.status === "AwaitingCertificate"
      ? <Button variant="link" onClick={() => onEditingChange(true)}>{t("data.change")}</Button> : undefined}>
    <div className="grid max-w-3xl gap-4 sm:grid-cols-2">
      <FormField label={t("data.cuit")} error={errors.cuit} required>
        <Input value={cuit} inputMode="numeric" autoComplete="off" maxLength={13} disabled={locked} onChange={event => setCuit(event.target.value)} />
      </FormField>
      <FormField label={t("data.alias")} help={t("data.aliasHelp")} error={errors.alias} required>
        <Input value={alias} autoComplete="off" spellCheck={false} autoCapitalize="none" maxLength={30} disabled={locked} onChange={event => setAlias(event.target.value)} />
      </FormField>
    </div>
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1 text-sm font-medium">{t("data.environment")}
        <span className="-my-1 inline-flex"><InfoTip text={t("data.environmentHelp")} label={t("common:actions.moreInfo", { label: t("data.environment") })} /></span></span>
      <SegmentedControl aria-label={t("data.environment")} disabled={locked} options={(["Testing", "Production"] as const).map(option => ({
        key: option, label: t(`environment.${option}`), pressed: environment === option, onSelect: () => setEnvironment(option),
      }))} />
    </div>
    <div role="group" aria-label={t("data.services")} className="flex flex-col gap-2">
      <p className="text-sm font-medium">{t("data.services")}</p>
      {connection.installedServices.map(service => <CheckboxField key={service.code}
        label={t(`services.names.${service.code}`, { defaultValue: service.code })}
        checked={service.required || services.includes(service.code)}
        disabled={locked || service.required}
        help={service.required ? t("data.requiredHelp") : undefined}
        onCheckedChange={checked => setServices(previous => checked ? [...previous, service.code] : previous.filter(code => code !== service.code))} />)}
    </div>
  </ArcaZone>;
}
