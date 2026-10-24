import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { testAiConnection, type AiConnection } from "../api/aiConnection";
import { saveRequest, type AiDraft } from "../model";
import { aiErrorMessage } from "../errors";

export function useAiConnectionTest(draft: AiDraft, draftVersion: number, current: AiConnection, observedRevision: number, onForbidden: () => void, onConflict: () => void) {
  const { t } = useTranslation("artificialIntelligence");
  const signature = `${draftVersion}:${current.revision}:${observedRevision}`;
  const [busyFor, setBusyFor] = useState<string>();
  const [errorState, setErrorState] = useState<{ signature: string; fields: Record<string, string> }>();
  const [cooldown, setCooldown] = useState(0);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const version = useRef(0);
  useEffect(() => {
    version.current++; controller.current?.abort(); controller.current = null;
    dismissNotification("ai:test");
  }, [signature]);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); dismissNotification("ai:test"); }; }, []);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(previous => Math.max(0, previous - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  async function test() {
    if (controller.current || cooldown) return;
    const abort = new AbortController(); controller.current = abort; const startedVersion = version.current;
    setBusyFor(signature); setErrorState(undefined);
    const { enabled: _enabled, requestId: _requestId, ...request } = saveRequest(draft, current.revision, "");
    try {
      await testAiConnection(request, abort.signal);
      if (!active.current || startedVersion !== version.current) return;
      // El resultado vale para este borrador y va solo al Toaster; cambiar el borrador lo retira (efecto de arriba).
      notify({ id: "ai:test", kind: "success", message: t("testSuccess") });
    } catch (error) {
      if (!active.current || startedVersion !== version.current || abort.signal.aborted) return;
      const feedback = errorFeedback(error, { fields: ["provider", "model", "apiKey"] });
      if (feedback.kind === "forbidden") { onForbidden(); return; }
      if (feedback.kind === "session") return;
      if (error instanceof ApiError && error.code === "Ai.Connection.RevisionConflict") onConflict();
      setErrorState({ signature, fields: Object.fromEntries(Object.entries(feedback.fields).map(([key, value]) => [key, value.join(" ")])) });
      if (error instanceof ApiError && error.status === 429) setCooldown(Math.min(86400, Math.max(1, Math.ceil(error.retryAfterSeconds ?? 60))));
      if (feedback.kind !== "fields") notify({ id: "ai:test", kind: "error", message: aiErrorMessage(error, t) });
    } finally {
      if (controller.current === abort) controller.current = null;
      if (active.current && startedVersion === version.current) setBusyFor(undefined);
    }
  }
  return { busy: busyFor === signature, errors: errorState?.signature === signature ? errorState.fields : {}, cooldown, test };
}
