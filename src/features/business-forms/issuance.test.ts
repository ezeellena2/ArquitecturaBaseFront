import { describe, expect, it } from "vitest";
import type { ResponseAction, ResponseWorkflow } from "./api/workflow";
import { awaitingConfirmationCode, responseIssuance } from "./issuance";

// Synthetic flows: what the zone «Comprobante» reads from the actions of a response (EM1-A, EM2-A and NC1-A).
const id = (value: number) => "0199a0c0-0000-7000-8000-" + String(value).padStart(12, "0");
const recordId = id(1);
const action = (value: number, changes: Partial<ResponseAction>): ResponseAction => ({
  id: id(value), ruleId: id(90), kind: "IssueDocument", event: "Received", order: 0, revision: 1, state: "Running", reasonCode: null, reason: null,
  canConsult: false, canRetry: false, recipients: [], createdAtUtc: "2026-11-09T12:00:00Z", updatedAtUtc: "2026-11-09T12:00:00Z", completedAtUtc: null, ...changes,
});
const flow = (actions: ResponseAction[], changes: Partial<ResponseWorkflow> = {}): ResponseWorkflow =>
  ({ recordId, recordState: "Received", ruleRevision: 1, task: null, actions, documents: [], ...changes });

describe("the issuance of a response", () => {
  it("says nothing without an issuance, nor when its rule did not apply", () => {
    expect(responseIssuance(undefined).band).toBeNull();
    expect(responseIssuance(flow([action(2, { kind: "GeneratePdf", state: "Completed" })])).band).toBeNull();
    expect(responseIssuance(flow([action(2, { state: "NotApplicable" })])).band).toBeNull();
  });

  it("reads each state of the issuance as a stage of the zone", () => {
    expect(responseIssuance(flow([action(2, { state: "Waiting" })])).band?.stage).toBe("issuing");
    expect(responseIssuance(flow([action(2, { state: "Running" })])).band?.stage).toBe("issuing");
    // «En cola»: in flight while the issuer did not answer, with when it tries again; still live, so it is not corrected.
    const queued = responseIssuance(flow([action(2, { state: "Running", nextAttemptAtUtc: "2026-11-11T13:45:00Z", attempts: 3 })]));
    expect(queued).toMatchObject({ live: true, band: { stage: "queued" } });
    expect(responseIssuance(flow([action(2, { state: "Completed" })])).band?.stage).toBe("issued");
    expect(responseIssuance(flow([action(2, { state: "Failed", reasonCode: "wsfe.10015" })])).band?.stage).toBe("failed");
    expect(responseIssuance(flow([action(2, { state: "Uncertain", reasonCode: "issuer.numberTaken" })])).band?.stage).toBe("review");
    expect(responseIssuance(flow([action(2, { state: "Uncertain", reasonCode: awaitingConfirmationCode })])).band?.stage).toBe("awaiting");
  });

  it("is live while issued, in flight or in review, and voiding it issues a credit note only once issued", () => {
    for (const state of ["Waiting", "Running", "Uncertain", "Completed"] as const) expect(responseIssuance(flow([action(2, { state })])).live).toBe(true);
    expect(responseIssuance(flow([action(2, { state: "Failed" })])).live).toBe(false);
    expect(responseIssuance(flow([action(2, { state: "Completed" })])).issued).toBe(true);
    expect(responseIssuance(flow([action(2, { state: "Running" })])).issued).toBe(false);
  });

  it("gives the summary of «¿La emito?» only for the issuance that waits for it", () => {
    const confirmation = { runId: id(2), document: { es: "Factura C", en: "Invoice C" }, receiver: "Agro del Sur S.A.", total: "605500" };
    expect(responseIssuance(flow([action(2, { state: "Uncertain", reasonCode: awaitingConfirmationCode })], { confirmation })).confirmation).toEqual(confirmation);
    expect(responseIssuance(flow([action(2, { state: "Running" })], { confirmation })).confirmation).toBeNull();
    expect(responseIssuance(flow([action(3, { state: "Uncertain", reasonCode: awaitingConfirmationCode })], { confirmation })).confirmation).toBeNull();
    // Whoever only loads reads no actions, and the summary is still theirs.
    expect(responseIssuance(flow([], { confirmation }))).toMatchObject({ band: null, confirmation });
  });

  it("is voiding while its reversal is in flight, and the zone reads the reversal", () => {
    const issued = action(2, { state: "Completed" });
    const voiding = responseIssuance(flow([issued, action(3, { event: "Voided", state: "Running" })]));
    expect(voiding).toMatchObject({ voiding: true, live: true, band: { stage: "issuing", reversal: true } });
    expect(voiding.fiscalRunIds).toEqual(new Set([id(2), id(3)]));
    expect(responseIssuance(flow([issued, action(3, { event: "Voided", state: "Uncertain", reasonCode: "issuer.numberTaken" })])))
      .toMatchObject({ voiding: true, band: { stage: "review", reversal: true } });
  });

  it("keeps the issuance with the notice of the reversal that did not go out, and the last reversal counts", () => {
    const issued = action(2, { state: "Completed" });
    const failed = responseIssuance(flow([issued, action(3, { event: "Voided", state: "Failed", reasonCode: "wsfe.10016" })]));
    expect(failed).toMatchObject({ voiding: false, live: true, issued: true, band: { stage: "failed", reversal: true } });
    const again = responseIssuance(flow([issued, action(3, { event: "Voided", state: "Failed" }), action(4, { event: "Voided", state: "Waiting" })]));
    expect(again).toMatchObject({ voiding: true, band: { stage: "issuing", reversal: true, action: { id: id(4) } } });
  });

  it("is no longer live nor voiding once the reversal voided the response", () => {
    const done = responseIssuance(flow([action(2, { state: "Completed" }), action(3, { event: "Voided", state: "Completed" })], { recordState: "Voided" }));
    expect(done).toMatchObject({ voiding: false, live: false, band: { stage: "issued", reversal: true } });
  });
});
