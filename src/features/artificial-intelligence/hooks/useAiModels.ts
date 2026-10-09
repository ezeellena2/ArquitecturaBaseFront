import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { listAiModels, type AiConnection, type AiModels } from "../api/aiConnection";
import { hasCredential, type AiDraft } from "../model";
import { aiErrorMessage } from "../errors";

// Credentials stay in the active editor. Neither query keys nor mutation variables
// contain this request; a catalog belongs to one provider, credential and revision.
export function useAiModels(draft: AiDraft, current: AiConnection, observedRevision: number, allowed: boolean,
  onForbidden: () => void, onConflict: () => void) {
  const { t } = useTranslation("artificialIntelligence");
  const { provider, credentialChange, apiKey } = draft;
  const revision = current.revision;
  const basis = useMemo(() => ({ provider, credentialChange, revision, observedRevision, hasCandidate: apiKey.length > 0 }), [provider, credentialChange, apiKey, revision, observedRevision]);
  const latestBasis = useRef(basis);
  useLayoutEffect(() => { latestBasis.current = basis; }, [basis]);
  const callbacks = useRef({ onForbidden, onConflict });
  useLayoutEffect(() => { callbacks.current = { onForbidden, onConflict }; }, [onForbidden, onConflict]);
  const active = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const [state, setState] = useState<{ basis: object; busy: boolean; catalog?: AiModels; fields?: Record<string, string> }>();
  const [cooldown, setCooldown] = useState(0);
  const canLoad = allowed && hasCredential(draft, current) && revision === observedRevision;

  const load = useCallback(async () => {
    if (controller.current || !canLoad || cooldown) return;
    const abort = new AbortController(); controller.current = abort;
    setState(previous => ({ basis, busy: true, catalog: previous?.basis === basis ? previous.catalog : undefined }));
    try {
      const catalog = await listAiModels({ provider, credentialChange, apiKey: credentialChange === "Replace" ? apiKey : null, expectedRevision: revision }, abort.signal);
      if (!active.current || abort.signal.aborted || latestBasis.current !== basis) return;
      if (catalog.provider !== provider || catalog.revision !== revision) return;
      setState({ basis, busy: false, catalog });
    } catch (error) {
      if (!active.current || abort.signal.aborted || latestBasis.current !== basis) return;
      const feedback = errorFeedback(error, { fields: ["provider", "apiKey"] });
      if (feedback.kind === "forbidden") { callbacks.current.onForbidden(); return; }
      if (feedback.kind === "session") return;
      if (error instanceof ApiError && error.code === "Ai.Connection.RevisionConflict") callbacks.current.onConflict();
      setState(previous => ({ basis, busy: false, catalog: previous?.basis === basis ? previous.catalog : undefined,
        fields: Object.fromEntries(Object.entries(feedback.fields).map(([key, value]) => [key, value.join(" ")])) }));
      if (error instanceof ApiError && error.status === 429) setCooldown(Math.min(86400, Math.max(1, Math.ceil(error.retryAfterSeconds ?? 60))));
      if (feedback.kind !== "fields") notify({ id: "ai:models", kind: "error", message: aiErrorMessage(error, t) });
    } finally {
      if (controller.current === abort) controller.current = null;
      if (active.current && latestBasis.current === basis) setState(previous => previous?.basis === basis ? { ...previous, busy: false } : previous);
    }
  }, [apiKey, basis, canLoad, cooldown, credentialChange, provider, revision, t]);

  // Only the stored key loads automatically. Typing a replacement never sends
  // a request for each keystroke: the operator explicitly loads its catalog.
  const autoLoad = useRef(load);
  useLayoutEffect(() => { autoLoad.current = load; }, [load]);
  const auto = canLoad && credentialChange === "Keep";
  useEffect(() => {
    controller.current?.abort(); controller.current = null;
    dismissNotification("ai:models");
    if (auto) void autoLoad.current();
    return () => { controller.current?.abort(); controller.current = null; };
  }, [basis, auto]);
  useEffect(() => { active.current = true; return () => { active.current = false; controller.current?.abort(); dismissNotification("ai:models"); }; }, []);
  useEffect(() => { if (!cooldown) return; const timer = setTimeout(() => setCooldown(previous => Math.max(0, previous - 1)), 1000); return () => clearTimeout(timer); }, [cooldown]);
  const visible = state?.basis === basis ? state : undefined;
  return { models: visible?.catalog?.models, busy: visible?.busy ?? false, errors: visible?.fields ?? {}, canLoad: canLoad && !cooldown, cooldown, load };
}
