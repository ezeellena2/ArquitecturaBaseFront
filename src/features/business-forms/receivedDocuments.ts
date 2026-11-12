import type { ReceivedDocument, ReceivedDocumentAnswer, ReceivedDocumentCandidate, ReceivedDocumentDetail, ReceivedDocumentEvent, ReceivedDocumentFilterState,
  ReceivedDocumentValue } from "./api/receivedDocuments";

// «Documentos recibidos» (DOC5-A): what the page and its panel decide without the server. The filters are private (an amount, a CUIT,
// a person) and live in the page's memory, never in the address, like the sheet's (`useResponseWorkspace`); the address carries the
// page, its size, the order and the open document.

/** The private filters of the inbox; a form and a person keep their name, for their chip and their closed combo. */
export interface ReceivedDocumentsFilter {
  search?: string;
  state?: Exclude<ReceivedDocumentFilterState, "forReview">;
  form?: { id: string; name: string };
  sender?: { id: string; name: string };
  receivedFromUtc?: string;
  receivedToUtc?: string;
}
export const receivedDocumentSegments = ["proposed", "unclassified", "confirmed", "discarded"] as const;
export const receivedDocumentsPath = "/formularios/documentos";
const guid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isReceivedDocumentId = (value: string | undefined): value is string => !!value && guid.test(value);

/** The server keeps the digits of a search and needs three to look for a number: fewer is a mistake said next to the box. */
export const minimumSearchDigits = 3;
export function searchDigitsMissing(text: string): boolean {
  return text.trim() !== "" && text.replace(/\D/g, "").length < minimumSearchDigits;
}
export const hasReceivedDocumentFilters = (filter: ReceivedDocumentsFilter) =>
  !!filter.search || !!filter.state || !!filter.form || !!filter.sender || !!filter.receivedFromUtc || !!filter.receivedToUtc;

/** How a document's state reads: a proposed one nobody waits for is «Para revisar» (VC1-A, decision 8). */
export type ReceivedDocumentStateLabel = "forReview" | "proposed" | "unclassified" | "confirmed" | "discarded";
export const receivedDocumentStateLabel = (document: Pick<ReceivedDocument, "state" | "forReview">): ReceivedDocumentStateLabel =>
  document.state === "proposed" && document.forReview ? "forReview" : document.state;
export const receivedDocumentStateVariant = (label: ReceivedDocumentStateLabel) =>
  label === "confirmed" ? "success" as const : label === "discarded" ? "danger" as const : label === "proposed" ? "outline" as const : "warning" as const;

/** What a file is, by its media type: the viewer zooms and turns a photo and shows a PDF with the browser's viewer. */
export type ReceivedDocumentKind = "photo" | "pdf" | "word" | "file";
export function receivedDocumentKind(mediaType: string): ReceivedDocumentKind {
  if (mediaType === "image/jpeg" || mediaType === "image/png") return "photo";
  if (mediaType === "application/pdf") return "pdf";
  return mediaType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ? "word" : "file";
}

/**
 * One datum per column (UD): each datum read that the page's documents bring is a column named by its question, in the order they
 * first appear; a document of another form shows «—» there. Two forms that name a datum alike share its column.
 */
export function receivedDocumentDataColumns(items: readonly Pick<ReceivedDocument, "highlights">[]): string[] {
  return [...new Set(items.flatMap(item => item.highlights.map(highlight => highlight.label)))];
}
export const receivedDocumentDatum = (item: Pick<ReceivedDocument, "highlights">, label: string) =>
  item.highlights.find(highlight => highlight.label === label)?.value;

/** The candidate of the document's form, the one its data are reviewed for; without one, the first the reading proposed. */
export function receivedDocumentCandidate(detail: Pick<ReceivedDocumentDetail, "document" | "proposal">): ReceivedDocumentCandidate | null {
  const candidates = detail.proposal?.candidates ?? [];
  const definitionId = detail.document.form?.definitionId.toLowerCase();
  return candidates.find(candidate => candidate.definitionId.toLowerCase() === definitionId) ?? candidates[0] ?? null;
}

/**
 * The forms the panel offers: the ones the server can read it for (only for whoever reviews it), with the document's own first when it
 * is no longer among them, so the list says which one it has. Without any, there is nothing to choose.
 */
export function receivedDocumentForms(detail: Pick<ReceivedDocumentDetail, "document" | "forms">): { definitionId: string; name: string }[] {
  const own = detail.document.form;
  if (detail.forms.length === 0) return [];
  return own && !detail.forms.some(form => form.definitionId.toLowerCase() === own.definitionId.toLowerCase()) ? [own, ...detail.forms] : [...detail.forms];
}

/**
 * What the panel offers with the document, from its state and the server's capability (`canReview`): pass it to its form (a proposed
 * one), choose its form (also an unclassified one), discard it, reopen it, or only read it. Its data are edited only when it waits for
 * the team: a proposed one its person was sent waits for them, and its actions stay in place, off with the reason (VC1-A, decision 8;
 * the backend answers 409).
 */
