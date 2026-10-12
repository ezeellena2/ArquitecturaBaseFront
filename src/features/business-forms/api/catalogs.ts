import { api } from "@/shared/api/httpClient";
import { catalogId, readCatalog, readCatalogItems, readCatalogPage, readCatalogSave } from "./catalogResponse";

export interface CatalogManualItemBody {
  readonly localId: string;
  readonly itemId: string | null;
  readonly code: string;
  readonly text: Readonly<Record<string, string | null>>;
  readonly detail: Readonly<Record<string, string | null>>;
  readonly isActive: boolean;
}
export interface ManualCatalogBody {
  readonly name: Readonly<Record<"es" | "en", string>>;
  readonly description: Readonly<Record<"es" | "en", string>>;
  readonly items: readonly CatalogManualItemBody[];
}
export interface CatalogItemMove { readonly itemId: string; readonly direction: "up" | "down" }
export interface UpdateManualCatalogBody extends ManualCatalogBody { readonly expectedRevision: number; readonly moves?: readonly CatalogItemMove[] }
export interface CatalogItemsQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sort?: "position" | "-position" | "code" | "-code" | "text" | "-text" | "isActive" | "-isActive";
  readonly isActive?: boolean;
}
export const fetchCatalog = async (id: string, signal?: AbortSignal) => readCatalog(await api.get<unknown>(`/api/forms/catalogs/${catalogId(id)}`, { signal }), id);
export const fetchCatalogItems = async (id: string, query: CatalogItemsQuery, signal?: AbortSignal) => {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return readCatalogItems(await api.get<unknown>(`/api/forms/catalogs/${catalogId(id)}/items?${params}`, { signal }));
};
export const createManualCatalog = async (body: ManualCatalogBody, signal?: AbortSignal) => readCatalogSave(await api.post<unknown>("/api/forms/catalogs", body, { signal }), body.items.filter(item => item.itemId === null).map(item => item.localId));
export const updateManualCatalog = async (id: string, body: UpdateManualCatalogBody, signal?: AbortSignal) => readCatalogSave(await api.put<unknown>(`/api/forms/catalogs/${catalogId(id)}`, body, { signal }), body.items.filter(item => item.itemId === null).map(item => item.localId), id, body.expectedRevision);

export type CatalogSortField = "name" | "kind" | "revision" | "optionsCount" | "usageCount";
export interface CatalogListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sort?: CatalogSortField | `-${CatalogSortField}`;
  readonly kind?: "Manual" | "Filters";
  readonly isActive?: boolean;
}
export async function fetchCatalogPage(query: CatalogListQuery, signal?: AbortSignal) {
  const params = new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)]));
  return readCatalogPage(await api.get<unknown>(`/api/forms/catalogs?${params}`, { signal }));
}
