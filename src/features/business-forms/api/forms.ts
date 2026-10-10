import { api } from "@/shared/api/httpClient";
import type { DraftWriteBody } from "../model";
import { formId, readFormCommit, readFormDetail, readFormFacets, readFormPage, readFormRecovery, recoveryPath } from "./response";

export interface FormListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sort?: "name" | "-name" | "questionCount" | "-questionCount" | "lastChangedAtUtc" | "-lastChangedAtUtc";
  readonly publicationFilter: "All" | "Published" | "Drafts";
}
function queryString(query: FormListQuery): string {
  return new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
}
export const fetchFormDefinitions = async (query: FormListQuery, signal?: AbortSignal) => readFormPage(await api.get<unknown>(`/api/forms/definitions?${queryString(query)}`, { signal }));
export const fetchFormFacets = async (query: FormListQuery, signal?: AbortSignal) => readFormFacets(await api.get<unknown>(`/api/forms/definitions/facets?${queryString(query)}`, { signal }));
export const fetchFormDefinition = async (id: string, signal?: AbortSignal) => readFormDetail(await api.get<unknown>(`/api/forms/definitions/${formId(id)}`, { signal }));
export const createFormDraft = async (body: DraftWriteBody, signal?: AbortSignal) => readFormCommit(await api.post<unknown>("/api/forms/definitions", body, { signal }));
export const updateFormDraft = async (id: string, body: DraftWriteBody & { readonly expectedRevision: number }, signal?: AbortSignal) => readFormCommit(await api.put<unknown>(`/api/forms/definitions/${formId(id)}/draft`, body, { signal }));
export const recoverFormDraft = async (requestId: string, signal?: AbortSignal) => readFormRecovery(await api.get<unknown>(recoveryPath(requestId), { signal }));
