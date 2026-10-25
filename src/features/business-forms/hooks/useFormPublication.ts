
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { acceptFormPublication, fetchFormPublication } from "../api/forms";
import { UnsupportedFormResponse, publicationPath, type FormPublicationProjection, type FormPublicationCheck, type FormPublicationReceipt, type FormPublicationStatus } from "../api/response";
import type { DraftEditorValue, FormPublicationWriteBody } from "../model";
import { canReadForms, type FormReadScope } from "./useFormQueries";

type Phase = "Idle" | "Accepting" | "Unconfirmed" | "Accepted" | "Rejected";
interface Attempt { readonly definitionId: string; readonly body: FormPublicationWriteBody }
type ResumeReference = NonNullable<FormPublicationProjection["currentOperation"]> & { definitionId: string; requestId: string };
interface PublicationSession { phase: Phase; attempt: Attempt | null; reference: ResumeReference | null; receipt: FormPublicationReceipt | null;
  status: FormPublicationStatus | null; error: unknown; busy: boolean; canReplay: boolean }
const empty = (): PublicationSession => ({ phase: "Idle", attempt: null, reference: null, receipt: null, status: null, error: null, busy: false, canReplay: false });
// The attempt belongs to the actor's editor, which keeps it when the menu language changes.
const stampFor = (scope: FormReadScope) => JSON.stringify([scope.actorId]);
const rejectedCodes = new Set(["Forms.Publication.CheckExpired", "Forms.Publication.InProgress", "Forms.Publication.DraftMustBeSaved", "Forms.Draft.RevisionConflict"]);
// Request body and bearer ticket live only in this editor owner. No mutation cache, storage, URL, or automatic POST retry.
export function useFormPublication(scope: FormReadScope) {
  const stamp = stampFor(scope);
  const [owner] = useState(stamp);
  const context = useRef(stamp);
  const allowed = canReadForms(scope) && scope.permissions.includes("formtemplates.publish");
  const access = useRef(allowed);
  const active = useRef(false);
  const flight = useRef<AbortController | null>(null);
  const current = useRef<PublicationSession>(empty());
  const [session, setSession] = useState<PublicationSession>(empty);
  const owns = owner === stamp && allowed;
  if (!owns && session.phase !== "Idle") setSession(empty());
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; const controller = flight.current; flight.current = null; controller?.abort();
      queueMicrotask(() => { if (!active.current) current.current = empty(); }); };
  }, []);
  useEffect(() => {
    context.current = stamp; access.current = allowed;
    if (stamp !== owner || !allowed) current.current = empty();
    return () => { const controller = flight.current; flight.current = null; controller?.abort(); };
  }, [stamp, owner, allowed]);
  const update = useCallback((next: PublicationSession) => { current.current = next; setSession(next); }, []);
  const alive = useCallback((controller: AbortController) => active.current && access.current && context.current === owner && !controller.signal.aborted, [owner]);
  const write = useCallback(async (attempt: Attempt) => {
    if (!owns || !active.current || flight.current) return;
    const controller = new AbortController(); flight.current = controller;
    update({ ...empty(), phase: "Accepting", attempt, error: null, busy: true, canReplay: false });
    try {
      const receipt = await acceptFormPublication(attempt.definitionId, attempt.body, controller.signal);
      if (!alive(controller)) return;
      update({ ...current.current, phase: "Accepted", receipt, error: null, busy: false, canReplay: false });
      return receipt;
    } catch (error) {
      if (!alive(controller)) return;
      if (error instanceof ApiError && error.status === 401) { update(empty()); return; }
      const definitive = error instanceof ApiError && (error.status === 400 || error.status === 409 && rejectedCodes.has(error.code ?? ""));
      update({ ...current.current, phase: definitive ? "Rejected" : "Unconfirmed", error, busy: false, canReplay: false });
    } finally { if (flight.current === controller) flight.current = null; }
  }, [owns, alive, update]);
  const accept = useCallback(async (id: string, body: DraftEditorValue & { expectedRevision: number }, checked: FormPublicationCheck) => {
    if (!owns || flight.current || !(current.current.phase === "Idle" || current.current.phase === "Accepted" && ["Published", "Failed"].includes(current.current.status?.state ?? ""))
      || !checked.canAccept || !checked.checkToken || !checked.checkExpiresAtUtc || Date.parse(checked.checkExpiresAtUtc) <= Date.now()
      || checked.definitionId.toLowerCase() !== id.toLowerCase() || checked.draftRevision !== body.expectedRevision) return;
    const attempt = { definitionId: id, body: structuredClone({ name: body.name, prefix: body.prefix, draft: body.draft, expectedRevision: body.expectedRevision, requestId: crypto.randomUUID(), checkToken: checked.checkToken }) };
    return write(attempt);
  }, [owns, write]);
  const consult = useCallback(async () => {
    const attempt = current.current.attempt;
    const reference = current.current.reference;
    const identity = attempt ? { definitionId: attempt.definitionId, requestId: attempt.body.requestId, draftRevision: attempt.body.expectedRevision } : reference;
    if (!owns || !active.current || flight.current || !identity || !["Accepted", "Unconfirmed"].includes(current.current.phase)) return;
    const controller = new AbortController(); flight.current = controller;
    update({ ...current.current, error: null, busy: true, canReplay: false });
    try {
      const status = await fetchFormPublication(identity.definitionId, identity.requestId, controller.signal);
      if (!alive(controller)) return;
      const old = current.current.status ?? current.current.receipt;
      if (status.draftRevision !== identity.draftRevision || reference && (reference.versionId !== status.versionId || reference.versionNumber !== status.versionNumber) || old && (old.versionId !== status.versionId
        || old.operationId !== status.operationId || old.versionNumber !== status.versionNumber)) throw new UnsupportedFormResponse();
      if (current.current.status?.state === "Published" && status.state !== "Published") throw new UnsupportedFormResponse();
      if (current.current.status && Date.parse(status.updatedAtUtc) < Date.parse(current.current.status.updatedAtUtc)) {
        update({ ...current.current, busy: false }); return;
      }
      update({ ...current.current, phase: "Accepted", status, error: null, busy: false, canReplay: false });
      return status;
    } catch (error) {
      if (!alive(controller)) return;
      if (error instanceof ApiError && error.status === 401) { update(empty()); return; }
      const missing = error instanceof ApiError && error.status === 404 && error.code === "Forms.Publication.NotFound";
      update({ ...current.current, error, busy: false, canReplay: current.current.phase === "Unconfirmed" && missing });
    } finally { if (flight.current === controller) flight.current = null; }
  }, [owns, alive, update]);
  const resume = useCallback(async (definitionId: string, projection: FormPublicationProjection) => {
    const operation = projection.currentOperation;
    if (!owns || !active.current || flight.current || !operation?.requestId
      || operation.recoveryPath !== publicationPath(definitionId, operation.requestId)) return;
    if (current.current.phase === "Idle") {
      update({ ...empty(), phase: "Accepted", reference: { ...structuredClone(operation), definitionId, requestId: operation.requestId } });
    } else if (current.current.phase !== "Accepted" || current.current.attempt || current.current.status
      || current.current.reference?.definitionId !== definitionId || current.current.reference?.requestId !== operation.requestId) return;
    // Effect replay may abort the initial GET. Resume only that same safe reference.
    return consult();
  }, [owns, update, consult]);
  const replay = useCallback(async () => {
    if (current.current.phase !== "Unconfirmed" || !current.current.canReplay || !current.current.attempt) return;
    return write(current.current.attempt);
  }, [write]);
  const resetRejected = useCallback(() => {
    if (owns && current.current.phase === "Rejected" && !flight.current) update(empty());
  }, [owns, update]);
  useEffect(() => {
    const state = session.status?.state ?? session.receipt?.state;
    if (!owns || session.phase !== "Accepted" || session.busy || session.error || state === "Published" || state === "Failed" || state === "Uncertain") return;
    const delay = session.status?.nextCheckAtUtc ? Math.min(300000, Math.max(1000, Date.parse(session.status.nextCheckAtUtc) - Date.now())) : 30000;
    const timer = window.setTimeout(() => { void consult(); }, delay);
    return () => window.clearTimeout(timer);
  }, [owns, session.phase, session.busy, session.error, session.status?.state, session.status?.nextCheckAtUtc, session.receipt?.state, consult]);
  const visible = owns ? session : empty();
  return { phase: visible.phase, receipt: visible.receipt, status: visible.status, error: visible.error, busy: visible.busy,
    aggregate: visible.reference, startedHere: visible.attempt !== null, canReplay: visible.canReplay, confirmed: visible.receipt !== null || visible.status !== null || visible.reference !== null, accept, consult, replay, resetRejected, resume };
}
