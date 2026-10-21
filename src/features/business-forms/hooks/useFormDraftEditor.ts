import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { createFormDraft, fetchFormDefinition, recoverFormDraft, updateFormDraft } from "../api/forms";
import type { FormDetail } from "../api/response";
import { beginDraftSave, changeDraft, confirmDraftSave, discardDraft, markDraftSaveUnconfirmed, openDraftSession, requestDraftReview, rejectDraftSave, startDraftSession, type DraftSession } from "../draftSession";
import type { DraftEditorValue } from "../model";
import { draftFieldIssues, type DraftFieldIssue } from "../validationPaths";
import { canReadForms, formActorKey, formDetailKey, type FormReadScope } from "./useFormQueries";
import { createDraftReview, resolveDraftReview } from "../editorModel";

export interface FormEditorIssue {
  readonly kind: "validation" | "conflict" | "uncertain" | "missing" | "expired" | "forbidden" | "read";
  readonly code?: string;
  readonly traceId?: string;
  readonly fields?: readonly DraftFieldIssue[];
  readonly error?: unknown;
}
const conflictReasons = {
  "Forms.Draft.RevisionConflict": "RevisionConflict", "Forms.Draft.IdentityRetired": "IdentityRetired",
  "Forms.Definition.PrefixLocked": "PrefixLocked", "Forms.Draft.RequestConflict": "RequestConflict",
} as const;
const contextKey = (scope: FormReadScope) => JSON.stringify([scope.actorId, scope.culture]);

