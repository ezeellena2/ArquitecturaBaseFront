import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Badge } from "@/shared/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Textarea } from "@/shared/ui/textarea";
import { Spinner } from "@/shared/ui/Spinner";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { EmptyState } from "@/shared/ui/EmptyState";
import { decideApprovalTask, fetchApprovalTask, type ApprovalTask } from "../api/approvals";
import { approvalStateVariant, prepareApprovalDecision, type ApprovalDecision } from "../approvals";
import { approvalForbidden, useApprovalScope } from "../hooks/useApprovalQueries";
import { useUnobservedQueryCleanup } from "../hooks/useUnobservedQueryCleanup";
export function ApprovalDecisionPanel({ taskId, onDecided, actionsTarget, disabled = false, onForbidden, embedded = false, statusId }: {
    taskId: string;
    embedded?: boolean;
    statusId?: string;
    disabled?: boolean;
    onForbidden?: () => void;
    onDecided?: (task?: ApprovalTask) => void;
    actionsTarget?: HTMLElement | null;
}) {
    const scope = useApprovalScope();
    const { t } = useTranslation("forms");
    const [denied, setDenied] = useState<string | null>(null);
    const owner = scope.owner + ":" + taskId;
    if (!scope.allowed)
        return null;
    if (denied === owner)
        return <p role="status">{t("approvals.noPermission")}</p>;
    return <DecisionEditor key={owner} taskId={taskId} scope={scope} embedded={embedded} statusId={statusId} onDecided={onDecided} actionsTarget={actionsTarget} disabled={disabled} onForbidden={() => { setDenied(owner); onForbidden?.(); }}/>;
}
function DecisionEditor({ taskId, scope, onDecided, onForbidden, actionsTarget, disabled, embedded, statusId }: {
    taskId: string;
    scope: ReturnType<typeof useApprovalScope>;
    disabled: boolean;
    embedded: boolean;
    statusId?: string;
    onDecided?: (task?: ApprovalTask) => void;
    onForbidden: () => void;
    actionsTarget?: HTMLElement | null;
}) {
    const { t, i18n } = useTranslation("forms");
    const client = useQueryClient();
    const operationId = "forms:approval:" + scope.owner + ":" + taskId + ":decide";
    const pendingNotice = useRef(false);
    useEffect(() => () => { if (pendingNotice.current) dismissNotification(operationId); }, [operationId]);
    const key = useMemo(() => ["form-approvals", scope.owner, "task", taskId], [scope.owner, taskId]);
    useUnobservedQueryCleanup(key);
    const query = useQuery({ queryKey: key, queryFn: ({ signal }) => fetchApprovalTask(taskId, signal), gcTime: 0 });
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<unknown>(null);
    const [reject, setReject] = useState(false);
    const [reason, setReason] = useState("");
    const summary = useRef<HTMLDivElement | null>(null);
    const focusDecision = useRef(false);
    const live = useRef(true);
    const controller = useRef<AbortController | null>(null);
    const cooldown = useCountdown(0);
    useLayoutEffect(() => { live.current = true; return () => { live.current = false; controller.current?.abort(); }; }, []);
    useEffect(() => { if (approvalForbidden(query.error))
        onForbidden(); }, [query.error, onForbidden]);
    const refresh = (task?: ApprovalTask) => { void client.invalidateQueries({ queryKey: ["form-approvals", scope.owner], predicate: entry => entry.queryKey[2] !== "task" }); void client.invalidateQueries({ queryKey: ["form-overview", scope.owner] }); onDecided?.(task); };
    const decide = async (decision: ApprovalDecision) => {
        const task = query.data;
        if (!task?.canDecide || disabled || busy || query.isFetching || cooldown.isRunning)
            return;
        const body = prepareApprovalDecision(task.revision, decision, reason);
        if (!body)
            return;
        const request = new AbortController();
        controller.current = request;
        setBusy(true);
        setError(null);
        dismissNotification(operationId);
        pendingNotice.current = false;
        try {
            const result = await decideApprovalTask(taskId, body, request.signal);
            if (!live.current || request.signal.aborted)
                return;
            focusDecision.current = true;
            const confirmed: ApprovalTask = { ...task, state: result.state, revision: result.revision, decidedAtUtc: result.decidedAtUtc, decidedBy: result.decidedBy, reason: result.reason, canDecide: false, cannotDecideReason: "AlreadyDecided" };
            client.setQueryData(key, confirmed);
            setReject(false);
            setReason("");
            refresh(confirmed);
            notify({ id: operationId, kind: "success", message: t(decision === "Approved" ? "approvals.approved" : "approvals.rejected") });
        }
        catch (failure) {
            if (!live.current || request.signal.aborted || errorFeedback(failure).kind === "cancelled")
                return;
            if (approvalForbidden(failure)) {
                onForbidden();
                refresh();
                return;
            }
            if (!["cancelled", "session", "forbidden", "fields"].includes(errorFeedback(failure, { fields: decision === "Rejected" ? ["reason"] : [] }).kind)) { pendingNotice.current = true; notify({ id: operationId, kind: "error", message: readErrorMessage(failure, t) }); }
            if (failure instanceof ApiError && failure.status === 409) {
                focusDecision.current = true;
                const reread = await query.refetch();
                if (!live.current)
                    return;
                setReject(false);
                setReason("");
                refresh(reread.data);
                setError(failure);
            }
            else {
                setError(failure);
                if (failure instanceof ApiError && failure.status === 429)
                    cooldown.restart(failure.retryAfterSeconds ?? 60);
            }
        }
        finally {
            if (live.current)
                setBusy(false);
        }
    };
    const task = query.data;
    useLayoutEffect(() => { if (task?.state !== "Open" && focusDecision.current) {
        focusDecision.current = false;
        summary.current?.focus();
    } }, [task?.state]);
    if (approvalForbidden(query.error)) return null;
    if (query.isPending)
        return <Spinner />;
    const transientReadFailure = errorFeedback(query.error).network || query.error instanceof ApiError && (query.error.status >= 500 || query.error.status === 429);
    if (!task || query.error && !transientReadFailure)
        return <EmptyState embedded title={t("common:states.loadFailed")} action={!approvalForbidden(query.error) ? <Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button> : undefined}/>;
    // Why Approve and Reject are disabled (an own response, the wait of a 429) is the help of each button, never a text under them.
    const waitReason = cooldown.isRunning && !busy ? t("wait", { count: cooldown.seconds }) : null;
    const decisionReason = busy ? null : task.cannotDecideReason === "OwnResponse" ? t("approvals.ownResponse") : waitReason;
    const controls = task.state === "Open" ? <div className="flex flex-wrap gap-2"><DisabledReason reason={decisionReason}><Button variant="outline" disabled={disabled || !task.canDecide || busy || query.isFetching || cooldown.isRunning} onClick={() => setReject(true)}>{t("approvals.reject")}</Button></DisabledReason><DisabledReason reason={decisionReason}><Button disabled={disabled || !task.canDecide || busy || query.isFetching || cooldown.isRunning} onClick={() => void decide("Approved")}>{t("approvals.approve")}</Button></DisabledReason></div> : null;
    return <div ref={summary} aria-labelledby={statusId} tabIndex={-1} className="space-y-3 outline-none">
  <div className="flex flex-wrap items-center gap-3">{embedded ? null : <Badge variant={approvalStateVariant(task.state)}>{t("approvals.taskStates." + task.state)}</Badge>}<span className="text-sm">{task.role.name}</span></div>
  {task.decidedAtUtc ? <p className="text-sm">{t("approvals.decisionBy", { name: task.decidedBy?.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(task.decidedAtUtc, i18n.language, scope.user?.timeZoneId) })}</p> : null}
  {task.reason ? <p className="text-sm whitespace-pre-wrap">{task.reason}</p> : null}
  {actionsTarget === undefined ? controls : actionsTarget ? createPortal(controls, actionsTarget) : null}
  {error instanceof ApiError && error.status === 409 ? <p role="status" className="text-sm">{t("approvals.conflict")}</p> : null}
  {reject ?<RejectDialog number={task.number} reason={reason} setReason={value => { setReason(value); setError(null); }} fieldError={error instanceof ApiError ? error.errors?.reason?.[0] : undefined} busy={busy} onClose={() => { if (!busy) {
        setReject(false);
        setReason("");
    } }} onSubmit={() => void decide("Rejected")} disabled={disabled || cooldown.isRunning} fallback={summary} waitReason={waitReason}/> : null}
 </div>;
}
function RejectDialog({ number, reason, setReason, busy, onClose, onSubmit, disabled, fallback, waitReason, fieldError }: {
    number: string;
    reason: string;
    setReason: (value: string) => void;
    busy: boolean;
    onClose: () => void;
    onSubmit: () => void;
    disabled: boolean;
    fallback: import("react").RefObject<HTMLElement | null>;
    waitReason: string | null;
    fieldError?: string;
}) {
    const { t } = useTranslation("forms");
    const restore = useRestoreFocusOnClose(true, fallback);
    return <Dialog open onOpenChange={open => { if (!open)
        onClose(); }}><DialogContent showCloseButton={!busy} onCloseAutoFocus={restore} onEscapeKeyDown={event => { if (busy)
        event.preventDefault(); }} onPointerDownOutside={event => { if (busy)
        event.preventDefault(); }}><DialogTitle>{t("approvals.rejectTitle", { number })}</DialogTitle><DialogDescription>{t("approvals.rejectHint")}</DialogDescription><FormField label={t("approvals.reason")} required error={fieldError} hint={t("approvals.reasonCount", { count: reason.length })}><Textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={4}/></FormField><DialogFooter><Button variant="outline" onClick={onClose} disabled={busy}>{t("common:actions.cancel")}</Button>{/* On the phone the footer stacks its buttons at full width; the wrapper of a waiting one keeps that width. */}<DisabledReason reason={waitReason} className="max-sm:*:flex-1"><Button variant="destructive" onClick={onSubmit} disabled={busy || disabled || !prepareApprovalDecision(1, "Rejected", reason)}>{t("approvals.reject")}</Button></DisabledReason></DialogFooter></DialogContent></Dialog>;
}
