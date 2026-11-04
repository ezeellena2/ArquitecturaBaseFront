import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssistantState,
  AssistantSubmit,
  AssistantTurn,
} from "../api/assistant";
export function isActiveTurn(
  turn:
    | {
        readonly state: AssistantState;
      }
    | null
    | undefined,
) {
  return turn?.state === "pending" || turn?.state === "running";
}
/** The proposal of the same capability before this one, and whether a later one replaced it: asking for a catalog after a
 *  form does not replace the form. The server refuses to create a replaced one too. */
export function proposalNeighbors(
  turns: readonly AssistantTurn[],
  turn: AssistantTurn,
) {
  const same = turns
    .filter(
      (item) =>
        item.state === "completed" &&
        item.proposal?.capability === turn.proposal?.capability,
    )
    .toSorted((left, right) => left.ordinal - right.ordinal);
  const index = same.findIndex((item) => item.turnId === turn.turnId);
  return {
    previous: index > 0 ? (same[index - 1].proposal ?? null) : null,
    replaced: index >= 0 && index < same.length - 1,
  };
}
export function createSubmission(
  requestId: string,
  question: string,
  connectionRevision: number,
  conversation?: {
    id: string;
    revision: number;
  },
): AssistantSubmit {
  return Object.freeze({
    requestId,
    question: question.replaceAll("\r\n", "\n").trim(),
    expectedConnectionRevision: connectionRevision,
    conversationId: conversation?.id ?? null,
    expectedRevision: conversation?.revision ?? null,
  });
}
export function projectMessages(
  turns: readonly AssistantTurn[],
): ThreadMessageLike[] {
  return turns.flatMap((turn) => {
    if (turn.contentAccess !== "allowed") return [];
    const result: ThreadMessageLike[] = [];
    if (turn.question)
      result.push({
        id: `${turn.turnId}:user`,
        role: "user",
        content: [{ type: "text", text: turn.question }],
        createdAt: new Date(turn.submittedAtUtc),
        metadata: { custom: { requestId: turn.requestId } },
      });
    if (turn.state === "completed" && turn.answer)
      result.push({
        id: `${turn.turnId}:assistant`,
        role: "assistant",
        content: [{ type: "text", text: turn.answer.text }],
        createdAt: new Date(turn.submittedAtUtc),
        metadata: { custom: { requestId: turn.requestId } },
      });
    return result;
  });
}
const destinations: Record<
  string,
  {
    path: string;
    permission: string;
  }
> = {
  users: { path: "/usuarios", permission: "users.read" },
  "users.summary": { path: "/usuarios", permission: "users.read" },
  roles: { path: "/roles", permission: "roles.read" },
  "roles.list": { path: "/roles", permission: "roles.read" },
  "roles.permissions": { path: "/roles", permission: "roles.read" },
  businessInformation: {
    path: "/configuracion/negocio",
    permission: "ai.business.read",
  },
  business: { path: "/configuracion/negocio", permission: "ai.business.read" },
  "business.information": {
    path: "/configuracion/negocio",
    permission: "ai.business.read",
  },
};
export function sourceDestination(
  destination: string | null,
  permissions: readonly string[],
): string | undefined {
  if (destination === "profile") return "/perfil";
  const item = destination ? destinations[destination] : undefined;
  return item && permissions.includes(item.permission) ? item.path : undefined;
}
export const assistantKey = (userId: string) => ["assistant", userId] as const;
