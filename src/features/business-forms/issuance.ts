import type { ResponseAction, ResponseIssueConfirmation, ResponseWorkflow } from "./api/workflow";

/** The code of an issuance that waits for whoever loaded the response to confirm it («¿La emito?», EM2-A). */
export const awaitingConfirmationCode = "Forms.Action.AwaitingConfirmation";
/** The code of an issuance a person decided not to issue: nothing went out, and there is nothing to correct. */
export const notIssuedCode = "Forms.Action.NotIssued";

/**
 * What the zone «Comprobante» says (EM1-A and NC1-A): the run it reads, how it stands and whether it is the reversal that voids
 * it. `issuing` is Waiting or Running; `awaiting`, the confirmation of whoever loaded it; `review`, an issuance a person decides.
 */
export type IssuanceStage = "awaiting" | "issuing" | "issued" | "failed" | "review";
export interface IssuanceBand { readonly stage: IssuanceStage; readonly action: ResponseAction; readonly reversal: boolean }

export interface ResponseIssuance {
  /** The issuance that counts: the last «IssueDocument» of a rule that applied. */
  readonly issue: ResponseAction | null;
  /** Its last reversal (event «Voided»), when the response is being or was voided. */
  readonly reversal: ResponseAction | null;
  readonly band: IssuanceBand | null;
  /** The summary of «¿La emito?», only for whoever loaded it and only while the issuance waits for them. */
  readonly confirmation: ResponseIssueConfirmation | null;
  /** Issued, in flight or in review: the server refuses to correct it (`Forms.Record.IssuedNotAmendable`). */
  readonly live: boolean;
  /** Issued: voiding it issues a credit note. */
  readonly issued: boolean;
  /** Its reversal is in flight: the title says «Anulándose» and voiding again is refused (`Forms.Record.Voiding`). */
  readonly voiding: boolean;
  /** The runs whose documents are the fiscal PDF, the issued one and its credit note. */
  readonly fiscalRunIds: ReadonlySet<string>;
}

const inFlight = (action: ResponseAction) => action.state === "Waiting" || action.state === "Running" || action.state === "Uncertain";

function stageOf(action: ResponseAction): IssuanceStage | null {
  switch (action.state) {
    case "Waiting": case "Running": return "issuing";
    case "Completed": return "issued";
    case "Failed": return "failed";
    case "Uncertain": return action.reasonCode === awaitingConfirmationCode ? "awaiting" : "review";
    default: return null;
  }
}

/** How the issuance of a response stands, from its flow; without an «IssueDocument» there is nothing to say. */
export function responseIssuance(workflow: ResponseWorkflow | undefined): ResponseIssuance {
  const issuances = workflow?.actions.filter(action => action.kind === "IssueDocument") ?? [];
  const issue = issuances.filter(action => action.event !== "Voided" && action.state !== "NotApplicable").at(-1) ?? null;
  const reversal = issuances.filter(action => action.event === "Voided" && action.state !== "NotApplicable").at(-1) ?? null;
  // A reversal that did not go out leaves the issuance as it was, with its notice («No se pudo anular»).
  const shown = reversal ?? issue;
  const stage = shown ? stageOf(shown) : null;
  const band = shown && stage ? { stage, action: shown, reversal: shown === reversal } : null;
  const voided = workflow?.recordState === "Voided" || reversal?.state === "Completed";
  // Whoever only loads (CW6-C) reads no actions, but the summary still comes for them: it is theirs to decide.
  const confirmation = workflow?.confirmation ?? null;
  return {
    issue, reversal, band,
    confirmation: confirmation && (!issue || confirmation.runId === issue.id && band?.stage === "awaiting") ? confirmation : null,
    live: !!issue && !voided && (issue.state === "Completed" || inFlight(issue)),
    issued: issue?.state === "Completed",
    voiding: !!reversal && !voided && inFlight(reversal),
    fiscalRunIds: new Set(issuances.map(action => action.id)),
  };
}
