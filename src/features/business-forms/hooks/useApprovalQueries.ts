import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";
import { fetchApprovalCount } from "../api/approvals";
export const approvalForbidden = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 401);
export function useApprovalScope() {
    const { data: user } = useCurrentUser();
    const { i18n } = useTranslation();
    const owner = [user?.id ?? "", i18n.language, [...(user?.permissions ?? [])].sort().join(",")].join(":");
    useUnobservedQueryCleanup(["form-approvals", owner]);
    return { user, owner, allowed: !!user?.permissions.includes("formapprovals.decide") };
}
export function useApprovalCount(onlyMine = true, definitionId?: string) {
    const scope = useApprovalScope();
    const query = useQuery({ queryKey: ["form-approvals", scope.owner, "count", onlyMine, definitionId], queryFn: ({ signal }) => fetchApprovalCount({ onlyMine, definitionId }, signal), enabled: scope.allowed, gcTime: 0 });
    return { scope, query };
}
