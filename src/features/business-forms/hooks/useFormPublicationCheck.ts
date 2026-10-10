import { useCallback, useEffect, useRef, useState } from "react";
import { checkFormPublication } from "../api/forms";
import type { FormPublicationCheck } from "../api/response";
import { canReadForms, type FormReadScope } from "./useFormQueries";

const contextStamp = (scope: FormReadScope) => JSON.stringify([scope.actorId, scope.culture, [...scope.permissions].sort()]);
// A check reads private draft content; it is owned by this dialog, without MutationCache or retries.
export function useFormPublicationCheck(scope: FormReadScope) {
  const stamp = contextStamp(scope);
  const [owner] = useState(stamp);
  const currentStamp = useRef(stamp);
  const active = useRef(false);
  const inFlight = useRef<AbortController | null>(null);
  const [result, setResult] = useState<FormPublicationCheck | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const owns = owner === stamp && canReadForms(scope) && scope.permissions.includes("formtemplates.publish");
  if (!owns && (result !== null || error !== null || busy)) {
    setResult(null); setError(null); setBusy(false);
  }
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; const controller = inFlight.current; inFlight.current = null; controller?.abort(); };
  }, []);
  useEffect(() => {
    currentStamp.current = stamp;
    return () => { const controller = inFlight.current; inFlight.current = null; controller?.abort(); };
  }, [stamp]);
  const check = useCallback(async (id: string, body: Parameters<typeof checkFormPublication>[1]) => {
    if (!owns || !active.current || inFlight.current) return;
    const controller = new AbortController();
    inFlight.current = controller;
    setBusy(true); setResult(null); setError(null);
    const alive = () => active.current && currentStamp.current === owner && !controller.signal.aborted;
    try {
      const checked = await checkFormPublication(id, body, controller.signal);
      if (alive()) { setResult(checked); return checked; }
    } catch (failure) {
      if (alive()) setError(failure);
    } finally {
      if (inFlight.current === controller) {
        inFlight.current = null;
        if (alive()) setBusy(false);
      }
    }
  }, [owns, owner]);
  return { result: owns ? result : null, error: owns ? error : null, busy: owns && busy, check };
}
