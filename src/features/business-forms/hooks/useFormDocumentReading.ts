import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { fetchFormDocumentReading } from "../api/documentReading";
import { formScopeKey, type FormReadScope } from "./useFormQueries";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

/** DOC1: the key of «Cómo viene leyendo» by actor, permissions (the corrections need «Ver respuestas») and menu language, and the form. */
export const formDocumentReadingKey = (scope: FormReadScope, definitionId: string) => [...formScopeKey(scope), "document-reading", definitionId] as const;

/**
 * «Cómo viene leyendo» of a saved form, read when the zone shows it: private like the responses its corrections come from (never kept
 * once nobody observes it), and fresh for 30 seconds, so folding and opening the zone does not read it again. A failure goes to the
 * common notice and the zone keeps «Reintentar»; a 429 keeps it off for the time the server asked, and a 403 takes the reading away,
 * from the screen and from the cache, like the overview.
 */
export function useFormDocumentReading(scope: FormReadScope, definitionId: string | null, enabled: boolean) {
  const key = formDocumentReadingKey(scope, definitionId ?? "");
  const owner = JSON.stringify(key);
  const client = useQueryClient();
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  useUnobservedQueryCleanup(key);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchFormDocumentReading(definitionId!, signal),
    enabled: enabled && deniedOwner !== owner && scope.actorId !== null && definitionId !== null && scope.permissions.includes("formtemplates.read"),
    gcTime: 0, staleTime: 30_000, retry: false });
  const forbidden = deniedOwner === owner || query.error instanceof ApiError && query.error.status === 403;
  if (forbidden && deniedOwner !== owner) setDeniedOwner(owner);
  useEffect(() => { if (deniedOwner === owner) client.removeQueries({ queryKey: JSON.parse(owner) as unknown[], exact: true }); }, [client, deniedOwner, owner]);
  useEffect(() => {
    if (!(query.error instanceof ApiError) || query.error.status !== 429) return;
    restart(Math.min(86400, Math.max(1, query.error.retryAfterSeconds ?? 60)));
  }, [query.error, query.errorUpdatedAt, restart]);
  return { query: { ...query, data: forbidden ? undefined : query.data }, forbidden, cooldown };
}
