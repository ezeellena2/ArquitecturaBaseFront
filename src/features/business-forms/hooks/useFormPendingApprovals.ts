import { useCallback, useEffect, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchApprovalTasks } from "../api/approvals";
import { useApprovalScope, approvalForbidden } from "./useApprovalQueries";
export function useFormPendingApprovals(formId: string, page: number, pageSize: number, selectedTaskId?: string) {
  const originalScope = useApprovalScope();
  const [deniedOwner, setDeniedOwner] = useState<string | null>(null);
  const client = useQueryClient();
  const scope = { ...originalScope, allowed: originalScope.allowed && deniedOwner !== originalScope.owner };
  const deny = useCallback(() => setDeniedOwner(scope.owner), [scope.owner]);
  const filter = { definitionId: formId, onlyMine: true, page, pageSize };
  const query = useQuery({ queryKey: ["form-approvals", scope.owner, "list", filter],
    queryFn: ({ signal }) => fetchApprovalTasks(filter, signal),
    enabled: scope.allowed && !!formId, gcTime: 0, meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner &&
      (previousQuery.queryKey[3] as typeof filter | undefined)?.definitionId === formId ? keepPreviousData(previous) : undefined });
  const forbidden = deniedOwner === scope.owner || approvalForbidden(query.error);
  if (forbidden && deniedOwner !== scope.owner) setDeniedOwner(scope.owner);
  useEffect(() => {
    if (deniedOwner !== scope.owner) return;
    const predicate = (entry: { queryKey: readonly unknown[]; state: { data: unknown } }) => entry.queryKey[0] === "form-approvals" && entry.queryKey[1] === scope.owner &&
      (entry.queryKey[2] === "list" && (entry.queryKey[3] as typeof filter | undefined)?.definitionId === formId ||
       entry.queryKey[2] === "task" && (entry.queryKey[3] === selectedTaskId || (entry.state.data as { definitionId?: string } | undefined)?.definitionId === formId));
    void client.cancelQueries({ predicate });
    client.removeQueries({ predicate });
  }, [client, deniedOwner, scope.owner, formId, selectedTaskId]);
  return { scope, deny, forbidden, query: { ...query, data: scope.allowed && !forbidden ? query.data : undefined } };
}
