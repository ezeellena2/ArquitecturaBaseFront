import { api } from "@/shared/api/httpClient";

export type ArcaStatus = "AwaitingCertificate" | "Unverified" | "Active" | "NeedsAttention";
export type ArcaEnvironment = "Testing" | "Production";
export type ArcaCheckStatus = "Ready" | "NotAuthorized" | "Blocked" | "ClockSkew" | "Unavailable" | "Failed";
export interface ArcaInstalledService { code: string; family: string; required: boolean }
export interface ArcaCertificate {
  role: "Active" | "Pending"; alias: string; isLoaded: boolean; notBeforeUtc: string | null; notAfterUtc: string | null; thumbprint: string | null;
}
/// Sin conexión, el estado es null y la revisión 0: los servicios instalados vienen igual, para el alta.
export interface ArcaConnection {
  status: ArcaStatus | null; mode: string | null; environment: ArcaEnvironment | null; cuit: string | null;
  installedServices: ArcaInstalledService[]; enabledServices: string[]; certificates: ArcaCertificate[];
  lastTestPassed: boolean | null; lastTestedAtUtc: string | null; revision: number;
}
export interface ArcaCheck { service: string; status: ArcaCheckStatus; failureCode: string | null; ticketExpiresAtUtc: string | null; retryAfterUtc: string | null }
export interface ArcaTest { checks: ArcaCheck[]; connection: ArcaConnection }
export interface StartArcaRequest { cuit: string; environment: ArcaEnvironment; alias: string; services: string[]; expectedRevision: number }

/// Todo lo del módulo cuelga de "arca": un cambio de la conexión invalida a las familias.
export const arcaQueryKey = ["arca"] as const;
export const arcaConnectionQueryKey = ["arca", "connection"] as const;
export const fetchArcaConnection = (signal?: AbortSignal) => api.get<ArcaConnection>("/api/arca/connection", { signal });
export const startArcaCertificateRequest = (request: StartArcaRequest) => api.post<ArcaConnection>("/api/arca/connection/certificate-requests", request);
export const downloadArcaRequest = () => api.file("/api/arca/connection/certificate-requests/current");
export const cancelArcaRenewal = (expectedRevision: number) =>
  api.delete<ArcaConnection>(`/api/arca/connection/certificate-requests/current?expectedRevision=${expectedRevision}`);
export const chooseArcaServices = (services: string[], expectedRevision: number) =>
  api.put<ArcaConnection>("/api/arca/connection/services", { services, expectedRevision });
export const uploadArcaCertificate = (certificate: string, expectedRevision: number) =>
  api.put<ArcaTest>("/api/arca/connection/certificate", { certificate, expectedRevision });
export const testArcaConnection = () => api.post<ArcaTest>("/api/arca/connection/test");
export const disconnectArca = (expectedRevision: number) => api.delete<void>(`/api/arca/connection?expectedRevision=${expectedRevision}`);
