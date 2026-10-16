import { useEffect, useMemo } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { useResponseNavigation } from "@/features/business-forms/hooks/useResponseQueries";
import { approvalForbidden, useApprovalCount } from "@/features/business-forms/hooks/useApprovalQueries";
import type { FormsResponseNavigation } from "@/layouts/formsNavigation";
export function FormResponsesNavigation({ onState }: {
    onState: (value: FormsResponseNavigation) => void;
}) {
    const { query, scope } = useResponseNavigation();
    const approvals = useApprovalCount();
    const denied = query.error instanceof ApiError && (query.error.status === 403 || query.error.status === 401);
    const { data, isPending, isError, refetch } = query;
    const { data: approvalData, isPending: approvalsPending, isError: approvalsFailed, refetch: retryApprovals, error: approvalError } = approvals.query;
    const approvalDenied = approvalForbidden(approvalError);
    const value = useMemo<FormsResponseNavigation>(() => ({ canRead: scope.allowed && !denied, items: denied ? [] : data?.items ?? [], totalCount: denied ? 0 : data?.totalCount ?? 0, hasMore: !denied && (data?.hasNext ?? false), pending: isPending, failed: isError && !data, retry: () => void refetch(), canApprove: approvals.scope.allowed && !approvalDenied, approvalCount: approvalDenied ? undefined : approvalData?.count, approvalsPending: approvalsPending, approvalsFailed: approvalsFailed, retryApprovals: () => void retryApprovals() }), [scope.allowed, denied, data, isPending, isError, refetch, approvals.scope.allowed, approvalDenied, approvalData, approvalsPending, approvalsFailed, retryApprovals]);
    useEffect(() => onState(value), [onState, value]);
    return null;
}
