import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { continueResponseAction, fetchResponseWorkflow } from "../api/workflow";
import { workflowNextAction } from "../workflow";
import { useResponseScope } from "./useResponseQueries";
export function useResponseWorkflow(formId: string, recordId: string) {
  const scope = useResponseScope();
  const client = useQueryClient();
  const key = ["form-responses", scope.owner, "workflow", formId, recordId];
  const owner = JSON.stringify(key);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchResponseWorkflow(recordId, signal), enabled: scope.allowed && !!recordId,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner && previousQuery.queryKey[3] === formId ? keepPreviousData(previous) : undefined,
    refetchInterval: current => current.state.data?.actions.some(action => action.state === "Waiting" || action.state === "Running") ? 2000 : false,
    gcTime: 0, meta: { errorOwner: "local" } });
  const [deniedManageOwner, setDeniedManageOwner] = useState<string | null>(null);
  const [operation, setOperation] = useState<{ owner: string; busy: boolean; error: unknown } | null>(null);
  const liveOwner = useRef(owner);
  const controller = useRef<AbortController | null>(null);
  useLayoutEffect(() => { liveOwner.current = owner; }, [owner]);
  useEffect(() => () => { controller.current?.abort(); }, [owner]);
  const cooldown = useCountdown(0);
  const busy = operation?.owner === owner && operation.busy;
  const controlsDenied = deniedManageOwner === owner;
  const canManage = !!scope.user?.permissions.includes("formrules.manage") && !controlsDenied;
  const act = async (runId: string) => {
    const action = query.data?.actions.find(item => item.id === runId);
    const method = action ? workflowNextAction(action) : null;
    if (!scope.allowed || !canManage || !method || busy || cooldown.isRunning || query.isFetching || query.isPlaceholderData) return;
    const expected = owner;
    const request = new AbortController();
    controller.current = request;
    setOperation({ owner, busy: true, error: null });
    try {
      const result = await continueResponseAction(recordId, runId, method, request.signal);
      if (liveOwner.current !== expected || request.signal.aborted) return;
      client.setQueryData(key, result);
      setOperation({ owner, busy: false, error: null });
    } catch (error) {
      if (liveOwner.current !== expected || errorFeedback(error).kind === "cancelled" || request.signal.aborted) return;
      if (error instanceof ApiError && error.status === 403) {
        setDeniedManageOwner(owner);
        setOperation({ owner, busy: false, error: null });
        void query.refetch();
        return;
      }
      setOperation({ owner, busy: false, error });
      if (error instanceof ApiError && error.status === 429) cooldown.restart(error.retryAfterSeconds ?? 60);
    }
  };
  return { query, scope, busy, cooldown, act, canManage, controlsDenied, error: operation?.owner === owner ? operation.error ?? query.error : query.error };
}
