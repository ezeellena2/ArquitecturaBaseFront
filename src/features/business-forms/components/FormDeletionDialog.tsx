import { useEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { deleteForm, fetchFormDefinition } from "../api/forms";
import type { FormReadScope } from "../hooks/useFormQueries";

export function FormDeletionDialog({ id, name, revision, scope, onDeleted, onClose, focusFallback, onChanged }: {
 id: string; name: string; revision: number; scope: FormReadScope;
 onChanged?: () => void; onDeleted: () => void | Promise<void>; onClose: () => void; focusFallback?: RefObject<HTMLElement | null>;
}) {
 const { t } = useTranslation("forms");
 const [busy, setBusy] = useState(false);
 const [blocked, setBlocked] = useState(false);
 const [denied, setDenied] = useState(false);
 const active = useRef(true);
 const flight = useRef<AbortController | null>(null);
 const cooldown = useCountdown(0);
 const feedbackId = "forms:delete:" + scope.actorId + ":" + scope.culture + ":" + id;
 const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
 useEffect(() => { active.current = true; return () => { active.current = false; flight.current?.abort(); dismissNotification(feedbackId); }; }, [feedbackId]);
 const submit = async () => {
  if (flight.current || blocked || cooldown.isRunning || !scope.permissions.includes("formtemplates.manage")) return;
  const controller = new AbortController(); flight.current = controller; setBusy(true); dismissNotification(feedbackId);
  try {
   await deleteForm(id, revision, controller.signal);
   if (!active.current || controller.signal.aborted) return;
   notify({ id: feedbackId + ":deleted", kind: "success", message: t("lifecycle.deletedSuccess", { name }) });
   await onDeleted();
   if (active.current) onClose();
  } catch (error) {
   if (!active.current || errorFeedback(error).kind === "cancelled") return;
   if (error instanceof ApiError && (error.status === 403 || error.status === 404 || error.status === 409)) { setBlocked(true); if (error.status === 403) setDenied(true); onChanged?.(); }
   if (error instanceof ApiError && error.status === 429) cooldown.restart(error.retryAfterSeconds ?? 60);
   const feedback = errorFeedback(error, { writing: true });
   if (!["cancelled", "session", "forbidden"].includes(feedback.kind)) notify({ id: feedbackId, kind: "error", message: operationalErrorMessage(error, t) });
   if (feedback.kind === "uncertain") {
    setBlocked(true);
    try {
     const current = await fetchFormDefinition(id, controller.signal);
     if (!active.current || controller.signal.aborted) return;
     setBlocked(current.definition.revision !== revision || !current.lifecycle.canDelete);
     onChanged?.();
    } catch (readError) {
     if (!active.current || controller.signal.aborted) return;
     if (readError instanceof ApiError && readError.status === 404 && readError.code === "Forms.Definition.NotFound") { await onDeleted(); if (active.current) onClose(); }
     else if (readError instanceof ApiError && readError.status === 403) { setDenied(true); onChanged?.(); }
    }
   }
  } finally { flight.current = null; if (active.current) setBusy(false); }
 };
 return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
  <DialogContent mobileFullscreen showCloseButton={!busy} onCloseAutoFocus={restoreFocus}>
   <DialogHeader className="shrink-0"><DialogTitle className="pr-6">{t("lifecycle.deleteTitle", { name })}</DialogTitle><DialogDescription>{t("lifecycle.deleteDescription")}</DialogDescription></DialogHeader>
   <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
   <p className="text-sm">{t("lifecycle.deleteHint")}</p>
   {blocked ? <p role="status" className="text-sm">{t(denied ? "lifecycle.noDeletePermission" : "lifecycle.deleteChanged")}</p> : null}
   {cooldown.isRunning ? <p role="status" className="text-sm">{t("wait", { count: cooldown.seconds })}</p> : null}
   </div>
   <DialogFooter className="shrink-0"><Button variant="outline" disabled={busy} onClick={onClose}>{t("common:actions.cancel")}</Button><Button variant="destructive" disabled={busy || blocked || cooldown.isRunning} onClick={() => void submit()}>{t(busy ? "lifecycle.deleting" : "lifecycle.delete")}</Button></DialogFooter>
  </DialogContent>
 </Dialog>;
}
