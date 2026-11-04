import { z } from "zod";
import { api } from "@/shared/api/httpClient";
import { formId } from "./response";

// Creating what a Home proposal describes: the turn's request and the proposal; the answer says what it created, if anything.
const id = z.string().uuid();
const draft = z.strictObject({ proposalId: id, definitionId: id.nullable() });
const catalog = z.strictObject({ proposalId: id, catalogId: id.nullable() });
export type ProposalDraft = z.infer<typeof draft>;
export type ProposalCatalog = z.infer<typeof catalog>;
export interface CreateFromProposalBody { readonly requestId: string; readonly proposalId: string }

function read<T extends { readonly proposalId: string }>(schema: z.ZodType<T>, body: unknown, proposalId: string): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success || parsed.data.proposalId !== proposalId) throw new Error("Invalid assistant proposal contract.");
  return parsed.data;
}
export const fetchProposalDraft = async (proposalId: string, signal?: AbortSignal) =>
  read(draft, await api.get<unknown>("/api/forms/definitions/assistant-proposals/" + formId(proposalId), { signal, cache: "no-store" }), proposalId);
export const createProposalDraft = async (body: CreateFromProposalBody, signal?: AbortSignal) =>
  read(draft, await api.post<unknown>("/api/forms/definitions/assistant-proposals", body, { signal }), body.proposalId);
export const fetchProposalCatalog = async (proposalId: string, signal?: AbortSignal) =>
  read(catalog, await api.get<unknown>("/api/forms/catalogs/assistant-proposals/" + formId(proposalId), { signal, cache: "no-store" }), proposalId);
export const createProposalCatalog = async (body: CreateFromProposalBody, signal?: AbortSignal) =>
  read(catalog, await api.post<unknown>("/api/forms/catalogs/assistant-proposals", body, { signal }), body.proposalId);
