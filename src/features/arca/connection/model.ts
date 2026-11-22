import type { ArcaAccessMode, ArcaCertificate, ArcaConnection, ArcaEnvironment, ArcaInstalledService } from "./api";

const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

/// Los once dígitos de una CUIT válida, sin guiones ni espacios, o null: la misma regla que el servidor.
export function normalizeCuit(value: string): string | null {
  const digits = value.replace(/[-\s]/g, "");
  if (!/^\d{11}$/.test(digits)) return null;
  const sum = weights.reduce((total, weight, index) => total + weight * Number(digits[index]), 0);
  const check = 11 - (sum % 11);
  if (check === 10) return null;
  return Number(digits[10]) === (check === 11 ? 0 : check) ? digits : null;
}

export const formatCuit = (cuit: string) => `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}`;

/// Entre 3 y 30 minúsculas, dígitos o guiones, empezando por letra: el alias del certificado en ARCA.
export const isValidAlias = (alias: string) => /^[a-z][a-z0-9-]{2,29}$/.test(alias);

/// Sin conexión, el alta por zonas (AC1-A) o la conexión activa por zonas (AC2-A).
export type ArcaPhase = "empty" | "setup" | "active";

export function phaseOf(connection: ArcaConnection): ArcaPhase {
  if (connection.status === null) return "empty";
  return connection.status === "AwaitingCertificate" || connection.status === "Unverified" ? "setup" : "active";
}

export const certificateOf = (connection: ArcaConnection, role: ArcaCertificate["role"]) =>
  connection.certificates.find(certificate => certificate.role === role);

export type ArcaExpiry = "valid" | "soon" | "expired";
const day = 24 * 60 * 60 * 1000;

/// «Avisar N días antes» del vencimiento del certificado, la misma regla que el servidor (RC7-B).
export const certificateNoticeDays = { min: 1, max: 365 } as const;
export const isValidCertificateNotice = (days: number) =>
  Number.isInteger(days) && days >= certificateNoticeDays.min && days <= certificateNoticeDays.max;

/// Desde los días de aviso de la conexión antes del vencimiento, el aviso amarillo; vencido, el rojo.
export function expiryOf(notAfterUtc: string | null | undefined, now: number, noticeDays: number): ArcaExpiry {
  if (!notAfterUtc) return "valid";
  const notAfter = Date.parse(notAfterUtc);
  if (notAfter <= now) return "expired";
  return notAfter - now <= noticeDays * day ? "soon" : "valid";
}

export type ZoneState = "open" | "done" | "off";
export interface SetupZones { data: ZoneState; request: ZoneState; certificate: ZoneState; test: ZoneState }

/// La zona en curso abierta, las hechas plegadas con su resumen y las que siguen, apagadas. «Cambiar» reabre los datos.
/// En delegación, la zona de la prueba es la de la delegación: se pliega cuando la delegación llegó (DG2-A), salvo que se
/// pida «Ver la guía».
export function setupZonesOf(connection: ArcaConnection, editingData: boolean, showingGuide = false): SetupZones {
  if (connection.status === null || editingData) return { data: "open", request: "off", certificate: "off", test: "off" };
  if (connection.status === "AwaitingCertificate") return { data: "done", request: "done", certificate: "open", test: "off" };
  const delegated = isDelegation(connection.mode) && connection.lastTestPassed === true && !showingGuide;
  return { data: "done", request: "done", certificate: "done", test: delegated ? "done" : "open" };
}

/// Los modos en que la empresa delega sus servicios en la plataforma, que firma con su certificado (ADR 0027).
export const isDelegation = (mode: ArcaAccessMode | null | undefined) => mode === "PlatformDelegation" || mode === "PlatformDelegationAutomated";

/// Un paso de la guía de la delegación, con la clave estable que comparte con el robot de la etapa 6.
export interface DelegationStep { key: string; service?: string }

/// Los pasos de la delegación para los servicios elegidos (DG2-A). En producción, la empresa delega cada servicio que
/// actúa en su nombre y la plataforma acepta y asigna cada uno a su alias; en homologación, la plataforma crea sola la
/// autorización en WSASS. Las consultas no se delegan: la plataforma las autoriza para su alias (`authorize`).
export function delegationStepsOf(chosen: readonly ArcaInstalledService[], environment: ArcaEnvironment) {
  const delegated = chosen.filter(service => service.delegated);
  const authorize: DelegationStep[] = chosen.filter(service => !service.delegated)
    .map(service => ({ key: `platform.authorize.${service.code}`, service: service.code }));
  const assign: DelegationStep[] = delegated.map(service => ({ key: `platform.assign.${service.code}`, service: service.code }));
  if (environment === "Testing") return { authorize, company: [] as DelegationStep[], platform: assign };
  return {
    authorize,
    company: delegated.map(service => ({ key: `company.delegate.${service.code}`, service: service.code })),
    platform: delegated.length > 0 ? [{ key: "platform.accept" }, ...assign] : [],
  };
}

/// Dónde se hacen los pasos en ARCA: en homologación, en WSASS.
export const arcaPortal: Record<ArcaEnvironment, string> = {
  Production: "https://auth.afip.gob.ar/contribuyente_/login.xhtml",
  Testing: "https://wsass-homo.afip.gob.ar/wsass/portal/main.aspx",
};

/// La plataforma de la conexión, con su nombre si la instalación la tiene configurada y su CUIT con guiones.
export function platformOf(connection: ArcaConnection) {
  const cuit = connection.platformCuit ?? connection.platform?.cuit ?? "";
  return { name: connection.platform?.name ?? (cuit ? formatCuit(cuit) : ""), cuit: cuit ? formatCuit(cuit) : "" };
}
