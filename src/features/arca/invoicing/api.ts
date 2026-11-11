import { api } from "@/shared/api/httpClient";

/// Un punto de venta de web service: los dados de baja no vienen y los bloqueados se ven apagados.
export interface ArcaPointOfSale { number: number; emissionType: string; blocked: boolean }
/// El punto de venta elegido y los datos del comprobante que el padrón no trae, cada uno null mientras no se cargó, y la
/// revisión que se manda al guardar (0 mientras no se guardó nada): si otro guardó antes, el servidor responde 409.
export interface ArcaInvoicingSettings { pointOfSale: number | null; grossIncomeNumber: string | null; activityStartOn: string | null; revision: number }

export const arcaPointsOfSaleQueryKey = ["arca", "points-of-sale"] as const;
export const arcaInvoicingSettingsQueryKey = ["arca", "invoicing-settings"] as const;
export const fetchArcaPointsOfSale = (signal?: AbortSignal) => api.get<ArcaPointOfSale[]>("/api/arca/invoicing/points-of-sale", { signal });
export const fetchArcaInvoicingSettings = (signal?: AbortSignal) => api.get<ArcaInvoicingSettings>("/api/arca/invoicing/settings", { signal });
export const chooseArcaPointOfSale = (pointOfSale: number, expectedRevision: number) =>
  api.put<ArcaInvoicingSettings>("/api/arca/invoicing/point-of-sale", { pointOfSale, expectedRevision });
/// Ingresos brutos e inicio de actividades (un día, `yyyy-MM-dd`): no llama a ARCA.
export const setArcaVoucherData = (data: { grossIncomeNumber: string; activityStartOn: string; expectedRevision: number }) =>
  api.put<ArcaInvoicingSettings>("/api/arca/invoicing/voucher-data", data);

/// Como lo muestra ARCA: cuatro cifras.
export const formatPointOfSale = (number: number) => String(number).padStart(4, "0");
