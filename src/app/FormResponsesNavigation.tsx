import { useEffect, useMemo } from "react";
import { ApiError } from "@/shared/api/ApiError";
import { useResponseNavigation } from "@/features/business-forms/hooks/useResponseQueries";
import type { FormsResponseNavigation } from "@/layouts/formsNavigation";
export function FormResponsesNavigation({ onState }: { onState: (value: FormsResponseNavigation) => void }) {
  const { query, scope } = useResponseNavigation();
  const denied = query.error instanceof ApiError && (query.error.status === 403 || query.error.status === 401);
  const { data, isPending, isError, refetch } = query;
  const value = useMemo<FormsResponseNavigation>(() => ({ canRead: scope.allowed && !denied, items: denied ? [] : data?.items ?? [], totalCount: denied ? 0 : data?.totalCount ?? 0, hasMore: !denied && (data?.hasNext ?? false), pending: isPending, failed: isError && !data, retry: () => void refetch() }), [scope.allowed, denied, data, isPending, isError, refetch]);
  useEffect(() => onState(value), [onState, value]);
  return null;
}
