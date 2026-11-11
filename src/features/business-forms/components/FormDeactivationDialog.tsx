import { useEffect, useId, useRef, useState, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { useSystemPresentation } from "@/shared/api/presentation";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { DataList, type DataListItem } from "@/shared/ui/DataList";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { GroupLabel } from "@/shared/ui/GroupLabel";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchFormDeactivation, deactivateForm } from "../api/forms";
import type { FormDeactivation } from "../api/response";
import { administrativeName } from "../editorModel";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
export function FormDeactivationDialog({ id, name, scope, appOnly = false, expectedRevision, onRevisionMismatch, onComplete, onObserved, onClose, focusFallback, timeZoneId }: {
 timeZoneId?: string; id: string; name: string; scope: FormReadScope; /** The active version is completed only in the app (SA3-A). */ appOnly?: boolean; expectedRevision?: number; onRevisionMismatch?: () => void;
 onComplete: (result: FormDeactivation, expectedRevision: number) => void | Promise<void>; onObserved: () => void | Promise<void>; onClose: () => void; focusFallback?: RefObject<HTMLElement | null>;
}) {
 const { t } = useTranslation("forms");
 const key = [...formScopeKey(scope), "deactivation", id];
 usePrivateQueryCleanup(key);
 const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormDeactivation(id, signal), gcTime: 0, meta: { errorOwner: "local" } });
 const installedFeatures = useSystemPresentation().data?.installedFeatures;
 const [busy, setBusy] = useState(false);
 const [denied, setDenied] = useState(false);
 const [needsRead, setNeedsRead] = useState(false);
 const stopsId = useId(), keptId = useId();
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
 // The chat, the assistant and the suggestions stop only for a form that is in WhatsApp now: not one whose active version is only in
 // the app, though an earlier one was in WhatsApp («App» and notice, 2026-11-11), nor one published only in the app or without a
 // channel (SA2-A).
 const inWhatsApp = (installedFeatures ? installedFeatures.includes("form-channels") : true) && !appOnly && !impact?.lifecycle.publishedOnlyInApp;
 const revisionMismatch = expectedRevision !== undefined && impact?.revision !== undefined && expectedRevision !== impact.revision;
 const reread = async () => {
  const current = await query.refetch();
  if (!active.current || current.error || !current.data) return;
  setNeedsRead(false);
  if (current.data.lifecycle.deactivatedAtUtc) { await onObserved(); if (active.current) onClose(); }
 };
 const submit = async () => {
  if (flight.current || needsRead || !impact?.lifecycle.canDeactivate || revisionMismatch || denied) return;
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
   else if (!["session", "forbidden"].includes(errorFeedback(error).kind)) notify({ id: feedbackId, kind: "error", message: operationalErrorMessage(error, t) });
   if (errorFeedback(error, { writing: true }).kind === "uncertain") { setNeedsRead(true); await reread(); }
   else void query.refetch();
  } finally { flight.current = null; if (active.current) setBusy(false); }
 };
 const forbidden = denied || query.error instanceof ApiError && query.error.status === 403;
 // Why it cannot be deactivated is the reason of the disabled button, not a paragraph in the dialog.
 const unavailable = impact && !impact.lifecycle.canDeactivate && !revisionMismatch && !busy && !needsRead && !forbidden ? t(impact.lifecycle.deactivatedAtUtc ? "lifecycle.alreadyDeactivated" : "lifecycle.reasons." + (impact.lifecycle.unavailableReason ?? "Unavailable")) : null;
 // What stops and what is kept are two groups of data in two columns, each with its title (DL, 2026-11-11), not a notice per
 // consequence. «App» goes for every form; «Chat», «Asistente» and «Sugerencias», only for one in WhatsApp now (SA2-A). Where a request goes is
 // the (i) of «Asistente».
 const assistant = t("lifecycle.assistantRow");
 const stops: DataListItem[] = !impact ? [] : [
  { key: "app", label: t("lifecycle.appRow"), value: t("lifecycle.appStops") },
  ...inWhatsApp ? [{ key: "chat", label: t("lifecycle.chatRow"), value: t("lifecycle.chatStops") }, { key: "assistant", value: t("lifecycle.assistantStops"),
   label: <span className="flex items-center gap-1">{assistant}<span className="-my-1 inline-flex"><InfoTip label={t("common:actions.moreInfo", { label: assistant })} text={t("lifecycle.assistantStopsHint")} /></span></span> }] : [],
  ...inWhatsApp && impact.affectedSuggestions.length ? [{ key: "suggestions", label: t("lifecycle.suggestionsRow"), value: t("lifecycle.suggestionsStop", { count: impact.affectedSuggestions.length,
   names: impact.affectedSuggestions.map(form => administrativeName(form.name, scope.culture)).join(", ") }) }] : [],
 ];
 // Without permission to read responses there is no count: they are kept all the same.
 const kept: DataListItem[] = !impact ? [] : [
  { key: "responses", label: t("lifecycle.responsesRow"), value: impact.lifecycle.responseCount ?? t("lifecycle.kept") },
  ...impact.lifecycle.pendingApprovalCount ? [{ key: "approvals", label: t("lifecycle.approvalsRow"), value: t("lifecycle.keepsApprovals", { count: impact.lifecycle.pendingApprovalCount }) }] : [],
  { key: "workflow", label: t("lifecycle.workflowRow"), value: t("lifecycle.kept") },
 ];
 // The one notice that really warns: WhatsApp cannot undo it, with the last open send in numbers when there is one. A form that
 // moved to the app warns only while sends of back then are still open («App» and notice).
 const openUntil = impact?.lifecycle.lastOpenSessionExpiresAtUtc;
 const whatsApp = !impact || !openUntil && (appOnly || !impact.lifecycle.deprecationState) ? null
  : openUntil ? t("lifecycle.metaIrreversible", { date: formatDateTimeInZone(openUntil, scope.culture, timeZoneId) }) : t("lifecycle.metaIrreversibleNow");
 // Only the consequences, without a description under the title or notes on how they work.
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent mobileFullscreen aria-describedby={undefined} className="flex flex-col sm:max-w-2xl" showCloseButton={!busy} onCloseAutoFocus={restoreFocus}>
  <DialogHeader className="shrink-0 pr-6"><DialogTitle>{t("lifecycle.deactivateTitle", { name })}</DialogTitle></DialogHeader>
  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
   {forbidden ? <EmptyState title={t("lifecycle.noPublish")} /> : !impact ? query.isPending ? <div role="status" className="flex gap-2"><Spinner />{t("lifecycle.loading")}</div> : <EmptyState title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>} /> : <>
    <div role="group" aria-labelledby={stopsId} className="flex flex-col gap-1"><GroupLabel id={stopsId}>{t("lifecycle.whatStops")}</GroupLabel><DataList items={stops} /></div>
    <div role="group" aria-labelledby={keptId} className="flex flex-col gap-1"><GroupLabel id={keptId}>{t("lifecycle.whatRemains")}</GroupLabel><DataList items={kept} /></div>
    {whatsApp ? <Banner tone="warning">{whatsApp}</Banner> : null}
    {needsRead ? <Button variant="outline" disabled={busy || query.isFetching} pending={query.isFetching} onClick={() => void reread()}>{t(query.isFetching ? "retrying" : "common:actions.retry")}</Button> : null}
    {revisionMismatch ? <p className="text-sm">{t("lifecycle.reviewDraft")}</p> : null}
   </>}
  </div>
  <DialogFooter className="shrink-0"><Button type="button" variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button>{revisionMismatch && onRevisionMismatch ? <Button type="button" onClick={onRevisionMismatch}>{t("review")}</Button> : <DisabledReason reason={unavailable} className="max-sm:*:flex-1"><Button type="button" disabled={busy || needsRead || forbidden || !impact?.lifecycle.canDeactivate} pending={busy} onClick={() => void submit()}>{t(busy ? "lifecycle.deactivating" : "lifecycle.deactivate")}</Button></DisabledReason>}</DialogFooter>
 </DialogContent></Dialog>;
}
