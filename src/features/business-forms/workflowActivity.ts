import type { TFunction } from "i18next";
import { formatDateInZone, formatTimeInZone } from "@/shared/lib/dateTime";
import type { ResponseDetail } from "./api/responses";
import type { ResponseAction, ResponseRecipient, ResponseWorkflow } from "./api/workflow";
import { approvalStateVariant } from "./approvals";
import { workflowCanRetryRecipient, workflowCanReview, workflowNextAction } from "./workflow";
import { recordEventKey } from "./workflowHistory";
import { composeWorkflowMoments } from "./workflowMoments";

type IssuedDocument = ResponseWorkflow["documents"][number];
type RecordEvent = ResponseDetail["history"][number];
type ApprovalTask = NonNullable<ResponseWorkflow["task"]>;
export type ActivityTone = "success" | "danger" | "warning" | "outline";
/** What can be done from a row, drawn as an icon in «Acciones»: a copy's Ver PDF and Descargar, Consultar or Reintentar an action,
 * Resolver envío of a person and Reintentar the notice to that person (RT1-A). */
export type ActivityAction =
  | { kind: "document"; document: IssuedDocument }
  | { kind: "consult"; action: ResponseAction }
  | { kind: "retry"; action: ResponseAction }
  | { kind: "review"; action: ResponseAction; recipient: ResponseRecipient }
  | { kind: "retryRecipient"; action: ResponseAction; recipient: ResponseRecipient };
/** One thing that happened, a datum per column (VF2-A): Fecha, Hora, Qué pasó, Quién, Canal, Detalle, Estado and Acciones. */
export interface ActivityRow {
  readonly key: string;
  readonly atUtc: string;
  readonly date: string;
  readonly time: string;
  readonly what: string;
  /** The (i) next to «Qué pasó»: a human review does not confirm the delivery. */
  readonly whatHint: string | null;
  readonly who: string;
  readonly channel: string;
  /** The only cell that may take several lines: a whole reason, a file, what the person shared. */
  readonly detail: string;
  readonly state: string;
  readonly tone: ActivityTone | null;
  readonly actions: readonly ActivityAction[];
}
/** A moment («Al recibirla», «Aprobación», «Al aprobarla»…): a row that separates, not a datum. */
export interface ActivityBand { readonly key: string; readonly title: string; readonly rows: readonly ActivityRow[] }
export interface ActivityFormat { readonly t: TFunction<"forms">; readonly language: string; readonly timeZoneId?: string; readonly canManage: boolean }

/** What does not apply to a row says so in its cell. */
export const activityEmpty = "—";

interface Fact {
  key: string; atUtc: string; what: string; whatHint?: string; who?: string | null; channel?: string | null; detail?: string | null;
  state?: { text: string; tone: ActivityTone } | null; actions?: ActivityAction[];
}

const actionTone = (state: ResponseAction["state"]): ActivityTone => state === "Completed" ? "success" : state === "Failed" ? "danger" : state === "Uncertain" ? "warning" : "outline";
const recipientTone = (state: ResponseRecipient["state"]): ActivityTone => state === "Failed" ? "danger" : state === "Uncertain" ? "warning" : "outline";

/**
 * The activity of a response, row by row (VF2-A, decision 7): a row per event of the response, per PDF, per person of a notice, per
 * human review and per request to consult or retry, each in its moment and in the order they happened. Nothing goes under another
 * datum: who and the channel have their columns, and «Detalle» keeps the whole reason of a rejection, a correction or a void.
 */
