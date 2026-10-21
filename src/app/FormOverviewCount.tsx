import { useEffect, useMemo } from "react";
import { useApprovalCount, approvalForbidden } from "@/features/business-forms/hooks/useApprovalQueries";
import type { FormsOverviewNavigation } from "@/layouts/formsOverviewNavigation";
export function FormOverviewCount({ onState }: { onState: (value: Omit<FormsOverviewNavigation, "setActive">) => void }) {
  const { query } = useApprovalCount();
  const { refetch } = query;
  const denied = approvalForbidden(query.error);
  const value = useMemo(() => ({ count: denied ? undefined : query.data?.count, pending: query.isPending,
    failed: query.isError && !denied, retry: () => { void refetch(); } }), [denied, query.data, query.isPending, query.isError, refetch]);
  useEffect(() => onState(value), [onState, value]);
  return null;
}
