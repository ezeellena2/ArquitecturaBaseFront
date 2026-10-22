import { useLayoutEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { fetchResponseRecordNavigation } from "../api/responses";
import { responseQueryFromParams } from "./useResponseRouteQuery";
import { useSystemPresentation } from "@/shared/api/presentation";
import { useResponseScope } from "./useResponseQueries";
import { useResponseWorkspace } from "./useResponseWorkspace";
import { useFormPendingApprovals } from "./useFormPendingApprovals";
import { approvalForbidden } from "./useApprovalQueries";
import { usePendingApprovalNavigation } from "./usePendingApprovalNavigation";
import { responseFullPath, responseSheetPath } from "../responseNavigationPaths";

export function useFullResponseNavigation(formId: string, recordId: string) {
  const workspace = useResponseWorkspace(formId);
  const scope = useResponseScope();
  const [params] = useSearchParams();
  const presentation = useSystemPresentation();
  const query = responseQueryFromParams(params, workspace.filter, 1, presentation.data?.defaultPageSize);
  const navigate = useNavigate();
  const source = workspace.navigation;
  const pendingSource = source?.origin === "pending" ? source.pending : undefined;
  const taskId = source?.origin === "pending" ? source.selection.taskId : undefined;
  const pending = useFormPendingApprovals(formId, pendingSource?.page ?? 1, pendingSource?.pageSize ?? 20, taskId, !!pendingSource);
  useLayoutEffect(() => {
    if (pending.forbidden && source?.origin === "pending") workspace.setNavigation(null);
  }, [pending.forbidden, source, workspace]);
  const anchor = useQuery({ queryKey: ["form-responses", scope.owner, "record-navigation", formId, recordId, query],
    queryFn: ({ signal }) => fetchResponseRecordNavigation(formId, recordId, query, signal),
    enabled: scope.allowed && presentation.isSuccess && !pendingSource, gcTime: 0, meta: { errorOwner: "local" } });
  const anchorData = anchor.data?.recordId.toLowerCase() === recordId.toLowerCase() ? anchor.data : undefined;
  const search = source?.search ?? params.toString();
  useLayoutEffect(() => {
    if (pendingSource || !anchorData || !source || source.selection.recordId !== recordId) return;
    const params = new URLSearchParams(source.search);
    const pageSize = Number(params.get("pageSize")) || query.pageSize;
    const page = Math.ceil(anchorData.position / pageSize);
    if (page === 1) params.delete("page"); else params.set("page", String(page));
    if (params.toString() !== source.search) workspace.setNavigation({ ...source, search: params.toString() });
  }, [anchorData, pendingSource, recordId, query.pageSize, source, workspace]);
  const open = (nextRecordId: string, nextSearch: string) => {
    workspace.prepareFull(nextRecordId);
    navigate(responseFullPath(formId, nextRecordId, nextSearch), { replace: true });
  };
  const motion = usePendingApprovalNavigation({ owner: pending.scope.owner, formId, taskId, pending: pendingSource,
    allowed: pending.scope.allowed, disabled: pending.query.isPlaceholderData,
    onForbidden: pending.deny,
    onQueue: queue => { if (source?.origin === "pending") workspace.setNavigation({ ...source, pending: queue }); },
    onNavigate: (target, queue, page) => {
      const params = new URLSearchParams(search); params.set("approval", target.id);
      if (page === 1) params.delete("approvalPage"); else params.set("approvalPage", String(page));
      workspace.setNavigation({ origin: "pending", selection: { recordId: target.recordId, taskId: target.id }, search: params.toString(), pending: queue });
      open(target.recordId, params.toString());
    },
  });
  const move = (direction: number) => {
    if (pendingSource) { void motion.move(direction); return; }
    const target = direction < 0 ? anchorData?.previousId : anchorData?.nextId;
    if (!target || anchor.isFetching) return;
    workspace.setNavigation({ origin: "sheet", selection: { recordId: target }, search });
    open(target, search);
  };
  const position = pendingSource ? motion.position : anchorData?.position;
  const pendingError = motion.error ?? pending.query.error;
  return {
    kind: pendingSource ? "pending" as const : "sheet" as const,
    previous: pendingSource ? motion.previous : !!anchorData?.previousId,
    next: pendingSource ? motion.next : !!anchorData?.nextId,
    position, count: pendingSource?.totalCount ?? anchorData?.totalCount,
    busy: pendingSource ? motion.busy : anchor.isFetching,
    error: pendingSource ? approvalForbidden(pendingError) ? null : pendingError : anchor.error,
    onRetry: pendingSource ? motion.error ? motion.retry : pending.query.refetch : anchor.refetch,
    onMove: move, backTo: responseSheetPath(formId, search),
    decisionDenied: pending.forbidden, denyDecision: pending.deny,
    refreshPending: () => { if (pendingSource) void pending.query.refetch(); },
  };
}