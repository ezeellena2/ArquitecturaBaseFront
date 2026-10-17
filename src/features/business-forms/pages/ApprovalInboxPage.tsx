import { useEffect, useRef, useState, type RefObject } from "react";
import { Link, useSearchParams } from "react-router";
import { useTranslation } from "react-i18next";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatDateTimeInZone, formatRelativeTime } from "@/shared/lib/dateTime";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { FilterBar } from "@/shared/ui/FilterBar";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { NativeSelect } from "@/shared/ui/NativeSelect";
import { DataTable } from "@/shared/ui/DataTable";
import { Pagination } from "@/shared/ui/Pagination";
import { Button } from "@/shared/ui/button";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/shared/ui/dialog";
import { ApprovalDecisionPanel } from "../components/ApprovalDecisionPanel";
import { approvalForbidden, useApprovalInbox, useApprovalScope } from "../hooks/useApprovalQueries";
import type { ApprovalTask } from "../api/approvals";
export function ApprovalInboxPage() { const scope = useApprovalScope(); const [denied, setDenied] = useState<string | null>(null); return scope.allowed && denied !== scope.owner ? <ApprovalInbox key={scope.owner} onForbidden={() => setDenied(scope.owner)}/> : <ForbiddenPage />; }
function ApprovalInbox({ onForbidden }: {
    onForbidden: () => void;
}) {
    const { t, i18n } = useTranslation("forms");
    const [params] = useSearchParams();
    const update = useQueryUpdate();
    const presentation = useSystemPresentation();
    const pagination = usePagination(presentation.data?.defaultPageSize, true);
    const onlyMine = params.get("view") !== "all";
    const definitionId = params.get("definitionId") ?? undefined;
    const { scope, query, options, otherCount } = useApprovalInbox({ page: pagination.page, pageSize: pagination.pageSize, onlyMine, definitionId }, pagination.ready);
    const [selected, setSelected] = useState<ApprovalTask | null>(null);
    const fallback = useRef<HTMLSelectElement | null>(null);
    const forbidden = approvalForbidden(query.error) || approvalForbidden(options.error);
    useEffect(() => { if (forbidden)
        onForbidden(); }, [forbidden, onForbidden]);
    if (forbidden)
        return <ForbiddenPage />;
    const current = query.data?.totalCount;
    const mine = onlyMine ? current : otherCount.data?.count;
    const all = onlyMine ? otherCount.data?.count : current;
    const canRead = scope.user?.permissions.includes("formrecords.read");
    return <Page title={t("approvals.title")}>
  <FilterBar><SegmentedControl aria-label={t("approvals.scope")} options={[{ key: "mine", label: t("approvals.mine", { count: mine ?? 0 }), pressed: onlyMine, onSelect: () => update({ view: undefined, page: undefined }) }, { key: "all", label: t("approvals.all", { count: all ?? 0 }), pressed: !onlyMine, onSelect: () => update({ view: "all", page: undefined }) }]}/><NativeSelect ref={fallback} aria-label={t("approvals.form")} value={definitionId ?? ""} onChange={event => update({ definitionId: event.target.value || undefined, page: undefined })}><option value="">{t("approvals.allForms")}</option>{options.data?.forms.map(form => <option key={form.id} value={form.id}>{form.name}</option>)}</NativeSelect></FilterBar>
  {options.error || otherCount.error ? <Button variant="outline" onClick={() => { if (options.error) void options.refetch(); if (otherCount.error) void otherCount.refetch(); }}>{t("common:actions.retry")}</Button> : null}
  <Surface><DataTable columns={[
            { id: "number", header: t("responses.number"), cell: row => canRead ? <Link className="font-medium text-[var(--color-brand-700)] underline" to={"/formularios/" + row.definitionId + "/respuestas/" + row.recordId} state={{ approvalReturn: "/formularios/por-aprobar?" + params.toString() }}>{row.number}</Link> : <Button variant="link" size="inline" onClick={() => setSelected(row)}>{row.number}</Button> },
            { id: "form", header: t("formColumn"), cell: row => row.formName },
            { id: "author", header: t("responses.actor"), cell: row => row.author.displayName ?? t("responses.unknownPerson") },
            { id: "received", header: t("responses.received"), cell: row => <time dateTime={row.requestedAtUtc}>{formatDateTimeInZone(row.requestedAtUtc, i18n.language, scope.user?.timeZoneId)}</time> },
            { id: "waiting", header: t("approvals.waiting"), cell: row => formatRelativeTime(row.requestedAtUtc, i18n.language) },
            { id: "role", header: t("approvals.role"), cell: row => <div>{row.role.name}{row.cannotDecideReason === "OwnResponse" ? <p className="text-xs text-[var(--color-content-muted)]">{t("approvals.ownResponse")}</p> : null}</div> }
        ]} rows={query.data?.items ?? []} rowKey={row => row.id} isLoading={query.isPending} hasData={!!query.data} error={query.error ? t("approvals.loadFailed") : undefined} onRetry={() => void query.refetch()} emptyTitle={t("approvals.empty")} emptyDescription={t("approvals.emptyHint")}/>{query.data ? <Pagination {...query.data} onPageChange={pagination.setPage} onPageSizeChange={pagination.setPageSize}/> : null}</Surface>
  {selected ? <ApprovalMetadataDialog key={selected.id} task={selected} fallback={fallback} onClose={() => setSelected(null)}/> : null}
 </Page>;
}
function ApprovalMetadataDialog({ task, onClose, fallback }: {
    task: ApprovalTask;
    onClose: () => void;
    fallback: RefObject<HTMLElement | null>;
}) {
    const { t } = useTranslation("forms");
    const restore = useRestoreFocusOnClose(true, fallback);
    return <Dialog open onOpenChange={open => { if (!open)
        onClose(); }}><DialogContent onCloseAutoFocus={restore}><DialogTitle>{task.number}</DialogTitle><DialogDescription>{task.formName + " · " + (task.author.displayName ?? t("responses.unknownPerson"))}</DialogDescription><ApprovalDecisionPanel taskId={task.id}/><Button variant="outline" onClick={onClose}>{t("common:actions.close")}</Button></DialogContent></Dialog>;
}
