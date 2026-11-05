import type { ArcaCertificate, ArcaConnection, ArcaEnvironment } from "./api";

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
const soonWindow = 30 * 24 * 60 * 60 * 1000;

/// Treinta días antes del vencimiento, el aviso amarillo; vencido, el rojo.
export function expiryOf(notAfterUtc: string | null | undefined, now: number): ArcaExpiry {
  if (!notAfterUtc) return "valid";
  const notAfter = Date.parse(notAfterUtc);
  if (notAfter <= now) return "expired";
  return notAfter - now <= soonWindow ? "soon" : "valid";
}

export type ZoneState = "open" | "done" | "off";
export interface SetupZones { data: ZoneState; request: ZoneState; certificate: ZoneState; test: ZoneState }

/// La zona en curso abierta, las hechas plegadas con su resumen y las que siguen, apagadas. «Cambiar» reabre los datos.
export function setupZonesOf(connection: ArcaConnection, editingData: boolean): SetupZones {
  if (connection.status === null || editingData) return { data: "open", request: "off", certificate: "off", test: "off" };
  if (connection.status === "AwaitingCertificate") return { data: "done", request: "done", certificate: "open", test: "off" };
  return { data: "done", request: "done", certificate: "done", test: "open" };
}

/// Dónde se hacen los pasos en ARCA: en homologación, en WSASS.
export const arcaPortal: Record<ArcaEnvironment, string> = {
  Production: "https://auth.afip.gob.ar/contribuyente_/login.xhtml",
  Testing: "https://wsass-homo.afip.gob.ar/wsass/portal/main.aspx",
};
