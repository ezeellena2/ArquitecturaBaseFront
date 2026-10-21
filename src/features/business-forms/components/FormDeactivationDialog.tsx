import { useEffect, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormDeactivation, deactivateForm } from "../api/forms";
import type { FormDeactivation } from "../api/response";
import { administrativeName } from "../editorModel";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
export function FormDeactivationDialog({ id, name, scope, expectedRevision, onRevisionMismatch, onComplete, onClose, focusFallback, timeZoneId }: {
 timeZoneId?: string; id: string; name: string; scope: FormReadScope; expectedRevision?: number; onRevisionMismatch?: () => void;
 onComplete: (result: FormDeactivation, expectedRevision: number) => void | Promise<void>; onClose: () => void; focusFallback?: RefObject<HTMLElement | null>;
}) {
 const { t } = useTranslation("forms");
 const key = [...formScopeKey(scope), "deactivation", id];
 usePrivateQueryCleanup(key);
 const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormDeactivation(id, signal), gcTime: 0, meta: { errorOwner: "local" } });
 const [busy, setBusy] = useState(false);
 const [denied, setDenied] = useState(false);
 const active = useRef(true);
 const flight = useRef<AbortController | null>(null);
 const feedbackId = "forms:deactivation:" + JSON.stringify(key);
 const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
 useEffect(() => { active.current = true; return () => { active.current = false; flight.current?.abort(); dismissNotification(feedbackId); }; }, [feedbackId]);
 useEffect(() => {
  if (!query.error) return;
  const feedback = errorFeedback(query.error);
  if (["cancelled", "session", "forbidden"].includes(feedback.kind)) return;
  notify({ id: feedbackId, kind: "error", message: readErrorMessage(query.error, t) });
 }, [query.error, feedbackId, t]);
 const impact = query.data;
 const revisionMismatch = expectedRevision !== undefined && impact?.revision !== undefined && expectedRevision !== impact.revision;
 const submit = async () => {
  if (flight.current || !impact?.lifecycle.canDeactivate || revisionMismatch || denied) return;
  const controller = new AbortController(); flight.current = controller; setBusy(true); dismissNotification(feedbackId);
  try {
   const result = await deactivateForm(id, impact.revision, controller.signal);
   if (!active.current || controller.signal.aborted) return;
   await onComplete(result, impact.revision);
   if (!active.current) return;
   notify({ id: feedbackId + ":saved:" + result.revision, kind: "success", message: t("lifecycle.deactivatedSuccess", { name }) });
   onClose();
  } catch (error) {
   if (!active.current || errorFeedback(error).kind === "cancelled") return;
   if (error instanceof ApiError && error.status === 403) setDenied(true);
   else if (!["session", "forbidden"].includes(errorFeedback(error).kind)) notify({ id: feedbackId, kind: "error", message: operationalErrorMessage(error, t, "save") });
   void query.refetch();
  } finally { flight.current = null; if (active.current) setBusy(false); }
 };
 const forbidden = denied || query.error instanceof ApiError && query.error.status === 403;
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent mobileFullscreen className="flex flex-col sm:max-w-2xl" showCloseButton={!busy} onCloseAutoFocus={restoreFocus}>
  <DialogHeader className="shrink-0 pr-6"><DialogTitle>{t("lifecycle.deactivateTitle", { name })}</DialogTitle><DialogDescription>{t("lifecycle.deactivateDescription")}</DialogDescription></DialogHeader>
  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
   {forbidden ? <EmptyState title={t("lifecycle.noPublish")} /> : !impact ? query.isPending ? <div role="status" className="flex gap-2"><Spinner />{t("lifecycle.loading")}</div> : <EmptyState title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} /> : <>
    <section className="space-y-2"><h2 className="text-sm font-semibold">{t("lifecycle.whatStops")}</h2>
     <Banner tone="info"><span><strong>{t("lifecycle.chatStops")}</strong><span className="block">{t("lifecycle.chatStopsHint")}</span></span></Banner>
     <Banner tone="info"><span><strong>{t("lifecycle.assistantStops")}</strong><span className="block">{t("lifecycle.assistantStopsHint")}</span></span></Banner>
     {impact.affectedSuggestions.length ? <Banner tone="info"><span><strong>{t("lifecycle.suggestionsStop", { count: impact.affectedSuggestions.length })}</strong><span className="block">{impact.affectedSuggestions.map(form => administrativeName(form.name, scope.culture)).join(", ")}</span></span></Banner> : null}
    </section>
    <section className="space-y-2"><h2 className="text-sm font-semibold">{t("lifecycle.openSends")}</h2><Banner tone="info"><span>{t("lifecycle.openSendsHint")}{impact.lifecycle.lastOpenSessionExpiresAtUtc?<span className="block">{t("lifecycle.lastOpenSend", {date:formatDateTimeInZone(impact.lifecycle.lastOpenSessionExpiresAtUtc,scope.culture,timeZoneId)})}</span>:null}</span></Banner><Banner tone="warning">{t("lifecycle.metaIrreversible")}</Banner></section>
    <section className="space-y-2"><h2 className="text-sm font-semibold">{t("lifecycle.whatRemains")}</h2><Banner tone="info"><span>{impact.lifecycle.responseCount === null ? t("lifecycle.keepsResponsesUnknown") : t("lifecycle.keepsResponses", { count: impact.lifecycle.responseCount })}<span className="block">{t("lifecycle.keepsFiles")}</span></span></Banner><Banner tone="info"><span>{t("lifecycle.keepsWorkflow")}{impact.lifecycle.pendingApprovalCount ? <span className="block">{t("lifecycle.keepsApprovals", { count: impact.lifecycle.pendingApprovalCount })}</span> : null}</span></Banner></section>
    {revisionMismatch ? <p className="text-sm">{t("lifecycle.reviewDraft")}</p> : !impact.lifecycle.canDeactivate ? <p className="text-sm">{t(impact.lifecycle.deactivatedAtUtc ? "lifecycle.alreadyDeactivated" : "lifecycle.reasons." + (impact.lifecycle.unavailableReason ?? "Unavailable"))}</p> : null}
   </>}
  </div>
  <DialogFooter className="shrink-0"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button>{revisionMismatch && onRevisionMismatch ? <Button type="button" onClick={onRevisionMismatch}>{t("review")}</Button> : <Button type="button" disabled={busy || forbidden || !impact?.lifecycle.canDeactivate} onClick={() => void submit()}>{t(busy ? "lifecycle.deactivating" : "lifecycle.deactivate")}</Button>}</DialogFooter>
 </DialogContent></Dialog>;
}
