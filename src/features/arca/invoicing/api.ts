import { api } from "@/shared/api/httpClient";

/// Un punto de venta de web service: los dados de baja no vienen y los bloqueados se ven apagados.
export interface ArcaPointOfSale { number: number; emissionType: string; blocked: boolean }
export interface ArcaInvoicingSettings { pointOfSale: number | null }

export const arcaPointsOfSaleQueryKey = ["arca", "points-of-sale"] as const;
export const arcaInvoicingSettingsQueryKey = ["arca", "invoicing-settings"] as const;
export const fetchArcaPointsOfSale = (signal?: AbortSignal) => api.get<ArcaPointOfSale[]>("/api/arca/invoicing/points-of-sale", { signal });
export const fetchArcaInvoicingSettings = (signal?: AbortSignal) => api.get<ArcaInvoicingSettings>("/api/arca/invoicing/settings", { signal });
export const chooseArcaPointOfSale = (pointOfSale: number) => api.put<ArcaInvoicingSettings>("/api/arca/invoicing/point-of-sale", { pointOfSale });

/// Como lo muestra ARCA: cuatro cifras.
export const formatPointOfSale = (number: number) => String(number).padStart(4, "0");
