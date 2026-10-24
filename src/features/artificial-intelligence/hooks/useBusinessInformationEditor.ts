import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { businessInformationQueryKey, fetchBusinessChange, fetchBusinessInformation, saveBusinessInformation, type BusinessInformation, type BusinessSaveRequest, type BusinessDraft } from "../api/businessInformation";
import { businessDraftFrom, businessFields, businessDetailFields, businessLimits, businessValidation, mergeBusinessReview, normalizeBusinessDraft } from "../businessInformationModel";
import { detailsEqual } from "../businessDetailsModel";
type Recovery = "none" | "uncertain" | "missing" | "conflict";
const noticeId = "ai:business-save";

export function useBusinessInformationEditor(initial: BusinessInformation) {
  const { t } = useTranslation("businessInformation");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => businessDraftFrom(initial));
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  // Se valida al intentar guardar; después del primer intento fallido, en vivo mientras se corrige.
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<Recovery>("none");
  const [review, setReview] = useState<BusinessInformation>();
  const active = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const pending = useRef<BusinessSaveRequest | null>(null);
  const changed = !detailsEqual(draft, businessDraftFrom(baseline));
  const errors = { ...serverErrors, ...(attempted ? localErrors(draft) : {}) };
  const guard = useUnsavedChangesGuard(changed || recovery !== "none" || busy);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; inFlight.current?.abort(); pending.current = null; dismissNotification(noticeId); };
  }, []);
  function localErrors(value: BusinessDraft) {
    return Object.fromEntries(Object.entries(businessValidation(value)).map(([field, key]) => [field, t(key, { count: businessLimits[field as keyof typeof businessLimits] })]));
  }
  function change(next: Partial<BusinessDraft>) {
    setDraft(previous => ({ ...previous, ...next }));
    setServerErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in next) && !("details" in next && field.startsWith("details.")))));
  }
  function reset(current: BusinessInformation) {
    pending.current = null;
    setBaseline(current); setDraft(businessDraftFrom(current)); setServerErrors({}); setAttempted(false); setRecovery("none"); setReview(undefined);
    client.setQueryData(businessInformationQueryKey, current); dismissNotification(noticeId);
  }
  function denied(error: unknown) {
    const feedback = errorFeedback(error);
    if (feedback.kind === "forbidden") { pending.current = null; guard.allowNextNavigation(); void navigate("/sin-permiso"); return true; }
    return feedback.kind === "session";
  }
  function begin() {
    if (inFlight.current) return null;
    const controller = new AbortController(); inFlight.current = controller; setBusy(true); return controller;
  }
  function finish(controller: AbortController) {
    if (inFlight.current === controller) inFlight.current = null;
    if (active.current) setBusy(false);
  }
  async function confirmed(request: BusinessSaveRequest, revision: number, signal: AbortSignal) {
    // The receipt proves this request committed, even if the following read fails.
    const confirmedValue = { ...businessDraftFrom({ ...request, revision }), revision };
    reset(confirmedValue);
    let later = false;
    try {
      const current = await fetchBusinessInformation(signal);
      if (!active.current) return;
      if (current.revision >= revision) { reset(current); later = current.revision > revision; }
    } catch (error) {
      if (!active.current || denied(error)) return;
      void client.invalidateQueries({ queryKey: businessInformationQueryKey });
    }
    if (active.current) notify({ id: noticeId, kind: "success", message: t(later ? "savedThenChanged" : "saved") });
  }
  async function save(retry = false) {
    if (!retry) {
      if (recovery !== "none" || !changed) return;
      setServerErrors({});
      const invalid = Object.keys(businessValidation(draft))[0];
      if (invalid) { setAttempted(true); document.getElementById(`business-${invalid}`)?.focus(); return; }
    } else if (recovery !== "missing" || !pending.current) return;
    const controller = begin(); if (!controller) return;
    if (!retry) pending.current = { ...normalizeBusinessDraft(draft), expectedRevision: baseline.revision, requestId: crypto.randomUUID() };
    const request = pending.current;
    if (!request) { finish(controller); return; }
    try {
      const receipt = await saveBusinessInformation(request, controller.signal);
      if (active.current) await confirmed(request, receipt.revision, controller.signal);
    } catch (error) {
      if (!active.current || denied(error)) return;
      const feedback = errorFeedback(error, { writing: true, fields: [...businessFields, ...businessDetailFields], conflictCodes: ["Ai.BusinessInformation.RevisionConflict", "Ai.BusinessInformation.RequestConflict"] });
      setServerErrors(Object.fromEntries(Object.entries(feedback.fields).map(([key, value]) => [key, value.join(" ")])));
      if (feedback.kind === "uncertain") {
        setRecovery("uncertain");
        notify({ id: noticeId, kind: "warning", message: t("uncertainMessage"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      } else {
        pending.current = null;
        if (feedback.kind === "conflict") { setRecovery("conflict"); notify({ id: noticeId, kind: "warning", message: t("conflictMessage") }); }
        else if (feedback.kind === "fields") {
          document.getElementById(`business-${Object.keys(feedback.fields)[0]}`)?.focus();
        } else if (feedback.kind !== "cancelled") notify({ id: noticeId, kind: "error", message: feedback.detail ?? t("saveFailed") });
      }
    } finally { finish(controller); }
  }
  async function recover() {
    const controller = begin(); if (!controller) return;
    try {
      const request = pending.current;
      if (request) {
        const receipt = await fetchBusinessChange(request.requestId, controller.signal);
        if (active.current) await confirmed(request, receipt.revision, controller.signal);
      } else {
        const current = await fetchBusinessInformation(controller.signal);
        if (active.current) { setReview(current); dismissNotification(noticeId); }
      }
    } catch (error) {
      if (!active.current || denied(error)) return;
      if (pending.current && error instanceof ApiError && error.code === "Ai.BusinessInformation.ChangeNotFound") {
        setRecovery("missing"); dismissNotification(noticeId);
      } else {
        const feedback = errorFeedback(error);
        notify({ id: noticeId, kind: "error", message: t("readFailed"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      }
    } finally { finish(controller); }
  }
  function acceptReview(keep: boolean) {
    if (!review) return;
    const next = keep ? mergeBusinessReview(draft, baseline, review) : businessDraftFrom(review);
    reset(review); setDraft(next);
    notify({ id: noticeId, kind: "info", message: t(keep ? "merged" : "adopted") });
  }
  return { baseline, draft, errors, changed, busy, recovery, review, guard, change, discard: () => reset(baseline), save, recover, acceptReview };
}
