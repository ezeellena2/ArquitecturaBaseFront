import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { aiConnectionQueryKey, fetchAiChange, fetchAiConnection, saveAiConnection, type AiConnection, type AiSaveRequest } from "../api/aiConnection";
import { dirty, draftFrom, mergeReview, saveRequest, type AiDraft } from "../model";

type Recovery = "none" | "uncertain" | "missing" | "conflict";
const noticeId = "ai:save";
const fields = ["provider", "model", "apiKey", "enabled"] as const;

// Las operaciones con secretos pertenecen al editor, no a MutationCache. Sólo
// los metadatos confirmados entran en QueryCache. No hay reintentos automáticos.
export function useAiConnectionEditor(initial: AiConnection) {
  const { t } = useTranslation("artificialIntelligence");
  const client = useQueryClient();
  const navigate = useNavigate();
  const [baseline, setBaseline] = useState(initial);
  const [draft, setDraft] = useState(() => draftFrom(initial));
  const [draftVersion, setDraftVersion] = useState(0);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [recovery, setRecovery] = useState<Recovery>("none");
  const [review, setReview] = useState<AiConnection>();
  const active = useRef(true);
  const inFlight = useRef<AbortController | null>(null);
  const pending = useRef<AiSaveRequest | null>(null);
  const changed = dirty(draft, baseline);
  const guard = useUnsavedChangesGuard(changed || recovery !== "none" || busy);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; inFlight.current?.abort(); pending.current = null; dismissNotification(noticeId); };
  }, []);

  function change(next: Partial<AiDraft>) {
    setDraft(previous => ({ ...previous, ...next }));
    setDraftVersion(previous => previous + 1);
    setErrors(previous => Object.fromEntries(Object.entries(previous).filter(([field]) => !(field in next))));
  }
  function reset(current: AiConnection) {
    pending.current = null;
    setBaseline(current); setDraft(draftFrom(current)); setErrors({}); setRecovery("none"); setReview(undefined);
    setDraftVersion(previous => previous + 1);
    client.setQueryData(aiConnectionQueryKey, current);
    dismissNotification(noticeId);
  }
  function discard() { reset(baseline); }
  function denied(error: unknown) {
    const feedback = errorFeedback(error);
    if (feedback.kind === "forbidden") { pending.current = null; guard.allowNextNavigation(); void navigate("/sin-permiso"); return true; }
    return feedback.kind === "session";
  }
  function begin() {
    if (inFlight.current) return null;
    const controller = new AbortController(); inFlight.current = controller; setBusy(true);
    return controller;
  }
  function finish(controller: AbortController) {
    if (inFlight.current === controller) inFlight.current = null;
    if (active.current) setBusy(false);
  }
  async function confirmSaved(connection: AiConnection, signal: AbortSignal) {
    // El comprobante prueba nuestra escritura. Una lectura posterior puede
    // mostrar una revisión más nueva; no intentamos comparar claves ocultas.
    reset(connection);
    let newer = false;
    try {
      const current = await fetchAiConnection(signal);
      if (!active.current) return;
      if (current.revision > connection.revision) { reset(current); newer = true; }
    } catch (error) {
      if (!active.current || denied(error)) return;
      // El comprobante sigue siendo válido aunque falle esta lectura.
      void client.invalidateQueries({ queryKey: aiConnectionQueryKey });
    }
    if (active.current) notify({ id: noticeId, kind: "success", message: t(newer ? "savedThenChanged" : "saved") });
  }
  async function save(retry = false) {
    const controller = begin(); if (!controller) return;
    setErrors({});
    if (!retry) pending.current = saveRequest(draft, baseline.revision, crypto.randomUUID());
    const request = pending.current;
    if (!request) { finish(controller); return; }
    try {
      const receipt = await saveAiConnection(request, controller.signal);
      if (active.current) await confirmSaved(receipt.connection, controller.signal);
    } catch (error) {
      if (!active.current || denied(error)) return;
      const feedback = errorFeedback(error, { writing: true, fields, conflictCodes: ["Ai.Connection.RevisionConflict", "Ai.Connection.RequestConflict"] });
      setErrors(Object.fromEntries(Object.entries(feedback.fields).map(([key, value]) => [key, value.join(" ")])));
      if (feedback.kind === "uncertain") {
        setRecovery("uncertain");
        notify({ id: noticeId, kind: "warning", message: t("uncertain"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      } else {
        pending.current = null;
        if (feedback.kind === "conflict") {
          setRecovery("conflict");
          notify({ id: noticeId, kind: "warning", message: t("conflict") });
        } else if (feedback.kind !== "fields") {
          notify({ id: noticeId, kind: "error", message: feedback.detail ?? t("saveFailed") });
        }
      }
    } finally { finish(controller); }
  }
  async function recover() {
    const controller = begin(); if (!controller) return;
    try {
      if (pending.current) {
        const receipt = await fetchAiChange(pending.current.requestId, controller.signal);
        if (active.current) await confirmSaved(receipt.connection, controller.signal);
      } else {
        const current = await fetchAiConnection(controller.signal);
        if (active.current) { setReview(current); dismissNotification(noticeId); }
      }
    } catch (error) {
      if (!active.current || denied(error)) return;
      if (pending.current && error instanceof ApiError && error.code === "Ai.Connection.ChangeNotFound") {
        setRecovery("missing"); dismissNotification(noticeId);
      } else {
        const feedback = errorFeedback(error);
        notify({ id: noticeId, kind: "error", message: t("readFailed"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
      }
    } finally { finish(controller); }
  }
  function acceptReview(keep: boolean) {
    if (!review) return;
    const next = keep ? mergeReview(draft, baseline, review) : draftFrom(review);
    reset(review); setDraft(next);
  }
  function requireReview() { setRecovery("conflict"); }
  return { baseline, draft, draftVersion, errors, changed, busy, recovery, review, guard, change, discard, save, recover, acceptReview, requireReview };
}
