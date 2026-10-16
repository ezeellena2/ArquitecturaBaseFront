import { useEffect } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { fetchApprovalCount, fetchApprovalOptions, fetchApprovalTasks, type ApprovalQuery } from "../api/approvals";
export const approvalForbidden = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 401);
export function useApprovalScope() {
    const { data: user } = useCurrentUser();
    const { i18n } = useTranslation();
    const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
    const client = useQueryClient();
    useEffect(() => () => { for (const query of client.getQueryCache().findAll({ queryKey: ["form-approvals", owner] }))
        if (query.getObserversCount() === 0) {
            void client.cancelQueries({ queryKey: query.queryKey, exact: true });
            client.removeQueries({ queryKey: query.queryKey, exact: true });
        } }, [client, owner]);
    return { user, owner, allowed: !!user?.permissions.includes("formapprovals.decide") };
}
export function useApprovalCount(onlyMine = true, definitionId?: string) {
    const scope = useApprovalScope();
    const query = useQuery({ queryKey: ["form-approvals", scope.owner, "count", onlyMine, definitionId], queryFn: ({ signal }) => fetchApprovalCount({ onlyMine, definitionId }, signal), enabled: scope.allowed, gcTime: 0, meta: { errorOwner: "local" } });
    return { scope, query };
}
export function useApprovalInbox(filter: ApprovalQuery, enabled = true) {
    const scope = useApprovalScope();
    const query = useQuery({ queryKey: ["form-approvals", scope.owner, "list", filter], queryFn: ({ signal }) => fetchApprovalTasks(filter, signal), enabled: scope.allowed && enabled, gcTime: 0, meta: { errorOwner: "local" }, placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner ? keepPreviousData(previous) : undefined });
    const options = useQuery({ queryKey: ["form-approvals", scope.owner, "options", filter.onlyMine], queryFn: ({ signal }) => fetchApprovalOptions(filter.onlyMine, signal), enabled: scope.allowed, gcTime: 0, meta: { errorOwner: "local" } });
    const otherCount = useApprovalCount(!filter.onlyMine, filter.definitionId);
    return { scope, query, options, otherCount: otherCount.query };
}
