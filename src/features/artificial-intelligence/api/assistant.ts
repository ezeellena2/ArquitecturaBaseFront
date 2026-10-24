import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";
export type AssistantState =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "uncertain"
  | "canceled"
  | "expired";
export type ContentAccess = "allowed" | "blocked" | "expired";
export interface AssistantEvidence {
  readonly id: string;
  readonly sourceId: string;
  readonly sourceVersion: number;
  readonly observedAtUtc: string;
  readonly revision: number | null;
  readonly destination: string | null;
  readonly requiredPermissions: readonly string[];
  readonly rows: readonly {
    id: string | null;
    values: readonly {
      label: string;
      value: string;
    }[];
  }[];
  readonly isComplete: boolean;
}
export interface AssistantAccepted {
  readonly conversationId: string;
  readonly requestId: string;
  readonly conversationRevision: number;
  readonly turnRevision: number;
  readonly state: AssistantState;
  readonly stage: string | null;
  readonly submittedAtUtc: string;
  readonly serverNowUtc: string;
  readonly pollingAfterSeconds: number;
}
export interface AssistantTurn extends AssistantAccepted {
  readonly turnId: string;
  readonly ordinal: number;
  readonly cancelRequestedAtUtc?: string | null;
  readonly contentAccess: ContentAccess;
  readonly question: string | null;
  readonly answer: {
    readonly kind: string;
    readonly text: string;
    readonly evidenceIds: readonly string[];
  } | null;
  readonly evidences: readonly AssistantEvidence[];
  readonly failure: {
    readonly code: string;
    readonly detail: string;
    readonly recovery: string;
  } | null;
  readonly culture: string;
  readonly timeZoneId: string;
}
export interface AssistantConversation {
  readonly conversationId: string;
  readonly revision: number;
  readonly title: string;
  readonly contentAccess: ContentAccess;
  readonly activeRequestId: string | null;
  readonly lastActivityAtUtc: string;
}
export interface AssistantConversationSummary {
  readonly conversationId: string;
  readonly revision: number;
  readonly title: string;
  readonly contentAccess: ContentAccess;
  readonly lastActivityAtUtc: string;
}
export interface AssistantBootstrap {
  readonly availability:
    | "available"
    | "paused"
    | "notConfigured"
    | "modelNotQualified"
    | "capacityLimited";
  readonly connectionRevision: number;
  readonly suggestions: readonly {
    id: string;
    question: string;
  }[];
  readonly limits: {
    questionMaxLength: number;
  };
  readonly configurationDestination?: string | null;
}
export interface AssistantSubmit {
  readonly requestId: string;
  readonly conversationId: string | null;
  readonly expectedRevision: number | null;
  readonly expectedConnectionRevision: number;
  readonly question: string;
}
const base = "/api/ai/assistant";
export const assistantApi = {
  bootstrap: (signal?: AbortSignal) =>
    api.get<AssistantBootstrap>(`${base}/bootstrap`, { signal }),
  conversations: (
    parameters: {
      page: number;
      pageSize: number;
      sort?: string;
    },
    signal?: AbortSignal,
  ) =>
    api.get<PagedResult<AssistantConversationSummary>>(
      `${base}/conversations?${new URLSearchParams({ page: String(parameters.page), pageSize: String(parameters.pageSize), ...(parameters.sort ? { sort: parameters.sort } : {}) })}`,
      { signal },
    ),
  conversation: (id: string, signal?: AbortSignal) =>
    api.get<AssistantConversation>(
      `${base}/conversations/${encodeURIComponent(id)}`,
      { signal },
    ),
  turns: (id: string, page = 1, signal?: AbortSignal) =>
    api.get<PagedResult<AssistantTurn>>(
      `${base}/conversations/${encodeURIComponent(id)}/turns?page=${page}&pageSize=20&sort=-ordinal`,
      { signal },
    ),
  submit: (body: AssistantSubmit, signal?: AbortSignal) =>
    api.post<AssistantAccepted>(`${base}/turns`, body, { signal }),
  turn: (requestId: string, signal?: AbortSignal) =>
    api.get<AssistantTurn>(`${base}/turns/${encodeURIComponent(requestId)}`, {
      signal,
    }),
  cancel: (requestId: string, signal?: AbortSignal) =>
    api.post<AssistantTurn>(
      `${base}/turns/${encodeURIComponent(requestId)}/cancel`,
      undefined,
      { signal },
    ),
  remove: (id: string, signal?: AbortSignal) =>
    api.delete<void>(`${base}/conversations/${encodeURIComponent(id)}`, {
      signal,
    }),
};