export function workflowActivity(record: ResponseDetail, workflow: ResponseWorkflow | undefined, { t, language, timeZoneId, canManage }: ActivityFormat): ActivityBand[] {
  const data = workflow?.recordId === record.id ? workflow : undefined;
  const unknown = t("responses.unknownPerson");
  const app = t("formEntries:sheet.channels.app");
  const channelOf = (channelId: string | null | undefined) => channelId === "app" ? app : channelId === "phone" ? t("responses.whatsapp") : null;
  const nameOf = (author: { displayName: string | null } | null | undefined) => author ? author.displayName ?? unknown : null;
  const menu = language.startsWith("en") ? "en" : "es";

  // W3 (UC2, UC3): what the person shared says which questions it completed, «A» y «B» like the rest of the texts.
  const filled = (questions: readonly string[]) => t("responses.historyFilled", {
    questions: new Intl.ListFormat(language, { type: "conjunction" }).format(questions.map(question => t("responses.historyQuestion", { question }))) });
  const sender = record.origin?.senderKind === "Assistant" ? t("detail.assistant") : null;
  const recordFact = (event: RecordEvent): Fact => ({
    key: recordEventKey(record.history, event), atUtc: event.atUtc, what: t("responses.history" + event.kind),
    // The form that came back is the same send: it does not repeat who sent it. The assistant sends without a person (W1-A), and
    // what the person shared in the chat comes from whoever answers it, who loaded the response.
    who: event.kind === "SentAgain" ? null : event.actor ? nameOf(event.actor) : event.kind === "Submitted" ? unknown
      : event.kind === "Sent" || event.kind === "LocationRequested" ? sender
      : event.kind === "LocationReceived" || event.kind === "LocationSkipped" || event.kind === "ContactReceived" ? nameOf(record.actor) : null,
    channel: event.kind === "Saved" ? null : channelOf(event.kind === "Submitted" ? record.channel : record.origin?.channelId),
    detail: "questions" in event && event.questions ? filled(event.questions) : null,
  });
  // VC1-A: a response that came from a row of a spreadsheet starts when its spreadsheet arrived, with the file and the row.
  const source = record.origin?.document;
  const spreadsheet: Fact[] = source?.row ? [{ key: "origin:spreadsheet", atUtc: source.row.receivedAtUtc, what: t("responses.historySpreadsheet"),
    detail: t(source.row.sheet === null ? "responses.historySpreadsheetRow" : "responses.historySpreadsheetSheetRow", { name: source.name, number: String(source.row.number), sheet: source.row.sheet ?? "" }) }] : [];

  // The state goes once: on the request while it waits, and then on the decision, with who decided and the whole reason.
  const approvalFacts = (task: ApprovalTask): Fact[][] => [
    [{ key: "request:" + task.id, atUtc: task.requestedAtUtc, what: t("detail.approvalRequested"),
      detail: task.roleName ? t("detail.role", { role: task.roleName }) : t("rules.unavailableRole"),
      state: task.state === "Open" ? { text: t("approvals.taskStates.Open"), tone: approvalStateVariant("Open") } : null }],
    ...(task.state !== "Open" && task.decidedAtUtc ? [[{ key: "decision:" + task.id, atUtc: task.decidedAtUtc, what: t(task.state === "Approved" ? "detail.approved" : "detail.rejected"),
      who: nameOf(task.decidedBy) ?? unknown, channel: app, detail: task.reason, state: { text: t("approvals.taskStates." + task.state), tone: approvalStateVariant(task.state) } }]] : []),
  ];

  // The PDFs of «Armar el PDF» and the people of a notice tell a finished action on their own; any other action keeps its row,
  // with its state, its reason and Consultar or Reintentar. Each person goes with their human review, and the action with who
  // asked last to consult or retry it.
  const actionFacts = (action: ResponseAction): Fact[] => {
    const atUtc = action.completedAtUtc ?? action.updatedAtUtc;
    const next = canManage ? workflowNextAction(action) : null;
    const documents = data?.documents.filter(document => document.runId === action.id) ?? [];
    const told = action.state === "Completed" && !action.reason
      && (action.kind === "GeneratePdf" ? documents.length > 0 : (action.kind === "NotifyAuthor" || action.kind === "NotifyRole") && action.recipients.length > 0);
    const facts: Fact[] = told ? [] : [{ key: "action:" + action.id, atUtc, what: t("rules.actions." + action.kind), detail: action.reason,
      state: { text: t("workflow.states." + action.state), tone: actionTone(action.state) }, actions: next ? [{ kind: next, action }] : [] }];
    for (const document of documents) facts.push({ key: "document:" + document.id, atUtc: document.createdAtUtc,
      // NI1-A (2026-11-03): only a copy in the other language names it.
      what: document.culture === menu ? t("detail.pdfMade") : t("detail.pdfMadeIn", { language: t("cultureNamesInText." + document.culture) }),
      detail: document.name, state: { text: t("workflow.states.Completed"), tone: "success" }, actions: [{ kind: "document", document }] });
    for (const recipient of action.recipients) {
      const control = !canManage ? null : workflowCanReview(recipient) ? "review" as const : workflowCanRetryRecipient(recipient) ? "retryRecipient" as const : null;
      // The receipts of WhatsApp are the state of the person's row.
      const state = recipient.readAtUtc ? { text: t("workflow.read"), tone: "outline" as const } : recipient.deliveredAtUtc ? { text: t("workflow.delivered"), tone: "outline" as const }
        : { text: t("workflow.recipientStates." + recipient.state), tone: recipientTone(recipient.state) };
      facts.push({ key: "recipient:" + action.id + ":" + recipient.user.userId, atUtc, what: t(action.kind === "NotifyAuthor" ? "detail.authorNotified" : "detail.notified"),
        who: nameOf(recipient.user), channel: channelOf(recipient.channelId), detail: recipient.reason, state, actions: control ? [{ kind: control, action, recipient }] : [] });
      if (recipient.review) facts.push({ key: "review:" + action.id + ":" + recipient.user.userId, atUtc: recipient.review.reviewedAtUtc,
        what: t(recipient.review.wasSent ? "detail.reviewedSent" : "detail.reviewedNotSent"), whatHint: t("workflow.humanReviewHint"), who: nameOf(recipient.review.reviewedBy), channel: app });
    }
    if (action.lastRequest) facts.push({ key: "lastRequest:" + action.id, atUtc: action.lastRequest.atUtc, what: t("detail.requested." + action.lastRequest.kind),
      who: nameOf(action.lastRequest.by) ?? unknown, channel: app });
    return facts;
  };

  const bands: { key: string; title: string; groups: Fact[][] }[] = [];
  const band = (key: string, title: string) => {
    let found = bands.find(item => item.key === key);
    if (!found) bands.push(found = { key, title, groups: [] });
    return found.groups;
  };
  // What was done on receipt goes with the response itself, under «Al recibirla»; the correction that made this version is how it
  // was received. How the version it replaced ended belongs to that version: the moments above tell it (CW10-A).
  for (const moment of composeWorkflowMoments(record, data)) {
    if (moment.kind === "received") band("Received", t("detail.events.Received")).push(...(spreadsheet.length ? [spreadsheet] : []), ...moment.history.map(event => [recordFact(event)]));
    else if (moment.kind === "corrected") band("Received", t("detail.events.Received")).push([{ key: "correction:" + record.id, atUtc: moment.correction.atUtc,
      what: t("formEntries:correction.saved", { number: record.number }), who: nameOf(moment.correction.by), channel: app, detail: moment.correction.reason }]);
    else if (moment.kind === "approval") band("approval", t("detail.approvalBand")).push(...approvalFacts(moment.task));
    else if (moment.kind === "effects") band(moment.event, t("detail.events." + moment.event)).push(...moment.actions.map(actionFacts));
    else if (moment.kind === "voided") band("Voided", t("detail.events.Voided")).push([{ key: "void:" + record.id, atUtc: moment.atUtc, what: t("detail.voided", { number: record.number }),
      who: nameOf(moment.by), channel: app, detail: moment.reason, state: { text: t("approvals.states.Voided"), tone: approvalStateVariant("Voided") } }]);
  }
  const row = (fact: Fact): ActivityRow => ({
    key: fact.key, atUtc: fact.atUtc, date: formatDateInZone(fact.atUtc, language, timeZoneId), time: formatTimeInZone(fact.atUtc, language, timeZoneId),
    what: fact.what, whatHint: fact.whatHint ?? null, who: fact.who || activityEmpty, channel: fact.channel || activityEmpty, detail: fact.detail || activityEmpty,
    state: fact.state?.text ?? activityEmpty, tone: fact.state?.tone ?? null, actions: fact.actions ?? [],
  });
  // Inside a moment, in the order they happened; an action keeps its PDFs, its people and its requests together.
  const instant = (group: Fact[]) => Date.parse(group[0].atUtc);
  return bands.map(item => ({ key: item.key, title: item.title,
    rows: item.groups.filter(group => group.length > 0).sort((left, right) => instant(left) - instant(right)).flat().map(row) }));
}
