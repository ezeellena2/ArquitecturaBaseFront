import { api } from "@/shared/api/httpClient";
export type AiProvider = "OpenAI" | "Anthropic";
export type CredentialChange = "Keep" | "Replace" | "Remove";
export interface AiConnection { provider: AiProvider; model: string; hasCredential: boolean; enabled: boolean; revision: number; providers: AiProvider[] }
export interface AiSaveRequest { provider: AiProvider; model: string; credentialChange: CredentialChange; apiKey: string | null; enabled: boolean; expectedRevision: number; requestId: string }
export type AiTestRequest = Omit<AiSaveRequest, "enabled" | "requestId">;
export type AiModelsRequest = Omit<AiTestRequest, "model">;
export interface AiModel { id: string; displayName: string }
export interface AiModels { provider: AiProvider; revision: number; models: AiModel[] }
export interface AiChange { requestId: string; connection: AiConnection }
export interface AiTest { revision: number; inputTokens: number | null; outputTokens: number | null }
export const aiConnectionQueryKey = ["ai-connection"] as const;
export const fetchAiConnection = (signal?: AbortSignal) => api.get<AiConnection>("/api/ai/connection", { signal });
export const saveAiConnection = (request: AiSaveRequest, signal: AbortSignal) => api.put<AiChange>("/api/ai/connection", request, { signal });
export const testAiConnection = (request: AiTestRequest, signal: AbortSignal) => api.post<AiTest>("/api/ai/connection/test", request, { signal });
export const listAiModels = (request: AiModelsRequest, signal: AbortSignal) => api.post<AiModels>("/api/ai/connection/models", request, { signal });
export const fetchAiChange = (requestId: string, signal?: AbortSignal) => api.get<AiChange>(`/api/ai/connection/changes/${encodeURIComponent(requestId)}`, { signal });
