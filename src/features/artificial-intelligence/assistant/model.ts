import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssistantState,
  AssistantSubmit,
  AssistantTurn,
} from "../api/assistant";
type Proposal = NonNullable<AssistantTurn["proposal"]>;
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
/** The proposal of the same replacement group before this one, and whether a later one replaced it: the module that owns the
 *  card groups the proposals that replace each other (a catalog and importing a spreadsheet) and, without that, each capability
 *  is its own group, so asking for a catalog after a form does not replace the form. The server refuses to create a replaced
 *  one too. */
export function proposalNeighbors(
  turns: readonly AssistantTurn[],
  turn: AssistantTurn,
  group: (proposal: Proposal) => string = (proposal) => proposal.capability,
) {
  const key = turn.proposal ? group(turn.proposal) : undefined;
  const same = turns
    .filter(
      (item) =>
        item.state === "completed" && !!item.proposal && group(item.proposal) === key,
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
  audioRequestId?: string,
): AssistantSubmit {
  return Object.freeze({
    requestId,
    question: question.replaceAll("\r\n", "\n").trim(),
    expectedConnectionRevision: connectionRevision,
    conversationId: conversation?.id ?? null,
    expectedRevision: conversation?.revision ?? null,
    // Only a dictated turn names its recording: a typed one keeps the body it always had.
    ...(audioRequestId ? { audioRequestId } : {}),
  });
}
export function projectMessages(
  turns: readonly AssistantTurn[],
): ThreadMessageLike[] {
  return turns.flatMap((turn) => {
    if (turn.contentAccess !== "allowed") return [];
    const result: ThreadMessageLike[] = [];
    // A dictated turn, or one that brought a spreadsheet, may carry no typed text: its recording or its file still make the message.
    if (turn.question || turn.audio || turn.attachment)
      result.push({
        id: `${turn.turnId}:user`,
        role: "user",
        content: [{ type: "text", text: turn.question ?? "" }],
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
/** The most a spreadsheet may weigh, as the server reads it (Stage 2). */
export const attachmentMaximumBytes = 10 * 1024 * 1024;
/** What the clip offers: one Excel workbook or one CSV per message. */
export const attachmentAccept = ".xlsx,.csv";
export type AttachmentProblem = "legacy" | "macros" | "type" | "tooLarge";
/** What the browser can see does not serve before sending a file: an old Excel, one with macros, another type or more than the
 *  limit. The server reads the kind from the bytes and says the rest (with a password, unreadable, empty). */
export function attachmentProblem(file: { readonly name: string; readonly size: number }): AttachmentProblem | undefined {
  const extension = fileExtension(file.name);
  if (extension === "xls") return "legacy";
  if (extension === "xlsm" || extension === "xlsb") return "macros";
  if (extension !== "xlsx" && extension !== "csv") return "type";
  return file.size > attachmentMaximumBytes ? "tooLarge" : undefined;
}
export function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
