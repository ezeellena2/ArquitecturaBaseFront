import { z } from "zod";
import { api } from "@/shared/api/httpClient";
const id = z.string().uuid();
const utc = z.iso.datetime();
const revision = z.number().int().nonnegative();
const count = z.number().int().nonnegative();
const assistantStateSchema = z.enum([
  "pending",
  "running",
  "completed",
  "failed",
  "uncertain",
  "canceled",
  "expired",
]);
const stage = z.enum([
  "pending",
  "preparing",
  "consulting",
  "composing",
  "verifying",
  "finished",
]);
const contentAccess = z.enum(["allowed", "blocked", "expired"]);
const evidence = z.strictObject({
  id,
  sourceId: z.string(),
  sourceVersion: z.number().int().positive(),
  observedAtUtc: utc,
  revision: revision.nullable(),
  destination: z.string().nullable(),
  requiredPermissions: z.array(z.string()),
  rows: z.array(
    z.strictObject({
      id: id.nullable(),
      values: z.array(z.strictObject({ label: z.string(), value: z.string() })),
    }),
  ),
  isComplete: z.boolean(),
});
const acceptedFields = {
  conversationId: id,
  requestId: id,
  conversationRevision: revision,
  turnRevision: revision,
  state: assistantStateSchema,
  stage,
  submittedAtUtc: utc,
  serverNowUtc: utc,
  pollingAfterSeconds: z.number().int().positive(),
};
const accepted = z.strictObject(acceptedFields);
const turn = z.strictObject({
  ...acceptedFields,
  turnId: id,
  ordinal: z.number().int().positive(),
  contentAccess,
  question: z.string().nullable(),
  answer: z
    .strictObject({
      kind: z.string(),
      text: z.string(),
      evidenceIds: z.array(id),
    })
    .nullable(),
  evidences: z.array(evidence),
  failure: z
    .strictObject({
      code: z.string(),
      detail: z.string(),
      recovery: z.enum(["reviewUncertainty", "newAttempt"]),
    })
    .nullable(),
  usage: z
    .strictObject({
      inputTokens: z.number().int().nullable(),
      outputTokens: z.number().int().nullable(),
      audioSeconds: z.number().nullable(),
    })
    .nullable(),
  culture: z.enum(["es", "en"]),
  timeZoneId: z.string().min(1),
  cancelRequestedAtUtc: utc.nullable(),
});
const bootstrap = z.strictObject({
  availability: z.enum([
    "available",
    "paused",
    "notConfigured",
    "modelNotQualified",
    "capacityLimited",
  ]),
  connectionRevision: revision,
  suggestions: z.array(z.strictObject({ id: z.string(), question: z.string() })),
  limits: z.strictObject({ questionMaxLength: z.number().int().positive() }),
  configurationDestination: z.literal("aiConfiguration").nullable(),
});
const summaryFields = {
  conversationId: id,
  revision,
  title: z.string(),
  lastActivityAtUtc: utc,
  contentAccess,
};
const conversationSummary = z.strictObject(summaryFields);
const conversation = z.strictObject({
  ...summaryFields,
  activeRequestId: id.nullable(),
});
const page = <T extends z.ZodType>(item: T) =>
  z.strictObject({
    items: z.array(item),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    totalCount: count,
    totalPages: count,
    hasPrevious: z.boolean(),
    hasNext: z.boolean(),
  });
const conversationPage = page(conversationSummary);
const turnPage = page(turn);
export type AssistantState = z.infer<typeof assistantStateSchema>;
/** Every state and stage the backend publishes, in the order of the contract: each one has its text. */
export const assistantStates = assistantStateSchema.options;
export const assistantStages = stage.options;
export type ContentAccess = z.infer<typeof contentAccess>;
export type AssistantEvidence = z.infer<typeof evidence>;
export type AssistantAccepted = z.infer<typeof accepted>;
export type AssistantTurn = z.infer<typeof turn>;
export type AssistantConversation = z.infer<typeof conversation>;
export type AssistantConversationSummary = z.infer<typeof conversationSummary>;
export type AssistantBootstrap = z.infer<typeof bootstrap>;
export interface AssistantSubmit {
  readonly requestId: string;
  readonly conversationId: string | null;
  readonly expectedRevision: number | null;
  readonly expectedConnectionRevision: number;
  readonly question: string;
}
function read<T>(schema: z.ZodType<T>, body: unknown): T {
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new Error("Invalid assistant contract.");
  return parsed.data;
}
const base = "/api/ai/assistant";
export const assistantApi = {
  bootstrap: async (signal?: AbortSignal) =>
    read(bootstrap, await api.get<unknown>(`${base}/bootstrap`, { signal })),
  conversations: async (
    parameters: {
      page: number;
      pageSize: number;
      sort?: string;
    },
    signal?: AbortSignal,
  ) =>
    read(
      conversationPage,
      await api.get<unknown>(
        `${base}/conversations?${new URLSearchParams({ page: String(parameters.page), pageSize: String(parameters.pageSize), ...(parameters.sort ? { sort: parameters.sort } : {}) })}`,
        { signal },
      ),
    ),
  conversation: async (id: string, signal?: AbortSignal) =>
    read(
      conversation,
      await api.get<unknown>(`${base}/conversations/${encodeURIComponent(id)}`, {
        signal,
      }),
    ),
  turns: async (id: string, page = 1, signal?: AbortSignal) =>
    read(
      turnPage,
      await api.get<unknown>(
        `${base}/conversations/${encodeURIComponent(id)}/turns?page=${page}&pageSize=20&sort=-ordinal`,
        { signal },
      ),
    ),
  submit: async (body: AssistantSubmit, signal?: AbortSignal) =>
    read(accepted, await api.post<unknown>(`${base}/turns`, body, { signal })),
  turn: async (requestId: string, signal?: AbortSignal) =>
    read(
      turn,
      await api.get<unknown>(`${base}/turns/${encodeURIComponent(requestId)}`, {
        signal,
      }),
    ),
  cancel: async (requestId: string, signal?: AbortSignal) =>
    read(
      turn,
      await api.post<unknown>(
        `${base}/turns/${encodeURIComponent(requestId)}/cancel`,
        undefined,
        { signal },
      ),
    ),
  remove: (id: string, signal?: AbortSignal) =>
    api.delete<void>(`${base}/conversations/${encodeURIComponent(id)}`, {
      signal,
    }),
};