export interface ReceivedDocumentActions { edit: boolean; pass: boolean; changeForm: boolean; discard: boolean; reopen: boolean; waiting: boolean }
export function receivedDocumentActions(detail: Pick<ReceivedDocumentDetail, "document" | "canReview" | "reading" | "rowCells">): ReceivedDocumentActions {
  const { state, forReview } = detail.document;
  const review = detail.canReview;
  const waiting = review && state === "proposed" && !forReview;
  return {
    edit: review && state === "proposed" && forReview,
    pass: review && state === "proposed",
    changeForm: review && (state === "proposed" || state === "unclassified"),
    discard: review && (state === "proposed" || state === "unclassified"),
    // One that was never read (a rejected file) is not reopened: a change of form needs its reading, so nothing would be left to review.
    // A row's reading is its cells (VC1-A).
    reopen: review && state === "discarded" && (detail.reading !== null || detail.rowCells !== undefined),
    waiting,
  };
}

/**
 * The reviewed data, as the person types or chooses them: a decimal in the menu's format, with a comma in Spanish, as a correction shows
 * it; a choice, the id of its option.
 */
export type ReceivedDocumentDraft = Readonly<Record<string, string>>;
export function receivedDocumentDraft(candidate: ReceivedDocumentCandidate | null, language: string): ReceivedDocumentDraft {
  return Object.fromEntries((candidate?.values ?? []).map(value => [value.fieldId,
    value.value === null ? "" : value.type === "decimal" && language.startsWith("es") ? value.value.replace(".", ",") : value.value]));
}

const decimal = /^[-+]?\d+([.,]\d+)?$/;
const isoDate = /^\d{4}-\d{2}-\d{2}$/;
export type ReceivedDocumentProblem = "required" | "number" | "date";
/** What stops passing it before asking the server: a required datum left empty (also a choice), a number or a date that is not one. */
export function receivedDocumentProblems(candidate: ReceivedDocumentCandidate, draft: ReceivedDocumentDraft): Record<string, ReceivedDocumentProblem> {
  const problems: Record<string, ReceivedDocumentProblem> = {};
  for (const value of candidate.values) {
    const typed = (draft[value.fieldId] ?? "").trim();
    if (typed === "") { if (value.required) problems[value.fieldId] = "required"; continue; }
    if (value.type === "decimal" && !decimal.test(typed)) problems[value.fieldId] = "number";
    if (value.type === "date" && !isoDate.test(typed)) problems[value.fieldId] = "date";
  }
  return problems;
}

/**
 * The answers as the app sends them (the canonical value, a decimal with a dot, the chosen option's id); what was left empty does not
 * go. The document goes attached by the server.
 */
export function receivedDocumentAnswers(candidate: ReceivedDocumentCandidate, draft: ReceivedDocumentDraft): ReceivedDocumentAnswer[] {
  return candidate.values.flatMap(value => {
    const typed = (draft[value.fieldId] ?? "").trim();
    if (typed === "") return [];
    return [{ fieldId: value.fieldId, value: value.type === "decimal" ? typed.replace(",", ".") : typed }];
  });
}
/** Whether the reviewer changed anything read: a pass with the same answers repeats its request (the same UUID). */
export const receivedDocumentAnswersKey = (answers: readonly ReceivedDocumentAnswer[]) => JSON.stringify(answers.map(answer => [answer.fieldId, answer.value]));

/** The control of a datum in the panel, so a problem can take the focus to it. */
export const receivedDocumentFieldId = (fieldId: string) => "received-document-" + fieldId;

/** A datum with a problem, or one a reviewer has to look at, never stays folded under «Ver los N datos más». */
export const receivedDocumentValueNeedsLook = (value: ReceivedDocumentValue) => value.mark === "invalid" || value.mark === "doubtful" || value.mark === "notRead" && value.required;
export const foldedDataLimit = 8;
/**
 * The data in sight: folded, the first eight and any other that needs a look (`attention`, which also counts a problem); unfolded, all
 * of them. `hidden` is how many fold under «Ver los N datos más», and `folds` whether folding hides any (and so «Ver menos datos» does).
 */
export function receivedDocumentShownData<T>(values: readonly T[], expanded: boolean, attention: (value: T) => boolean) {
  const folded = values.filter((value, index) => index < foldedDataLimit || attention(value));
  const folds = folded.length < values.length;
  return expanded || !folds ? { shown: [...values], hidden: 0, folds } : { shown: folded, hidden: values.length - folded.length, folds };
}

/** The fixed validations' text (DOC3), by their code; another code reads as a generic one. */
export function receivedDocumentErrorKey(code: string | null): string {
  return code === "Forms.Record.BankAccountInvalid" ? "marks.bankAccount" : code === "Forms.Record.TaxIdInvalid" ? "marks.taxId" : "marks.invalid";
}

