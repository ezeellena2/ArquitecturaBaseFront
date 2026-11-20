import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ItemFoldersDialog } from "../components/ItemFoldersDialog";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { administrativeName } from "../editorModel";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { Page } from "@/shared/ui/Page";
import { Picker } from "@/shared/ui/Picker";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { CatalogDetail } from "../api/catalogResponse";
import { openCatalogFilters } from "../catalogFilterDraft";
import { CatalogFiltersEditor } from "../components/CatalogFiltersEditor";
import { CatalogReviewDialog } from "../components/CatalogReviewDialog";
import { CatalogActionsMenu } from "../components/CatalogActionsMenu";
import { CatalogMetadataFields } from "../components/CatalogMetadataFields";
import { useCatalogDraftEditor, type CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogFilterOptions } from "../hooks/useCatalogQueries";
import { usePickerPages } from "../hooks/usePickerPages";

export function CatalogFiltersEditorPage({ scope, initial, timeZoneId }: { scope: CatalogReadScope; initial?: CatalogDetail; timeZoneId?: string }) {
  const { t } = useTranslation("forms"); const navigate = useNavigate();
  const editor = useCatalogDraftEditor(scope, initial, "Filters");
  // No language selector: the texts are edited in the menu language, and changing it keeps the draft. The catalog's original
  // (a new one's is the menu language) is the only required one and, with the menu in the other language, the reference.
  const culture = scope.culture;
  const original = initial?.originalCulture ?? scope.culture;
  const [sample, setSample] = useState<{ id: string; name: string } | null>(null);
  // The sample people, searched in the server twenty at a time with «Mostrar N más» inside the list (DS1-A).
  const samplePages = usePickerPages<{ id: string; name: string }>();
  const [previousManage, setPreviousManage] = useState(scope.permissions.includes("formcatalogs.manage"));
  const [reviewOpen, setReviewOpen] = useState(false); const [discardOpen, setDiscardOpen] = useState(false);
  const [discardProposalOpen, setDiscardProposalOpen] = useState(false);
  // «Carpetas…» of ⋮ (AC1-A, CP2-A) mounts its dialog while it is open; closing it gives the focus back to ⋮.
  const [foldersOpen, setFoldersOpen] = useState(false);
  const actionsTrigger = useRef<HTMLButtonElement>(null);
  // Save does not wait for the sample person: trying it without one marks the person, and from then on it validates live.
  const [attempted, setAttempted] = useState(false);
  const proposalResult = useRef<HTMLDivElement>(null); const sampleField = useRef<HTMLDivElement>(null);
  const options = useCatalogFilterOptions(scope, { page: samplePages.page, pageSize: 20, sort: "name", search: samplePages.settled });
  const canManage = scope.permissions.includes("formcatalogs.manage");
  const draft = editor.draft;
  const proposal = draft?.proposal; const pendingProposal = proposal?.state === "Pending";
  const needsSample = Boolean(draft?.isActive || pendingProposal);
  const previousProposalState = useRef(proposal?.state);
  useEffect(() => {
    if (previousProposalState.current === "Pending" && proposal?.state !== "Pending") proposalResult.current?.focus();
    previousProposalState.current = proposal?.state;
  }, [proposal?.state]);
  const fields = editor.error instanceof ApiError ? editor.error.errors ?? {} : {};
  const feedbackId = "catalogs:filters:" + useId(); const active = useRef(true); const host = useRef<HTMLDivElement>(null);
  // A new error of the server marks fields: the first one takes the focus, which also scrolls it into view under the sticky header.
  useEffect(() => {
    if (!(editor.error instanceof ApiError) || !Object.keys(editor.error.errors ?? {}).length) return;
    const frame = requestAnimationFrame(() => { if (active.current) host.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus(); });
    return () => cancelAnimationFrame(frame);
  }, [editor.error]);
  const guard = useUnsavedChangesGuard(editor.dirty || editor.busy, { queryKeys: ["kind"] });
  const currentName = draft && administrativeName(draft.name, scope.culture) || t("catalogs.new"); useBreadcrumbLeaf(currentName);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  if (previousManage !== canManage) {
    setPreviousManage(canManage);
    if (!canManage) { setSample(null); samplePages.onSearchChange(""); }
  }
  const fieldPaths = ["name.es", "name.en", "description.es", "description.en", "sampleUserId", "filters.textColumn", "filters.detailColumn", "filters.sortColumn", ...(draft?.filters?.conditions.map((_, index) => `filters.conditions[${index}]`) ?? [])];
  const fieldPathsStamp = JSON.stringify(fieldPaths);
  useEffect(() => {
    const error = editor.error ?? options.error;
    if (!error) { dismissNotification(feedbackId); return; }
    const feedback = errorFeedback(error, { writing: !!editor.error, fields: JSON.parse(fieldPathsStamp) as string[], conflictCodes: ["Forms.Catalog.RevisionConflict"] });
    if (["cancelled", "session", "forbidden", "fields", "conflict"].includes(feedback.kind)) return;
    notify({ id: feedbackId, kind: "error", message: editor.error ? operationalErrorMessage(error, t, "save") : readErrorMessage(error, t) });
  }, [editor.error, options.error, fieldPathsStamp, feedbackId, t]);
  useEffect(() => { if (editor.previewResult?.exceedsLimit) notify({ id: feedbackId, kind: "warning", message: t("catalogs.filters.exceedsLimit") }); }, [editor.previewResult, feedbackId, t]);
  const columns = options.data?.columns.map(column => ({ ...column, label: t("catalogs.filters.columnLabels." + column.key),
    operators: column.operators.map(key => ({ key, label: t("catalogs.filters.operatorLabels." + key) })),
    choices: column.choices ?? undefined })) ?? [];
  const view = { key: "users", label: t("catalogs.filters.users") };
  const save = async () => {
    if (!editor.canSave) return;
    if (needsSample && !sample) { setAttempted(true); sampleField.current?.querySelector<HTMLElement>("button[aria-haspopup]")?.focus(); return; }
    const saved = await editor.save(sample?.id);
    if (!saved || !active.current) return;
    setAttempted(false);
    notify({ id: feedbackId, kind: "success", message: t("catalogs.saved") });
    if (!initial) { guard.allowNextNavigation(); void navigate("/catalogos/" + saved.catalog.id, { replace: true }); }
  };
  const discardProposal = async () => {
    const discarded = await editor.discardProposal();
    if (!active.current) return;
    // The confirmation waits open while it works (LC1-A) and closes with the answer, also when it failed.
    setDiscardProposalOpen(false);
    if (discarded) notify({ id: feedbackId, kind: "success", message: t("catalogs.proposal.discarded") });
  };
  if (!draft?.filters || [editor.error, options.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  const samples = samplePages.list({ ...options, data: options.data?.sampleUsers ?? undefined });
  // Each wait shows on the control that started it (LC1-A), and the preview spins only for what fills it.
  const saving = editor.working === "save", rereading = editor.working === "readCurrent", previewing = saving || editor.working === "preview";
  return <Page title={currentName} backTo={{ to: "/catalogos", label: t("catalogs.title") }} status={<span className="text-xs text-[var(--color-content-muted)]">{pendingProposal ? <Badge variant="outline" className="border-[var(--color-warning)] text-[var(--color-warning-700)]">{t("catalogs.proposal.title")}</Badge> : t(draft.isActive ? "catalogs.state.Active" : "catalogs.state.Inactive")}</span>}
    actions={canManage ? <>{pendingProposal ? <Button variant="outline" disabled={!editor.canSave} onClick={() => setDiscardProposalOpen(true)}>{t("catalogs.proposal.discard")}</Button> : <Button variant="outline" disabled={editor.busy} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button>}<Button key="catalog-save" pending={saving} disabled={!editor.canSave || (!pendingProposal && !editor.dirty)} onClick={() => void save()}>{t(pendingProposal ? saving ? "catalogs.proposal.approving" : "catalogs.proposal.approve" : saving ? "saving" : "common:actions.save")}</Button>
      {/* AC1-A: the folders and deactivating or reactivating are something else done with the catalog, in ⋮ after the task of the editor. */}
      <CatalogActionsMenu key="catalog-actions" triggerRef={actionsTrigger} onFolders={draft.id && !pendingProposal ? () => setFoldersOpen(true) : undefined}
        state={draft.id && (!proposal || proposal.state === "Approved") ? { isActive: draft.isActive, disabled: !editor.canSave, onChange: isActive => editor.changeMetadata({ isActive }) } : undefined} /></> : undefined}>
    {proposal ? <div ref={proposalResult} tabIndex={-1} className="mb-4 flex flex-col gap-2">
      <Banner>{/* EP1-A (2026-11-06): a pending proposal is the label of the header; the notice says who asked for it and when. */}{!pendingProposal ? <><strong>{t("catalogs.proposal.states." + proposal.state)}.</strong>{" "}</> : null}{t(proposal.requestedIn === "app" ? "catalogs.proposal.requestedInApp" : "catalogs.proposal.requested", { name: proposal.requestedBy.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(proposal.requestedAtUtc, scope.culture, timeZoneId) })}{" "}{!pendingProposal && proposal.decidedBy && proposal.decidedAtUtc ? t("catalogs.proposal.decided", { name: proposal.decidedBy.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(proposal.decidedAtUtc, scope.culture, timeZoneId) }) : null}</Banner>
      {(proposal.originalProposal?.limitations ?? []).map((limitation, index) => <p key={index} className="break-words text-sm text-[var(--color-warning-700)]">{t("catalogs.proposal.unsupportedColumn", { criterion: limitation.criterion })}</p>)}
    </div> : null}
    {editor.requiresReview ? <Surface title={t("catalogs.review.title")} padded actions={<Button variant="outline" disabled={editor.busy} onClick={() => setReviewOpen(true)}>{t("review")}</Button>}><p className="text-sm">{t("catalogs.review.required")}</p></Surface> : null}
    {/* Without Manage there is nothing to test, so there is no preview beside the configuration. */}
    <div ref={host} className={canManage ? "grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]" : "grid items-start gap-4"}>
      <div className="flex min-w-0 flex-col gap-4">
        <CatalogMetadataFields valueType="Text" name={draft.name} description={draft.description} culture={culture} original={original} canManage={canManage && !editor.requiresReview} busy={editor.busy} origin="Filters" errors={fields} onChange={editor.changeMetadata} />
        {!options.data && options.isPending ? <Spinner /> : options.data ? <CatalogFiltersEditor view={view} columns={columns} value={draft.filters} canManage={canManage && !editor.requiresReview} busy={editor.busy} errors={fields} onChange={editor.changeFilters} /> : <EmptyState title={t("catalogs.filters.optionsFailed")} action={<Button variant="outline" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button>} />}
      </div>
      {canManage ? <Surface title={t("catalogs.filters.previewTitle")} padded actions={<DisabledReason reason={!sample && !editor.busy && !editor.requiresReview ? t("catalogs.filters.chooseSample") : null}><Button variant="outline" disabled={!sample || editor.busy || editor.requiresReview} onClick={() => { if (sample) void editor.preview(sample.id); }}>{t("catalogs.filters.test")}</Button></DisabledReason>}>
        {/* The wait of a search, «Mostrar N más», the failure and «Reintentar» go inside the list. */}
        <div ref={sampleField}><FormField label={t("catalogs.filters.sample")} error={fields["sampleUserId"]?.join(" ") ?? (attempted && needsSample && !sample ? t("catalogs.filters.sampleRequired") : undefined)}>
          <Picker label={t("catalogs.filters.sample")} value={sample?.id ?? null} placeholder={t("catalogs.filters.samplePlaceholder")} disabled={editor.busy || editor.requiresReview}
            options={samples.options.map(person => ({ id: person.id, label: person.name }))} selectedOptions={sample ? [{ id: sample.id, label: sample.name }] : undefined}
            search={samplePages.search} onSearchChange={samplePages.onSearchChange} total={samples.total} loading={samples.loading} failed={samples.failed} onRetry={() => void options.refetch()}
            onLoadMore={samples.onLoadMore} loadingMore={samples.loadingMore} pageSize={samples.pageSize}
            onChange={id => { const person = samples.options.find(item => item.id === id); if (person && person.id !== sample?.id) { setSample(person); editor.clearPreview(); } }} />
        </FormField></div>
        {previewing ? <Spinner /> : editor.previewResult && !editor.previewResult.exceedsLimit ? <>
          {editor.previewResult.items.length ? <ul className="divide-y divide-[var(--color-border)]">{editor.previewResult.items.map(item => <li key={item.id} className="flex flex-col gap-1 py-3"><span className="break-words text-sm">{item.text}</span>{item.detail ? <span className="break-words text-xs text-[var(--color-content-muted)]">{item.detail}</span> : null}{!item.canSend ? <span className="text-xs text-[var(--color-danger)]">{t("catalogs.filters.optionTooLong")}</span> : null}</li>)}</ul> : <p className="text-sm">{t("catalogs.filters.empty")}</p>}
          <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.filters.result", { count: editor.previewResult.totalCount })}</p>
        </> : null}
      </Surface> : null}
    </div>
    <CatalogReviewDialog open={reviewOpen} onOpenChange={setReviewOpen} culture={culture} focusFallback={proposalResult} mine={{ name: draft.name, description: draft.description }} current={editor.current ? { name: editor.current.name, description: editor.current.description } : null}
      filters={{ mine: draft.filters, current: editor.current?.filters ? openCatalogFilters(editor.current.filters) : null, columns }}
      rereading={rereading} busy={editor.busy} onReread={() => void editor.readCurrent()} onAdopt={editor.adoptCurrent} />
    <ConfirmDialog open={discardProposalOpen} onOpenChange={setDiscardProposalOpen} focusFallback={proposalResult} title={t("catalogs.proposal.discardTitle")} description={t("catalogs.proposal.discardHint")} confirmLabel={t("catalogs.proposal.discard")} pending={editor.working === "discardProposal"} pendingLabel={t("catalogs.proposal.discarding")} destructive onConfirm={() => void discardProposal()} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={guard.leave} />
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={() => { guard.allowNextNavigation(); void navigate("/catalogos"); }} />
    {foldersOpen && canManage && draft.id && !pendingProposal ? <ItemFoldersDialog kind="catalogs" id={draft.id} name={currentName} focusFallback={actionsTrigger} onClose={() => setFoldersOpen(false)} /> : null}
  </Page>;
}
