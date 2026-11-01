import { useEffect, useMemo } from "react";
import { useApprovalCount, approvalForbidden } from "@/features/business-forms/hooks/useApprovalQueries";
import type { FormsOverviewNavigation } from "@/layouts/formsOverviewNavigation";
export function FormOverviewCount({ onState }: { onState: (value: Omit<FormsOverviewNavigation, "setActive">) => void }) {
  const { query } = useApprovalCount();
  const { refetch } = query;
  const denied = approvalForbidden(query.error);
  // Reintentar goes back to the menu's skeleton until the count arrives, also when a count was shown before the failure.
  const retrying = query.isError && query.isFetching;
  const value = useMemo(() => ({ count: denied ? undefined : query.data?.count, pending: query.isPending || retrying,
    failed: query.isError && !denied, retry: () => { void refetch(); } }), [denied, query.data, query.isPending, retrying, query.isError, refetch]);
  useEffect(() => onState(value), [onState, value]);
  return null;
}
