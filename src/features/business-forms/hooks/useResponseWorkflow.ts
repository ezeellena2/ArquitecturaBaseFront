import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import type { ApprovalTask } from "../api/approvals";
import { continueResponseAction, fetchResponseWorkflow, retryResponseRecipient, reviewResponseAction, type ResponseWorkflow } from "../api/workflow";
import { sameWorkflowReviewTarget, workflowCanRetryRecipient, workflowCanReview, workflowNextAction, type WorkflowReviewTarget } from "../workflow";
import { useResponseScope } from "./useResponseQueries";
export function useResponseWorkflow(formId: string, recordId: string, retainPreviousForm = false) {
  const scope = useResponseScope();
  const client = useQueryClient();
  const key = ["form-responses", scope.owner, "workflow", formId, recordId];
  const owner = JSON.stringify(key);
  const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchResponseWorkflow(recordId, signal), enabled: scope.allowed && !!recordId,
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner && (retainPreviousForm || previousQuery.queryKey[3] === formId) ? keepPreviousData(previous) : undefined,
    refetchInterval: current => current.state.data?.actions.some(action => action.state === "Waiting" || action.state === "Running") ? 2000 : false,
    gcTime: 0, meta: { errorOwner: "local" } });
  const [deniedManageOwner, setDeniedManageOwner] = useState<string | null>(null);
  // `runId`, `kind` and the person of a role notice say which button works while `busy`: only that one shows its spinner and gerund.
  const [operation, setOperation] = useState<{ owner: string; busy: boolean; error: unknown; runId?: string; recipientUserId?: string; kind?: "act" | "review" | "check" | "recipient" } | null>(null);
  const liveOwner = useRef<string | undefined>(owner);
  const controller = useRef<AbortController | null>(null);
  const [reviewCheck, setReviewCheck] = useState<{ owner: string; target: WorkflowReviewTarget } | null>(null);
  useLayoutEffect(() => { liveOwner.current = owner; return () => { if (liveOwner.current === owner) liveOwner.current = undefined; }; }, [owner]);
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, [owner]);
  const cooldown = useCountdown(0);
  const busy = operation?.owner === owner && operation.busy;
  const controlsDenied = deniedManageOwner === owner;
  const canManage = !!scope.user?.permissions.includes("formrules.manage") && !controlsDenied;
  const observeApproval = async (task: ApprovalTask) => {
    if (!scope.allowed || task.definitionId !== formId || task.recordId !== recordId || liveOwner.current !== owner) return false;
    await client.cancelQueries({ queryKey: key, exact: true });
    if (liveOwner.current !== owner) return false;
    let observed = false;
    client.setQueryData<ResponseWorkflow>(key, current => {
      if (!current || current.recordId !== recordId || current.task?.id !== task.id || current.task.revision > task.revision) return current;
      observed = true;
      return { ...current, recordState: task.state === "Open" ? "PendingApproval" : task.state,
        task: { ...current.task, revision: task.revision, state: task.state, decidedAtUtc: task.decidedAtUtc, decidedBy: task.decidedBy, reason: task.reason } };
    });
    return observed;
  };
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
  const execute = async (runId: string, review?: { target: WorkflowReviewTarget } & ({ wasSent: boolean } | { checkOnly: true }), person?: WorkflowReviewTarget): Promise<boolean> => {
    const action = query.data?.actions.find(item => item.id === runId);
    const target = review?.target ?? person;
    const recipient = target ? action?.recipients.find(item => item.user.userId === target.recipientUserId) : undefined;
    const method = !action ? null : review ? recipient && workflowCanReview(recipient) && action.revision === review.target.expectedRevision ? "review" : null
      : person ? recipient && workflowCanRetryRecipient(recipient) && action.revision === person.expectedRevision ? "recipient" : null : workflowNextAction(action);
    if (!scope.allowed || !canManage || !method || busy || controller.current || cooldown.isRunning || query.isFetching || query.isPlaceholderData) return false;
    const expected = owner;
    const request = new AbortController();
    controller.current = request;
    const check = reviewCheck;
    const mustCheck = review && check?.owner === owner && sameWorkflowReviewTarget(check.target, review.target);
    setOperation({ owner, busy: true, error: null, runId, recipientUserId: person?.recipientUserId, kind: person ? "recipient" : !review ? "act" : "checkOnly" in review || mustCheck ? "check" : "review" });
    try {
      if (review && ("checkOnly" in review || mustCheck)) return await reconcileReview(review.target, request, null);
      const result = method === "review" && review
        ? await reviewResponseAction(recordId, runId, { recipientUserId: review.target.recipientUserId, expectedRevision: review.target.expectedRevision, wasSent: review.wasSent }, request.signal)
        : method === "recipient" && person
          ? await retryResponseRecipient(recordId, runId, person.recipientUserId, { expectedRevision: person.expectedRevision }, request.signal)
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
      // Someone else retried or resolved this person, or the answer was lost: read the notice again before another POST.
      if (person && (errorFeedback(error, { writing: true }).kind === "uncertain" || error instanceof ApiError && error.status === 409)) void query.refetch();
      if (error instanceof ApiError && error.status === 429) cooldown.restart(error.retryAfterSeconds ?? 60);
      return false;
    } finally {
      if (controller.current === request) controller.current = null;
    }
  };
  const working = busy && operation?.runId && operation.kind ? { runId: operation.runId, kind: operation.kind, recipientUserId: operation.recipientUserId } : null;
  return { query, scope, busy, working, observeApproval, cooldown, act: (runId: string) => execute(runId), retryRecipient: (target: WorkflowReviewTarget) => execute(target.runId, undefined, target), review: (target: WorkflowReviewTarget, wasSent: boolean) => execute(target.runId, { target, wasSent }), checkReview: (target: WorkflowReviewTarget) => execute(target.runId, { target, checkOnly: true }), needsConsultReview: reviewCheck?.owner === owner ? reviewCheck.target : null, canManage, controlsDenied, error: operation?.owner === owner ? operation.error ?? query.error : query.error };
}
