import { api } from "@/shared/api/httpClient";
import type { DraftEditorValue, DraftWriteBody, FormPublicationWriteBody } from "../model";
import { formId, readFormDeactivation, readFormDeactivationPreview, readFormPreview, publicationPath, readFormPublicationReceipt, readFormPublicationStatus, readFormPublicationCheck, readFormCommit, readFormDetail, readFormFacets, readFormPage, readFormRecovery, recoveryPath } from "./response";

export interface FormListQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly search?: string;
  readonly sort?: "name" | "-name" | "questionCount" | "-questionCount" | "lastChangedAtUtc" | "-lastChangedAtUtc";
  readonly publicationFilter: "Active" | "Published" | "Drafts" | "Deactivated";
}
function queryString(query: FormListQuery): string {
  return new URLSearchParams(Object.entries(query).filter(([, value]) => value !== undefined).map(([key, value]) => [key, String(value)])).toString();
}
export const fetchFormDefinitions = async (query: FormListQuery, signal?: AbortSignal) => readFormPage(await api.get<unknown>(`/api/forms/definitions?${queryString(query)}`, { signal }));
export const fetchFormFacets = async (query: Pick<FormListQuery, "search">, signal?: AbortSignal) => readFormFacets(await api.get<unknown>(`/api/forms/definitions/facets?${new URLSearchParams(query.search ? { search: query.search } : {})}`, { signal }));
export const fetchFormDefinition = async (id: string, signal?: AbortSignal) => readFormDetail(await api.get<unknown>(`/api/forms/definitions/${formId(id)}`, { signal }));
export const createFormDraft = async (body: DraftWriteBody, signal?: AbortSignal) => readFormCommit(await api.post<unknown>("/api/forms/definitions", body, { signal }));
export const updateFormDraft = async (id: string, body: DraftWriteBody & { readonly expectedRevision: number }, signal?: AbortSignal) => readFormCommit(await api.put<unknown>(`/api/forms/definitions/${formId(id)}/draft`, body, { signal }));
export const recoverFormDraft = async (requestId: string, signal?: AbortSignal) => readFormRecovery(await api.get<unknown>(recoveryPath(requestId), { signal }));

export const checkFormPublication = async (id: string, body: DraftEditorValue & { readonly expectedRevision: number }, signal?: AbortSignal) => readFormPublicationCheck(await api.post<unknown>(`/api/forms/definitions/${formId(id)}/publication-checks`, { name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision }, { signal }), id, body.expectedRevision, body.draft.fields);

export const acceptFormPublication = async (id: string, body: FormPublicationWriteBody, signal?: AbortSignal) => readFormPublicationReceipt(await api.post<unknown>(`/api/forms/definitions/${formId(id)}/publications`, { name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision, requestId: body.requestId, checkToken: body.checkToken }, { signal }), id, body.requestId, body.expectedRevision);
export const fetchFormPublication = async (id: string, requestId: string, signal?: AbortSignal) => readFormPublicationStatus(await api.get<unknown>(publicationPath(id, requestId), { signal }), id, requestId);

export async function fetchFormPreview(id: string, versionId: string, culture: "es" | "en", signal?: AbortSignal) { return readFormPreview(await api.get<unknown>(`/api/forms/definitions/${formId(id)}/versions/${formId(versionId)}/preview?${new URLSearchParams({culture})}`, { signal, cache: "no-store" })); }

export const fetchFormDeactivation = async (id: string, signal?: AbortSignal) => readFormDeactivationPreview(await api.get<unknown>(`/api/forms/definitions/${formId(id)}/deactivation`, { signal, cache: "no-store" }), id);
export const deactivateForm = async (id: string, expectedRevision: number, signal?: AbortSignal) => readFormDeactivation(await api.post<unknown>(`/api/forms/definitions/${formId(id)}/deactivation`, { expectedRevision }, { signal }), id);
