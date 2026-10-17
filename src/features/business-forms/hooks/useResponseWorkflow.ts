import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { continueResponseAction, fetchResponseWorkflow, reviewResponseAction } from "../api/workflow";
import { sameWorkflowReviewTarget, workflowCanReview, workflowNextAction, type WorkflowReviewTarget } from "../workflow";
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
  const [reviewCheck, setReviewCheck] = useState<{ owner: string; target: WorkflowReviewTarget } | null>(null);
  useLayoutEffect(() => { liveOwner.current = owner; }, [owner]);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, [owner]);
  const cooldown = useCountdown(0);
  const busy = operation?.owner === owner && operation.busy;
  const controlsDenied = deniedManageOwner === owner;
  const canManage = !!scope.user?.permissions.includes("formrules.manage") && !controlsDenied;
  const reconcileReview = async (target: WorkflowReviewTarget, request: AbortController, error: unknown): Promise<boolean> => {
    try {
      const result = await fetchResponseWorkflow(recordId, request.signal);
      if (liveOwner.current !== owner || request.signal.aborted) return false;
      client.setQueryData(key, result);
      setReviewCheck(null);
      const current = result.actions.find(action => action.id === target.runId);
      const recipient = current?.recipients.find(item => item.user.userId === target.recipientUserId);
      const changed = !current || current.revision !== target.expectedRevision || current.state !== "Uncertain" || !recipient || !workflowCanReview(recipient);
      setOperation({ owner, busy: false, error: changed && !(error instanceof ApiError && error.status === 409) ? null : error });
      return changed;
    } catch (readError) {
      if (liveOwner.current !== owner || request.signal.aborted || errorFeedback(readError).kind === "cancelled") return false;
      setReviewCheck({ owner, target });
      setOperation({ owner, busy: false, error: readError });
      if (readError instanceof ApiError && readError.status === 429) cooldown.restart(readError.retryAfterSeconds ?? 60);
      return false;
    }
  };
  const execute = async (runId: string, review?: { target: WorkflowReviewTarget } & ({ wasSent: boolean } | { checkOnly: true })): Promise<boolean> => {
    const action = query.data?.actions.find(item => item.id === runId);
    const recipient = review ? action?.recipients.find(item => item.user.userId === review.target.recipientUserId) : undefined;
    const method = action ? review ? recipient && workflowCanReview(recipient) && action.revision === review.target.expectedRevision ? "review" : null : workflowNextAction(action) : null;
    if (!scope.allowed || !canManage || !method || busy || controller.current || cooldown.isRunning || query.isFetching || query.isPlaceholderData) return false;
    const expected = owner;
    const request = new AbortController();
    controller.current = request;
    const check = reviewCheck;
    const mustCheck = review && check?.owner === owner && sameWorkflowReviewTarget(check.target, review.target);
    setOperation({ owner, busy: true, error: null });
    try {
      if (review && ("checkOnly" in review || mustCheck)) return await reconcileReview(review.target, request, null);
      const result = method === "review" && review
        ? await reviewResponseAction(recordId, runId, { recipientUserId: review.target.recipientUserId, expectedRevision: review.target.expectedRevision, wasSent: review.wasSent }, request.signal)
        : await continueResponseAction(recordId, runId, method as "consult" | "retry", request.signal);
      if (liveOwner.current !== expected || request.signal.aborted) return false;
      client.setQueryData(key, result);
      setOperation({ owner, busy: false, error: null });
      return true;
    } catch (error) {
      if (liveOwner.current !== expected || errorFeedback(error).kind === "cancelled" || request.signal.aborted) return false;
      if (error instanceof ApiError && error.status === 403) {
        setDeniedManageOwner(owner);
        setOperation({ owner, busy: false, error: null });
        void query.refetch();
        return false;
      }
      if (review && (errorFeedback(error, { writing: true }).kind === "uncertain" || error instanceof ApiError && error.status === 409))
        return await reconcileReview(review.target, request, error);
      setOperation({ owner, busy: false, error });
      if (error instanceof ApiError && error.status === 429) cooldown.restart(error.retryAfterSeconds ?? 60);
      return false;
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };
  return { query, scope, busy, cooldown, act: (runId: string) => execute(runId), review: (target: WorkflowReviewTarget, wasSent: boolean) => execute(target.runId, { target, wasSent }), checkReview: (target: WorkflowReviewTarget) => execute(target.runId, { target, checkOnly: true }), needsConsultReview: reviewCheck?.owner === owner ? reviewCheck.target : null, canManage, controlsDenied, error: operation?.owner === owner ? operation.error ?? query.error : query.error };
}
