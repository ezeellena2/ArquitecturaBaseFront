import { api } from "@/shared/api/httpClient";

export type ArcaStatus = "AwaitingCertificate" | "Unverified" | "Active" | "NeedsAttention";
export type ArcaEnvironment = "Testing" | "Production";
export type ArcaCheckStatus = "Ready" | "NotAuthorized" | "NotDelegated" | "Blocked" | "ClockSkew" | "Unavailable" | "Failed";
/// Cómo entra la instalación a ARCA: el certificado de la empresa, la delegación guiada (etapa 5) o la del robot (etapa 6).
export type ArcaAccessMode = "CompanyCertificate" | "PlatformDelegation" | "PlatformDelegationAutomated";
/// `delegated`: en delegación, la empresa lo delega en la plataforma; si no, es una consulta que la plataforma hace con su CUIT.
export interface ArcaInstalledService { code: string; family: string; required: boolean; delegated: boolean }
/// La plataforma configurada en la instalación, en la que la empresa puede delegar.
export interface ArcaPlatform { cuit: string; name: string }
export interface ArcaCertificate {
  role: "Active" | "Pending"; alias: string; isLoaded: boolean; notBeforeUtc: string | null; notAfterUtc: string | null; thumbprint: string | null;
}
/// Sin conexión, el estado es null y la revisión 0: los servicios instalados y la plataforma vienen igual, para el alta. En
/// delegación, `cuit` es la de la empresa y `platformCuit`, la de la plataforma que guardó la conexión.
export interface ArcaConnection {
  status: ArcaStatus | null; mode: ArcaAccessMode | null; environment: ArcaEnvironment | null; cuit: string | null;
  platformCuit: string | null; platform: ArcaPlatform | null;
  installedServices: ArcaInstalledService[]; enabledServices: string[]; certificates: ArcaCertificate[];
  lastTestPassed: boolean | null; lastTestedAtUtc: string | null; revision: number;
}
export interface ArcaCheck { service: string; status: ArcaCheckStatus; failureCode: string | null; ticketExpiresAtUtc: string | null; retryAfterUtc: string | null }
export interface ArcaTest { checks: ArcaCheck[]; connection: ArcaConnection }
export interface StartArcaRequest {
  cuit: string; environment: ArcaEnvironment; alias: string; services: string[]; expectedRevision: number; mode?: ArcaAccessMode;
}

/// Todo lo del módulo cuelga de "arca": un cambio de la conexión invalida a las familias.
export const arcaQueryKey = ["arca"] as const;
export const arcaConnectionQueryKey = ["arca", "connection"] as const;
export const fetchArcaConnection = (signal?: AbortSignal) => api.get<ArcaConnection>("/api/arca/connection", { signal });
export const startArcaCertificateRequest = (request: StartArcaRequest) => api.post<ArcaConnection>("/api/arca/connection/certificate-requests", request);
export const downloadArcaRequest = () => api.file("/api/arca/connection/certificate-requests/current");
export const cancelArcaRenewal = (expectedRevision: number) =>
  api.delete<ArcaConnection>(`/api/arca/connection/certificate-requests/current?expectedRevision=${expectedRevision}`);
/// H30: cambiar CUIT, ambiente o modo en el alta reemplaza la conexión leída por una nueva, con su pedido, en un solo pedido.
export const replaceArcaConnection = (request: StartArcaRequest) => api.put<ArcaConnection>("/api/arca/connection", request);
export const chooseArcaServices = (services: string[], expectedRevision: number) =>
  api.put<ArcaConnection>("/api/arca/connection/services", { services, expectedRevision });
export const uploadArcaCertificate = (certificate: string, expectedRevision: number) =>
  api.put<ArcaTest>("/api/arca/connection/certificate", { certificate, expectedRevision });
export const testArcaConnection = () => api.post<ArcaTest>("/api/arca/connection/test");
export const disconnectArca = (expectedRevision: number) => api.delete<void>(`/api/arca/connection?expectedRevision=${expectedRevision}`);
