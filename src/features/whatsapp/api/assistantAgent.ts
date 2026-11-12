import { z } from "zod";
import { api } from "@/shared/api/httpClient";

// Casos del asistente (AS1-A to AS5): the main agent of the screen «Asistente», its test (AS3) and the accounts to test as.
// Closed contracts: an unknown key or value is a generic error that keeps neither the issues nor the payload.
const guid = z.string().uuid();
const culture = z.enum(["es", "en"]);
/** A fixed text that goes out as written: the agent's original language is required, the other one optional. */
const texts = z.strictObject({ es: z.string().nullable(), en: z.string().nullable() });
const actionKind = z.enum(["SendForm", "ExactText", "DraftedReply", "AskButtons", "Handoff", "NoReply"]);
const buttonDestination = z.enum(["SendForm", "ExactText", "Handoff"]);
const inputType = z.enum(["Any", "Text", "Audio"]);
const button = z.strictObject({ title: texts, destination: buttonDestination, formDefinitionId: guid.nullable(), text: texts.nullable() });
/** An action of the closed menu with only what it uses: the rest comes null. */
const action = z.strictObject({ kind: actionKind, formDefinitionId: guid.nullable(), text: texts.nullable(), instructions: z.string().nullable(),
  question: texts.nullable(), buttons: z.array(button).nullable(), handoffReason: z.string().nullable() });
const agentCase = z.strictObject({ id: guid, when: z.string(), inputType, isActive: z.boolean(), action });
const profile = z.strictObject({ name: z.string(), introduction: z.string(), tone: z.string(), does: z.string(), doesNot: z.string(), handoffMessage: texts });
const limits = z.strictObject({ blockedTopics: z.array(z.string()), cannotPromise: z.string(), maxReplyLength: z.number().int(),
  dailyReplyLimit: z.number().int(), allowedActions: z.array(actionKind) });
/** A published form the assistant can send; with `offerWhen`, it is a case of the forms block. */
const form = z.strictObject({ definitionId: guid, name: z.string(), offerWhen: z.string().nullable() });
const fact = z.strictObject({ id: z.string(), label: z.string(), text: z.string() });
const section = z.strictObject({ key: z.enum(["Details", "Location", "Hours", "Services", "Answers"]), state: z.enum(["Loaded", "Empty", "LegacyUnreviewed"]), facts: z.array(fact) });
const knowledge = z.strictObject({ availability: z.enum(["Available", "NotInstalled"]), revision: z.number().int().min(0),
  unansweredQuestions: z.number().int().min(0), sections: z.array(section) });
const availability = z.strictObject({ state: z.enum(["available", "paused", "modelNotQualified", "notConfigured", "notInstalled"]) });
const agent = z.strictObject({ revision: z.number().int().min(0), originalCulture: culture, profile, cases: z.array(agentCase), fallback: action, limits,
  forms: z.array(form), knowledge, assistantAvailability: availability });

export type AgentCulture = z.infer<typeof culture>;
export type AgentTexts = z.infer<typeof texts>;
export type AgentActionKind = z.infer<typeof actionKind>;
export type AgentButtonDestination = z.infer<typeof buttonDestination>;
export type AgentInputType = z.infer<typeof inputType>;
export type AgentButton = z.infer<typeof button>;
export type AgentAction = z.infer<typeof action>;
export type AgentCase = z.infer<typeof agentCase>;
export type AgentProfile = z.infer<typeof profile>;
export type AgentLimits = z.infer<typeof limits>;
export type AgentForm = z.infer<typeof form>;
export type AgentKnowledgeSection = z.infer<typeof section>;
export type AgentKnowledge = z.infer<typeof knowledge>;
export type AgentAvailability = z.infer<typeof availability>["state"];
export type AssistantAgent = z.infer<typeof agent>;
/** The menu of «Qué hacer», in the order of the screen. */
export const agentActionKinds = actionKind.options;

/** The four tabs in one save, with the revision read (0 before the first save). */
export interface AssistantAgentSaveRequest {
  expectedRevision: number;
  originalCulture: AgentCulture;
  profile: AgentProfile;
  cases: AgentCase[];
  fallback: AgentAction;
  limits: AgentLimits;
}

const testAction = z.strictObject({
  kind: actionKind, caseSource: z.enum(["Own", "Form", "Fallback"]), caseTitle: z.string().nullable(), reason: z.string(), used: z.array(z.string()),
  text: z.string().nullable(), buttons: z.array(z.string()).nullable(),
  // The form that would go, with what it would fill; a question it would leave empty comes without a value.
  form: z.strictObject({ name: z.string(), fields: z.array(z.strictObject({ label: z.string(), value: z.string().nullable() })) }).nullable(),
  handoffReasonCode: z.string().nullable(), handoffReason: z.string().nullable(),
});
const testResult = z.strictObject({ requestId: guid, state: z.enum(["pending", "completed", "failed"]), failureCode: z.string().nullable(), actions: z.array(testAction).max(3) });
const recipient = z.strictObject({ contactId: guid, name: z.string(), email: z.string().nullable() });
const recipients = z.strictObject({ items: z.array(recipient).max(20) });

export type AgentTestAction = z.infer<typeof testAction>;
export type AgentTestResult = z.infer<typeof testResult>;
export type AgentTestRecipient = z.infer<typeof recipient>;
/** 1 to 5 messages, each of 1 to 1000 characters: several are a burst. */
export interface AgentTestRequest { requestId: string; contactId: string; messages: readonly string[] }

export const assistantAgentKey = ["whatsapp-assistant-agent"] as const;
const base = "/api/whatsapp/assistant-agent";

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error("Unsupported assistant agent response.");
  return result.data;
}

export async function fetchAssistantAgent(signal?: AbortSignal): Promise<AssistantAgent> {
  return parse(agent, await api.get<unknown>(base, { signal, cache: "no-store" }));
}

/** 200 brings the agent as saved, with the same body as the read. */
export async function saveAssistantAgent(request: AssistantAgentSaveRequest, signal?: AbortSignal): Promise<AssistantAgent> {
  return parse(agent, await api.put<unknown>(base, request, { signal }));
}

/** 202 only says the test was accepted: its result is read with `fetchAssistantAgentTest`. */
export async function startAssistantAgentTest(request: AgentTestRequest, signal?: AbortSignal): Promise<void> {
  await api.post<unknown>(base + "/tests", request, { signal });
}

export async function fetchAssistantAgentTest(requestId: string, contactId: string, signal?: AbortSignal): Promise<AgentTestResult> {
  const result = parse(testResult, await api.get<unknown>(`${base}/tests/${encodeURIComponent(requestId)}?${new URLSearchParams({ contactId })}`, { signal, cache: "no-store" }));
  if (result.requestId !== requestId) throw new Error("Unsupported assistant agent response.");
  return result;
}

export async function fetchAssistantTestRecipients(search: string, signal?: AbortSignal): Promise<AgentTestRecipient[]> {
  return parse(recipients, await api.get<unknown>(`${base}/test-recipients?${new URLSearchParams({ search })}`, { signal })).items;
}
