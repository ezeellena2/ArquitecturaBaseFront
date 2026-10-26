import type {
  AssistantAccepted,
  AssistantBootstrap,
  AssistantConversation,
  AssistantConversationSummary,
  AssistantSubmit,
  AssistantTurn,
} from "@/features/artificial-intelligence/api/assistant";
declare global {
  interface Window { assistantHistoryTestState: { reads: string[]; writes: number } }
}
export const assistantFixtureConversationId =
  "0199a0c0-0000-7000-8000-000000000111";
const fixtureId = (group: number, index: number) =>
  `0199a0c0-0000-7000-800${group}-${String(index).padStart(12, "0")}`;
const evidenceId = "0199a0c0-0000-7000-8000-000000000444";
const acceptedOf = (value: AssistantTurn): AssistantAccepted => ({
  conversationId: value.conversationId,
  requestId: value.requestId,
  conversationRevision: value.conversationRevision,
  turnRevision: value.turnRevision,
  state: value.state,
  stage: value.stage,
  submittedAtUtc: value.submittedAtUtc,
  serverNowUtc: value.serverNowUtc,
  pollingAfterSeconds: value.pollingAfterSeconds,
});
export function createAssistantVisualFixtures(
  language: "es" | "en",
  scenario: string,
) {
  const traffic = { reads: [] as string[], writes: 0 };
  window.assistantHistoryTestState = traffic;
  const en = language === "en";
  const date = "2026-10-04T12:00:00Z";
  const bootstrap: AssistantBootstrap = {
    availability:
      scenario === "assistant-paused"
        ? "paused"
        : scenario === "assistant-missing"
          ? "notConfigured"
          : scenario === "assistant-model"
            ? "modelNotQualified"
            : "available",
    connectionRevision: 7,
    configurationDestination: "aiConfiguration",
    limits: { questionMaxLength: 4000 },
    suggestions: [
      {
        id: "users.summary",
        question: en
          ? "How many active and inactive users are there?"
          : "¿Cuántos usuarios activos e inactivos hay?",
      },
      {
        id: "roles.list",
        question: en ? "What roles exist?" : "¿Qué roles hay?",
      },
      {
        id: "roles.permissions",
        question: en
          ? "What permissions does Support have?"
          : "¿Qué permisos tiene Soporte?",
      },
      {
        id: "business.information",
        question: en
          ? "What are our business hours?"
          : "¿Qué horario tenemos cargado?",
      },
      {
        id: "system.help",
        question: en
          ? "How do I assign permissions to a role?"
          : "¿Cómo asigno permisos a un rol?",
      },
    ],
  };
  const running =
    scenario === "assistant-running" ||
    scenario === "assistant-cancel-requested" ||
    scenario === "assistant-scroll";
  let turn: AssistantTurn = {
    turnId: "0199a0c0-0000-7000-8000-000000000222",
    requestId: "0199a0c0-0000-7000-8000-000000000333",
    conversationId: assistantFixtureConversationId,
    ordinal: 1,
    conversationRevision: 2,
    turnRevision: 2,
    state: running
      ? "running"
      : scenario === "assistant-uncertain"
        ? "uncertain"
        : scenario === "assistant-failed"
          ? "failed"
          : "completed",
    // Like the backend: an active turn has its stage and a terminal one is always finished.
    stage: running ? "consulting" : "finished",
    cancelRequestedAtUtc:
      scenario === "assistant-cancel-requested" ? date : null,
    contentAccess: scenario === "assistant-blocked" ? "blocked" : "allowed",
    question: bootstrap.suggestions[0].question,
    answer: {
      kind: "answer",
      text: en
        ? "There are 3 active users and 1 inactive user. The counts cover all accounts your access permits."
        : "Hay 3 usuarios activos y 1 inactivo. El conteo abarca todas las cuentas que tu acceso permite consultar.",
      evidenceIds: [evidenceId],
    },
    evidences: [
      {
        id: evidenceId,
        sourceId: "users.summary",
        sourceVersion: 1,
        observedAtUtc: date,
        revision: null,
        destination: "users",
        requiredPermissions: ["users.read"],
        isComplete: true,
        rows: [
          {
            id: null,
            values: [
              { label: en ? "Active" : "Activos", value: "3" },
              { label: en ? "Inactive" : "Inactivos", value: "1" },
            ],
          },
        ],
      },
    ],
    failure: null,
    usage: null,
    culture: language,
    timeZoneId: "America/Argentina/Buenos_Aires",
    submittedAtUtc: date,
    serverNowUtc: date,
    pollingAfterSeconds: 2,
  };
  if (turn.state !== "completed")
    turn = {
      ...turn,
      answer: null,
      evidences: [],
      failure:
        turn.state === "uncertain" || turn.state === "failed"
          ? {
              code: "Ai.Assistant.ProviderUnavailable",
              detail: en
                ? "The provider response could not be confirmed."
                : "No pudimos confirmar la respuesta del proveedor.",
              recovery:
                turn.state === "uncertain" ? "reviewUncertainty" : "newAttempt",
            }
          : null,
    };
  if (turn.contentAccess === "blocked")
    turn = { ...turn, question: null, answer: null, evidences: [] };
  const conversation = (): AssistantConversation => ({
    conversationId: assistantFixtureConversationId,
    title: turn.contentAccess === "allowed" ? bootstrap.suggestions[0].question : en ? "Private conversation" : "Conversación privada",
    revision: turn.conversationRevision,
    contentAccess: turn.contentAccess,
    activeRequestId:
      turn.state === "running" || turn.state === "pending"
        ? turn.requestId
        : null,
    lastActivityAtUtc: date,
  });
  const summary = (): AssistantConversationSummary => {
    const { activeRequestId: _, ...value } = conversation();
    return value;
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  const pageOf = (items: unknown[]) => ({
    items,
    page: 1,
    pageSize: 20,
    totalCount: items.length,
    totalPages: items.length ? 1 : 0,
    hasPrevious: false,
    hasNext: false,
  });
  const receipts = new Map<string, AssistantSubmit>();
  const previousTurns =
    scenario === "assistant-scroll"
      ? Array.from({ length: 10 }, (_, index): AssistantTurn => ({
          ...turn,
          turnId: fixtureId(1, index),
          requestId: fixtureId(2, index),
          ordinal: index + 1,
          state: "completed",
          stage: "finished",
          question: `Earlier question ${index + 1}`,
          answer: {
            kind: "answer",
            text: `Earlier confirmed answer ${index + 1}. `.repeat(30),
            evidenceIds: [],
          },
          evidences: [],
        }))
      : [];
  if (previousTurns.length) turn = { ...turn, ordinal: 11 };
  let turnReads = 0;
  let removed = false;
  return async (request: Request): Promise<Response | undefined> => {
    const path = new URL(request.url).pathname;
    if (!path.startsWith("/api/ai/assistant")) return undefined;
    if (request.method === "GET") traffic.reads.push(request.url); else traffic.writes++;
    if (path.endsWith("/bootstrap"))
      return scenario === "assistant-load-error"
        ? json({ code: "Unexpected", traceId: "assistant-visual" }, 500)
        : json(bootstrap);
    if (path.endsWith("/conversations") && scenario === "assistant-history") {
      const all = Array.from({ length: 24 }, (_, index) => ({ ...summary(), conversationId: index === 0 ? assistantFixtureConversationId : fixtureId(3, index),
        title: index === 0 ? bootstrap.suggestions[0].question : `${index + 1}. ${bootstrap.suggestions[index % 5].question}`,
        lastActivityAtUtc: index < 2 ? date : index < 4 ? "2026-10-03T12:00:00Z" : "2026-09-30T12:00:00Z",
      }));
      const url = new URL(request.url);
      const page = Number(url.searchParams.get("page") ?? 1);
      const pageSize = Number(url.searchParams.get("pageSize") ?? 20);
      return json({ items: all.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: all.length, totalPages: Math.ceil(all.length / pageSize), hasPrevious: page > 1, hasNext: page * pageSize < all.length });
    }
    if (path.endsWith("/conversations"))
      return json(
        pageOf(
          removed || scenario === "assistant-empty" ? [] : [summary()],
        ),
      );
    if (path.endsWith("/turns") && request.method === "POST") {
      const body = (await request.json()) as AssistantSubmit;
      if (scenario === "assistant-429")
        return json(
          {
            code: "Ai.Assistant.QuotaExceeded",
            detail: en
              ? "Wait before continuing."
              : "Esperá antes de continuar.",
            retryAfter: 42,
          },
          429,
        );
      receipts.set(body.requestId, body);
      turn = {
        ...turn,
        requestId: body.requestId,
        question: body.question,
        conversationRevision: turn.conversationRevision + 1,
        ordinal: turn.ordinal + 1,
      };
      if (scenario === "assistant-acceptance")
        throw new TypeError("Simulated lost acceptance");
      return json(acceptedOf(turn), 202);
    }
    if (path.endsWith("/cancel")) {
      turn = {
        ...turn,
        state: "canceled",
        stage: "finished",
        cancelRequestedAtUtc: turn.cancelRequestedAtUtc ?? date,
        answer: null,
        evidences: [],
        failure: {
          code: "Ai.Assistant.Canceled",
          detail: en ? "Cancellation confirmed." : "Cancelación confirmada.",
          recovery: "newAttempt",
        },
        turnRevision: turn.turnRevision + 1,
      };
      return json(turn);
    }
    if (request.method === "DELETE") {
      removed = true;
      return new Response(null, { status: 204 });
    }
    if (path.includes("/conversations/") && path.endsWith("/turns"))
      return json(
        pageOf(
          turn.contentAccess === "allowed" ? [...previousTurns, turn] : [],
        ),
      );
    if (path.includes("/conversations/"))
      return removed ? json({}, 404) : json(conversation());
    if (path.includes("/turns/")) {
      if (scenario === "assistant-scroll" && ++turnReads >= 3)
        turn = {
          ...turn,
          state: "completed",
          stage: "finished",
          answer: {
            kind: "answer",
            text: "New confirmed result. ".repeat(80),
            evidenceIds: [],
          },
          evidences: [],
          turnRevision: 3,
        };
      if (
        scenario === "assistant-acceptance" &&
        !receipts.has(path.split("/").at(-1)!)
      )
        return json({}, 404);
      return json(turn);
    }
    throw new Error(
      `Missing assistant visual fixture for ${request.method} ${path}`,
    );
  };
}