// Private writes deliberately bypass MutationCache. The frozen attempt belongs only to this mount;
// reads/invalidation use the application's QueryClient and all transport uses its HTTP client.
export function useFormDraftEditor(scope: FormReadScope, initial: DraftEditorValue | FormDetail) {
  const client = useQueryClient();
  const [owner] = useState(() => ({ key: contextKey(scope), actorId: scope.actorId, editorId: crypto.randomUUID() }));
  const [session, setSession] = useState<DraftSession | null>(() => {
    if (!owner.actorId || !canReadForms(scope)) return null;
    const identity = { actorId: owner.actorId, editorId: owner.editorId };
    return "definition" in initial ? openDraftSession(identity, initial.definition) : startDraftSession(identity, initial);
  });
  const [issue, setIssue] = useState<FormEditorIssue | null>(null);
  const [review, setReview] = useState<FormDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const current = useRef(session);
  const active = useRef(false);
  const context = useRef(scope);
  const inFlight = useRef<AbortController | null>(null);
  const manageDenied = useRef(false);
  const [deniedPermissions, setDeniedPermissions] = useState<string | null>(null);
  const owns = owner.key === contextKey(scope) && canReadForms(scope);
  const capability = !("definition" in initial) || initial.capabilities.canSave;
  const permissionsStamp = [...scope.permissions].sort().join(",");
  // Adjust state when the owning context changes, rather than retaining private values
  // for one render and then triggering another render from an effect.
  if (!owns && (session !== null || issue !== null || review !== null || busy)) {
    setSession(null); setIssue(null); setReview(null); setBusy(false);
  }

  function publish(next: DraftSession | null) { current.current = next; setSession(next); }
  function clear() {
    inFlight.current?.abort(); current.current = null;
    setSession(null); setIssue(null); setReview(null); setBusy(false);
    void client.cancelQueries({ queryKey: formActorKey(owner.actorId) });
    client.removeQueries({ queryKey: formActorKey(owner.actorId) });
  }
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false; inFlight.current?.abort();
      // A same-mount effect reconnect happens synchronously in StrictMode. Late
      // callbacks are already blocked by active; a real teardown releases the ref.
      queueMicrotask(() => { if (!active.current) current.current = null; });
    };
  }, []);
  const { actorId, culture } = scope;
  useEffect(() => {
    context.current = { actorId, culture, permissions: permissionsStamp.split(",") };
    if (!owns) {
      inFlight.current?.abort(); current.current = null;
      void client.cancelQueries({ queryKey: formActorKey(owner.actorId) });
      client.removeQueries({ queryKey: formActorKey(owner.actorId) });
    }
  }, [actorId, culture, permissionsStamp, owns, client, owner.actorId]);
  useEffect(() => { manageDenied.current = false; }, [permissionsStamp]);

  function alive() { return active.current && current.current !== null && owner.key === contextKey(context.current) && canReadForms(context.current); }
  function writable() { return alive() && capability && !manageDenied.current && context.current.permissions.includes("formtemplates.manage"); }
  function begin() {
    if (!alive() || inFlight.current) return null;
    const controller = new AbortController(); inFlight.current = controller; setBusy(true); return controller;
  }
  function finish(controller: AbortController) {
    if (inFlight.current === controller) { inFlight.current = null; if (alive()) setBusy(false); }
  }
  function invalidate() { void client.invalidateQueries({ queryKey: formActorKey(owner.actorId) }); }
  async function write(replay: boolean) {
    if (!writable() || inFlight.current || !current.current) return;
    if (replay ? current.current.phase !== "Unconfirmed" || issue?.kind !== "missing" : current.current.phase !== "Editing") return;
    const next = replay ? { ...current.current, phase: "Saving" as const } : beginDraftSave(current.current, crypto.randomUUID());
    const attempt = next.pending; if (!attempt) return;
    const controller = begin(); if (!controller) return;
    publish(next); setIssue(null);
    try {
      const result = attempt.definitionId === null ? await createFormDraft(attempt.body, controller.signal)
        : await updateFormDraft(attempt.definitionId, { ...attempt.body, expectedRevision: attempt.body.expectedRevision! }, controller.signal);
      if (!alive()) return;
      const confirmed = confirmDraftSave(current.current!, attempt.identity, result);
      publish(confirmed);
      if (confirmed.pending) setIssue({ kind: "uncertain" }); else invalidate();
      if (!confirmed.pending) return result.definition;
    } catch (error) {
      if (!alive()) return;
      if (error instanceof ApiError && error.status === 401) { clear(); return; }
      const code = error instanceof ApiError ? error.code : undefined;
      const traceId = error instanceof ApiError ? error.traceId : undefined;
      const reason = code && Object.hasOwn(conflictReasons, code) ? conflictReasons[code as keyof typeof conflictReasons] : undefined;
      if (error instanceof ApiError && error.status === 400) {
        publish(rejectDraftSave(current.current!, attempt.identity, "Validation"));
        setIssue({ kind: "validation", code, traceId, error, fields: draftFieldIssues(attempt.body, error.errors) });
      } else if (error instanceof ApiError && error.status === 409 && reason) {
        publish(rejectDraftSave(current.current!, attempt.identity, reason)); setIssue({ kind: "conflict", code, traceId, error });
      } else {
        publish(markDraftSaveUnconfirmed(current.current!, attempt.identity));
        if (error instanceof ApiError && error.status === 403) { manageDenied.current = true; setDeniedPermissions(permissionsStamp); setIssue({ kind: "forbidden", code, traceId, error }); }
        else if (error instanceof ApiError && error.status === 410 && code === "Forms.Draft.ChangeExpired") setIssue({ kind: "expired", code, traceId, error });
        else setIssue({ kind: "uncertain", code, traceId, error });
      }
    } finally { finish(controller); }
  }
  async function recover() {
    const attempt = current.current?.pending;
    if (!attempt || current.current?.phase !== "Unconfirmed") return;
    const controller = begin(); if (!controller) return;
    try {
      const recovered = await recoverFormDraft(attempt.identity.requestId, controller.signal);
      if (!alive()) return;
      if (recovered.kind !== (attempt.definitionId === null ? "Create" : "Update")) { setIssue({ kind: "uncertain" }); return; }
      const confirmed = confirmDraftSave(current.current!, attempt.identity, recovered.result, recovered.currentRevision);
      publish(confirmed); setIssue(confirmed.pending ? { kind: "uncertain" } : null); if (!confirmed.pending) invalidate();
      if (!confirmed.pending && confirmed.phase === "Editing") return recovered.result.definition;
    } catch (error) {
      if (!alive() || controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { clear(); return; }
      setIssue({ kind: error instanceof ApiError && error.status === 404 && error.code === "Forms.Draft.ChangeNotFound" ? "missing"
        : error instanceof ApiError && error.status === 410 && error.code === "Forms.Draft.ChangeExpired" ? "expired" : "read",
        code: error instanceof ApiError ? error.code : undefined, traceId: error instanceof ApiError ? error.traceId : undefined, error });
    } finally { finish(controller); }
  }
  async function readCurrent() {
    const id = current.current?.confirmed?.id ?? current.current?.pending?.definitionId;
    if (!id || !alive() || inFlight.current) return;
    const controller = begin(); if (!controller) return;
    setReview(null);
    try {
      const value = await client.fetchQuery({ queryKey: formDetailKey(context.current, id), queryFn: ({ signal }) => fetchFormDefinition(id, AbortSignal.any([signal, controller.signal])),
        staleTime: 0, gcTime: 0, retry: false, meta: { errorOwner: "local" } });
      if (alive() && !controller.signal.aborted) { setReview(value); return true; }
    } catch (error) {
      if (!alive() || controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) { clear(); return; }
      setIssue({ kind: "read", code: error instanceof ApiError ? error.code : undefined, traceId: error instanceof ApiError ? error.traceId : undefined, error });
    } finally { finish(controller); }
  }
  return { session: owns ? session : null, issue: owns ? issue : null, review: owns ? review : null, busy: owns && busy,
    canSave: owns && capability && deniedPermissions !== permissionsStamp && scope.permissions.includes("formtemplates.manage") && session?.phase === "Editing" && !busy,
    change: (value: DraftEditorValue) => { if (alive()) { publish(changeDraft(current.current!, value)); if (current.current?.phase === "Editing") setIssue(null); } },
    discard: () => { if (alive()) { publish(discardDraft(current.current!)); if (current.current?.phase === "Editing") setIssue(null); } },
    useCurrent: () => {
      if (!alive() || !review || current.current?.phase !== "ReviewRequired" || busy) return;
      publish(openDraftSession(current.current.scope, review.definition));
      manageDenied.current = !review.capabilities.canSave;
      if (!review.capabilities.canSave) setDeniedPermissions(permissionsStamp);
      setIssue(null); setReview(null);
    },
    resolveReview: (choices: Readonly<Record<string, string>>) => {
      if (!alive() || !review || current.current?.phase !== "ReviewRequired" || busy) return;
      const resolved = resolveDraftReview(createDraftReview(current.current.value, review.definition), choices);
      if (!resolved) return;
      publish(changeDraft(openDraftSession(current.current.scope, review.definition), resolved));
      manageDenied.current = !review.capabilities.canSave;
      if (!review.capabilities.canSave) setDeniedPermissions(permissionsStamp);
      setIssue(null); setReview(null);
    },
    confirmRevision: (id: string, expectedRevision: number, revision: number) => {
      const session = current.current;
      if (!alive() || inFlight.current || !session?.confirmed || session.phase !== "Editing" || session.confirmed.id !== id
        || session.confirmed.revision !== expectedRevision || revision !== expectedRevision + 1) return false;
      publish({ ...session, confirmed: { ...session.confirmed, revision }, currentRevision: revision });
      return true;
    },
    lockPrefix: (id: string) => {
      if (!alive() || current.current?.confirmed?.id !== id) return;
      publish({ ...current.current, confirmed: { ...current.current.confirmed, prefixLocked: true } });
      invalidate();
    },
    requireReview: (error: unknown) => {
      if (!alive() || inFlight.current || !current.current?.confirmed || current.current.phase !== "Editing") return;
      publish(requestDraftReview(current.current));
      setIssue({ kind: "conflict", error, code: error instanceof ApiError ? error.code : undefined, traceId: error instanceof ApiError ? error.traceId : undefined });
    },
    save: () => write(false), retry: () => write(true), recover, readCurrent, cancel: () => inFlight.current?.abort(),
  };
}