/**
 * Why a document is where it is, when that is not obvious from its state: what the reading or the person decided, who discarded it,
 * where the same document already is. Null when its state says it all.
 */
export type ReceivedDocumentReason = { key: string; values?: Record<string, string> } | null;
// The steps that decide who a document waits for; a change of form that failed leaves it as it was.
const waitingSteps = new Set<ReceivedDocumentEvent["kind"]>(["received", "formChosen", "choseOther", "reopened", "formChanged", "discarded", "confirmed", "overLimit"]);
export function receivedDocumentReason(detail: Pick<ReceivedDocumentDetail, "document" | "reading" | "proposal" | "history">, unknownPerson: string): ReceivedDocumentReason {
  const { state, reasonCode, forReview, sender } = detail.document;
  const person = sender.displayName ?? unknownPerson;
  // For the team because its form could not be sent to its person, or because what they were sent (the form, or the forms of a doubt)
  // expired; brought back or read for another form by someone of the team, its state says it all.
  if (state === "proposed" && forReview) {
    const last = [...detail.history].reverse().find(event => waitingSteps.has(event.kind));
    if (last?.kind === "received" && last.detail === "notSendable") return { key: "reasons.forReviewNotSendable", values: { person } };
    // VC1-A: a row past the three loads of its message waits for the team from the start: nothing expired.
    if (last?.kind === "overLimit") return { key: "reasons.forReviewOverLimit" };
    return last?.kind === "formChosen" || last?.kind === "received" && (last.detail === "sure" || last.detail === "doubt") ? { key: "reasons.forReviewExpired", values: { person } } : null;
  }
  if (state === "unclassified") return { key: reasonCode === "quota" ? "reasons.quota" : reasonCode === "other" ? "reasons.other" : "reasons.unknown" };
  if (state !== "discarded") return null;
  if (reasonCode === "reviewer") {
    const discarded = [...detail.history].reverse().find(event => event.kind === "discarded");
    return discarded?.actor?.displayName ? { key: "reasons.reviewerBy", values: { person: discarded.actor.displayName } } : { key: "reasons.reviewer" };
  }
  if (reasonCode === "duplicate") {
    const repetition = detail.proposal?.repetition;
    return repetition?.recordNumber ? { key: "reasons.duplicateOf", values: { number: repetition.recordNumber } } : { key: "reasons.duplicate" };
  }
  if (reasonCode === "unreadable") return { key: "reasons.unreadable." + (detail.reading?.problem ?? "other") };
  return { key: ["protected", "legacy", "macroEnabled", "tooLarge", "tooManyPages", "empty"].includes(reasonCode ?? "") ? "reasons." + reasonCode : "reasons.notOpened" };
}

const refusedCode = "Forms.ReceivedDocument.ExtractionRefused";
/**
 * A step of the history, as the person reads it: what happened (with the form or the response it names) and who did it below. A change
 * of form the engine refused names the form asked for in the step that asked for it (`earlier`, the steps before it). A row sent as one of
 * the loads of its spreadsheet («{i}/{k}», VC1-A) names the person it was sent to: the one who sent it (`sender`).
 */
export function receivedDocumentEventKey(event: ReceivedDocumentEvent, earlier: readonly ReceivedDocumentEvent[] = [], sender = ""): { key: string; values?: Record<string, string> } {
  switch (event.kind) {
    case "received": return { key: "history.received." + (["sure", "doubt", "unknown", "unreadable", "duplicate", "notSendable", "quota", "rejected"].includes(event.detail ?? "") ? event.detail : "other") };
    case "extractionRequested": return event.detail ? { key: "history.extractionRequested", values: { form: event.detail } } : { key: "history.extractionRequestedOther" };
    case "formChanged": return event.detail ? { key: "history.formChanged", values: { form: event.detail } } : { key: "history.formChangedOther" };
    case "extractionFailed": {
      if (event.detail !== refusedCode) return { key: "history.extractionFailed" };
      const asked = [...earlier].reverse().find(step => step.kind === "extractionRequested")?.detail;
      return asked ? { key: "history.extractionRefused", values: { form: asked } } : { key: "history.extractionRefusedOther" };
    }
    case "confirmed": return event.detail ? { key: "history.confirmed", values: { number: event.detail } } : { key: "history.confirmedOther" };
    case "sent": {
      const [position = "", total = ""] = event.detail?.split("/") ?? [];
      return { key: "history.sent", values: { person: sender, position, total } };
    }
    default: return { key: "history." + event.kind };
  }
}

/** Why a change of form ended without one: the form was not recognized, the engine refused it, or something else the server named. */
export const receivedDocumentExtractionFailureKey = (code: string | null) =>
  code === "Forms.ReceivedDocument.Unrecognized" ? "extraction.unrecognized" : code === refusedCode ? "extraction.refused" : "extraction.failed";
