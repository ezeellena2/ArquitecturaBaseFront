import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { fetchRecipientSamples, previewRecipient, type RecipientPreview, type RecipientSamplesQuery } from "../api/recipientPreview";
import { normalizeCatalogQuestionSource } from "../catalogQuestionSource";
import type { DraftQuestionSource, FormQuestionSource } from "../model";
import { formScopeKey, type FormReadScope } from "./useFormQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

// The server serves samples and previews only with formtemplates.read + manage + formcatalogs.read.
const canPreview = (scope: FormReadScope) => scope.actorId !== null && ["formtemplates.read", "formtemplates.manage", "formcatalogs.read"].every(permission => scope.permissions.includes(permission));
export function useRecipientSamples(scope: FormReadScope, query: RecipientSamplesQuery, enabled = true) {
  const root = [...formScopeKey(scope), "recipient-samples"] as const;
  useUnobservedQueryCleanup(root);
  return useQuery({ queryKey: [...root, query], queryFn: ({ signal }) => fetchRecipientSamples(query, signal), enabled: enabled && canPreview(scope), staleTime: 0, gcTime: 0, meta: { errorOwner: "local" } });
}
export function useRecipientPreview(scope: FormReadScope, definitionId: string | null, questionId: string, type: "choice" | "multiChoice", source: DraftQuestionSource) {
  const owner = JSON.stringify([...formScopeKey(scope), definitionId, questionId]);
  const [selected, setSelected] = useState<{ owner: string; person: { id: string; name: string } } | null>(null);
  const [settled, setSettled] = useState<{ stamp: string; result: RecipientPreview | null; error: unknown } | null>(null);
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const denied = deniedOwner === owner;
  const person = !denied && selected?.owner === owner ? selected.person : null;
  const complete = !!source.catalog && (source.match ?? []).every(match => "value" in match ? !!match.value : !!match.personAttributeId);
  // The type assertion follows the null checks above; HTTP still validates the complete closed source.
  const normalized = complete ? normalizeCatalogQuestionSource(source) as FormQuestionSource : null;
  const stamp = canPreview(scope) && !denied && definitionId && person && normalized ? JSON.stringify([owner, type, normalized, person.id]) : null;
  const input = useMemo(() => stamp ? JSON.parse(stamp) as [string, "choice" | "multiChoice", FormQuestionSource, string] : null, [stamp]);
  useEffect(() => {
    if (!input || !definitionId || !stamp) return;
    const controller = new AbortController();
    let active = true;
    void previewRecipient(definitionId, { type: input[1], source: input[2], sampleUserId: input[3], culture: scope.culture }, controller.signal).then(result => {
      if (active) setSettled({ stamp, result, error: null });
    }, error => {
      if (!active || controller.signal.aborted) return;
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) setDeniedOwner(owner);
      setSettled({ stamp, result: null, error });
    });
    return () => { active = false; controller.abort(); };
  }, [definitionId, input, owner, scope.culture, stamp]);
  const current = stamp !== null && settled?.stamp === stamp ? settled : null;
  return { person, result: current?.result ?? null, error: current?.error ?? null, busy: stamp !== null && !current, denied, complete, available: canPreview(scope) && !denied && !!definitionId,
    select: (person: { id: string; name: string } | null) => { if (canPreview(scope) && !denied) setSelected(person ? { owner, person } : null); } };
}
