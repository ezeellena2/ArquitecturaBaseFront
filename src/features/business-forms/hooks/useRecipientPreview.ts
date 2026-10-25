import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { fetchRecipientMaximum, fetchRecipientSamples, previewRecipient, type RecipientMaximum, type RecipientPreview, type RecipientSamplesQuery } from "../api/recipientPreview";
import { normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import type { DraftQuestionSource, FormQuestionSource } from "../model";
import { formScopeKey, type FormReadScope } from "./useFormQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

// The server serves samples and previews only with formtemplates.read + manage + formcatalogs.read.
const canPreview = (scope: FormReadScope) => scope.actorId !== null && ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"].every(permission => scope.permissions.includes(permission));
// Network, 5xx and 429 can be retried; 400, 404, 401 and 403 cannot.
const isRetryable = (error: unknown) => error instanceof ApiError && (error.isNetworkError || error.status >= 500 || error.status === 429);
export function useRecipientSamples(scope: FormReadScope, query: RecipientSamplesQuery, enabled = true) {
  const root = [...formScopeKey(scope), "recipient-samples"] as const;
  useUnobservedQueryCleanup(root);
  // The samples share the forms read limit: a 429 starts its Retry-After (60 s without one) before the error shows, and Retry waits it.
  // A failed read repeats only through Retry: coming back to the window or reconnecting never sends it on its own (RF13-1).
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const samples = useQuery({ queryKey: [...root, query], queryFn: ({ signal }) => fetchRecipientSamples(query, signal).catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 429) restart(error.retryAfterSeconds ?? 60);
    throw error;
  }), enabled: enabled && canPreview(scope), staleTime: 0, gcTime: 0, refetchOnWindowFocus: false, refetchOnReconnect: false, meta: { errorOwner: "local" } });
  return { ...samples, waitSeconds: samples.isError && cooldown.isRunning ? cooldown.seconds : 0 };
}
export function useRecipientPreview(scope: FormReadScope, definitionId: string | null, questionId: string, type: "choice" | "multiChoice", source: DraftQuestionSource) {
  const owner = JSON.stringify([...formScopeKey(scope), definitionId, questionId]);
  const [selected, setSelected] = useState<{ owner: string; person: { id: string; name: string } } | null>(null);
  const [settled, setSettled] = useState<{ stamp: string; result: RecipientPreview | null; error: unknown } | null>(null);
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  // Only an explicit retry repeats a failed preview: a new attempt is a new stamp. A 429 waits its Retry-After first.
  const [attempt, setAttempt] = useState(0);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const denied = deniedOwner === owner;
  const person = !denied && selected?.owner === owner ? selected.person : null;
  const complete = !!source.catalog && (source.match ?? []).every(match => "value" in match ? !!match.value : !!match.personAttributeId);
  // The type assertion follows the null checks above; HTTP still validates the complete closed source.
  const normalized = complete ? normalizeCatalogQuestionSource(source) as FormQuestionSource : null;
  const stamp = canPreview(scope) && !denied && definitionId && person && normalized ? JSON.stringify([owner, type, normalized, person.id, attempt]) : null;
  const input = useMemo(() => stamp ? JSON.parse(stamp) as [string, "choice" | "multiChoice", FormQuestionSource, string, number] : null, [stamp]);
  useEffect(() => {
    if (!input || !definitionId || !stamp) return;
    const controller = new AbortController();
    let active = true;
    void previewRecipient(definitionId, { type: input[1], source: input[2], sampleUserId: input[3], culture: scope.culture }, controller.signal).then(result => {
      if (active) setSettled({ stamp, result, error: null });
    }, error => {
      if (!active || controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setDeniedOwner(owner);
      if (error instanceof ApiError && error.status === 429) restart(error.retryAfterSeconds ?? 60);
      setSettled({ stamp, result: null, error });
    });
    return () => { active = false; controller.abort(); };
  }, [definitionId, input, owner, restart, scope.culture, stamp]);
  const current = stamp !== null && settled?.stamp === stamp ? settled : null;
  const error = current?.error ?? null;
  const retryable = isRetryable(error);
  const canRetry = retryable && !cooldown.isRunning;
  return { person, result: current?.result ?? null, error, busy: stamp !== null && !current, denied, complete, available: canPreview(scope) && !denied && !!definitionId,
    canRetry, waitSeconds: retryable && cooldown.isRunning ? cooldown.seconds : 0, retry: () => { if (canRetry) setAttempt(value => value + 1); },
    select: (person: { id: string; name: string } | null) => { if (canPreview(scope) && !denied) setSelected(person ? { owner, person } : null); } };
}
// The most options one person can get from complete filters, without a person or a saved form. Like the preview it keeps
// no bodies in a cache: changing filters, language or permissions aborts the read and drops the answer.
export function useRecipientMaximum(scope: FormReadScope, source: DraftQuestionSource | null) {
  const catalog = source?.catalog ?? null, match = source?.match ?? [];
  const complete = !!catalog && match.length > 0 && match.every(item => "value" in item ? !!item.value : !!item.personAttributeId);
  // Like the preview, a failed read is repeated only with `retry`, and a 429 waits its Retry-After first.
  const [attempt, setAttempt] = useState(0);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  // Only the catalog and its filters travel: the presentation does not change the maximum, and the limit comes from the question type.
  const stamp = canPreview(scope) && complete ? JSON.stringify([formScopeKey(scope), normalizeCatalogQuestionSource({ catalog, match }), attempt]) : null;
  const [settled, setSettled] = useState<{ stamp: string; result: RecipientMaximum | null; error: unknown } | null>(null);
  useEffect(() => {
    if (!stamp) return;
    const controller = new AbortController();
    let active = true;
    const [, body] = JSON.parse(stamp) as [unknown, FormQuestionSource, number];
    // A fixed value changes the filters on every key and the route shares the forms write limit with Guardar: the read waits
    // 300 ms after the last change, like the person search; meanwhile only an answer for these same filters shows.
    const timer = setTimeout(() => void fetchRecipientMaximum(body, controller.signal).then(result => {
      if (active) setSettled({ stamp, result, error: null });
    }, error => {
      if (!active || controller.signal.aborted) return;
      if (error instanceof ApiError && error.status === 429) restart(error.retryAfterSeconds ?? 60);
      setSettled({ stamp, result: null, error });
    }), 300);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  }, [restart, stamp]);
  const current = stamp !== null && settled?.stamp === stamp ? settled : null;
  // Rejected filters (400) or a lost permission are not a failure to retry: the filters and the permissions say what happens.
  const failed = isRetryable(current?.error);
  const canRetry = failed && !cooldown.isRunning;
  return { result: current?.result ?? null, failed, canRetry, waitSeconds: failed && cooldown.isRunning ? cooldown.seconds : 0, retry: () => { if (canRetry) setAttempt(value => value + 1); } };
}
