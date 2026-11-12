import type { ThreadMessageLike } from "@assistant-ui/react";
import type {
  AssistantBootstrap,
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
  documentRequestId?: string,
): AssistantSubmit {
  return Object.freeze({
    requestId,
    question: question.replaceAll("\r\n", "\n").trim(),
    expectedConnectionRevision: connectionRevision,
    conversationId: conversation?.id ?? null,
    expectedRevision: conversation?.revision ?? null,
    // Only a dictated turn names its recording, and only the turn of a photo or a PDF its reading: the others keep their body.
    ...(audioRequestId ? { audioRequestId } : {}),
    ...(documentRequestId ? { documentRequestId } : {}),
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
/** The most a file may weigh, as the server reads it: a spreadsheet (Stage 2) or a document (Stage 3). */
export const attachmentMaximumBytes = 10 * 1024 * 1024;
/** What this person may attach in Home, as the bootstrap says it: a spreadsheet (Stage 2), a Word, and also a photo or a PDF that
 *  the server reads before the turn (Stage 3). The front never repeats the permissions or what the installation reads. */
export interface AttachmentKinds {
  readonly spreadsheets: boolean;
  readonly word: boolean;
  readonly reading: boolean;
}
export const attachmentKinds = (bootstrap: Pick<AssistantBootstrap, "attachments" | "documents" | "documentReading">): AttachmentKinds => ({
  spreadsheets: bootstrap.attachments ?? false,
  word: bootstrap.documents ?? false,
  reading: bootstrap.documentReading ?? false,
});
export const canAttach = (kinds: AttachmentKinds) => kinds.spreadsheets || kinds.word || kinds.reading;
/** A file as Home names it: from its extension in the composer, or from the kind the server read in a message. */
export type AttachmentFileKind = "pdf" | "photo" | "docx" | "xlsx" | "csv";
const fileKinds: Readonly<Record<string, AttachmentFileKind>> = { pdf: "pdf", jpg: "photo", jpeg: "photo", png: "photo", docx: "docx", xlsx: "xlsx", csv: "csv" };
export const fileKind = (kindOrExtension: string): AttachmentFileKind | undefined => Object.hasOwn(fileKinds, kindOrExtension) ? fileKinds[kindOrExtension] : undefined;
/** The kinds the clip takes, in the order the picker and the reason of another type name them. */
export function acceptedFileKinds(kinds: AttachmentKinds): readonly AttachmentFileKind[] {
  return [...(kinds.reading ? ["pdf", "photo"] as const : []), ...(kinds.word ? ["docx"] as const : []), ...(kinds.spreadsheets ? ["xlsx", "csv"] as const : [])];
}
const extensions: Readonly<Record<AttachmentFileKind, string>> = { pdf: ".pdf", photo: ".jpg,.jpeg,.png", docx: ".docx", xlsx: ".xlsx", csv: ".csv" };
/** What the picker offers: the server reads the kind from the bytes, never from this. */
export const attachmentAccept = (kinds: AttachmentKinds) => acceptedFileKinds(kinds).map(kind => extensions[kind]).join(",");
/** A photo or a PDF is read before its turn, under its own request; a spreadsheet or a Word goes with the turn. */
export const readsFirst = (name: string) => ["pdf", "photo"].includes(fileKind(fileExtension(name)) ?? "");
export type AttachmentProblem = "legacy" | "macros" | "legacyWord" | "macrosWord" | "type" | "tooLarge" | "tooLargeDocument";
/** What the browser can see does not serve before sending a file: an old Excel or Word, one with macros, a type the clip does not
 *  take or more than the limit. The server reads the kind from the bytes and says the rest (with a password, unreadable, empty, more
 *  than ten pages). An old or macro-enabled file of a kind this person cannot attach is just another type. */
export function attachmentProblem(file: { readonly name: string; readonly size: number }, kinds: AttachmentKinds): AttachmentProblem | undefined {
  const extension = fileExtension(file.name);
  if (kinds.spreadsheets && extension === "xls") return "legacy";
  if (kinds.spreadsheets && (extension === "xlsm" || extension === "xlsb")) return "macros";
  if (kinds.word && extension === "doc") return "legacyWord";
  if (kinds.word && extension === "docm") return "macrosWord";
  const kind = fileKind(extension);
  if (!kind || !acceptedFileKinds(kinds).includes(kind)) return "type";
  if (file.size <= attachmentMaximumBytes) return undefined;
  return kind === "xlsx" || kind === "csv" ? "tooLarge" : "tooLargeDocument";
}
/** The weight a file over the limit says it has: rounded up to the next tenth of a megabyte, so a byte over 10 MB never reads as
 *  «10 MB», the limit itself. Dividing by the megabyte, a power of two, keeps a whole number of tenths exact. */
export const roundUpToTenthOfMegabyte = (bytes: number) => Math.ceil(bytes * 10 / (1024 * 1024)) * (1024 * 1024) / 10;
export function fileExtension(name: string) {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : "";
}
