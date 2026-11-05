import { api } from "@/shared/api/httpClient";

export type ArcaVatCondition = "RegisteredTaxpayer" | "Monotax" | "Exempt" | "NotRegistered";
/// Todo null hasta la primera prueba en verde.
export interface ArcaCompany { legalName: string | null; vatCondition: ArcaVatCondition | null; fiscalAddress: string | null }

export const arcaCompanyQueryKey = ["arca", "company"] as const;
export const fetchArcaCompany = (signal?: AbortSignal) => api.get<ArcaCompany>("/api/arca/registry/company", { signal });
