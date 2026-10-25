import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Autocomplete } from "@/shared/ui/Autocomplete";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Banner } from "@/shared/ui/Banner";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { administrativeName } from "../editorModel";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { Page } from "@/shared/ui/Page";
import { Pagination } from "@/shared/ui/Pagination";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { CatalogDetail } from "../api/catalogResponse";
import { openCatalogFilters } from "../catalogFilterDraft";
import { CatalogFiltersEditor } from "../components/CatalogFiltersEditor";
import { CatalogStateAction } from "../components/CatalogStateAction";
import { CatalogMetadataFields } from "../components/CatalogMetadataFields";
import { useCatalogDraftEditor, type CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogFilterOptions } from "../hooks/useCatalogQueries";

export function CatalogFiltersEditorPage({ scope, initial, timeZoneId }: { scope: CatalogReadScope; initial?: CatalogDetail; timeZoneId?: string }) {
  const { t } = useTranslation("forms"); const navigate = useNavigate();
  const editor = useCatalogDraftEditor(scope, initial, "Filters");
  // No language selector: the texts are edited in the menu language. The catalog's original (a new one's is the menu
  // language) is the only required one and, with the menu in the other language, the reference.
  const culture = scope.culture;
  const original = initial?.originalCulture ?? scope.culture;
  const [sample, setSample] = useState<{ id: string; name: string } | null>(null);
  const [sampleName, setSampleName] = useState(""); const [search, setSearch] = useState(""); const [samplePage, setSamplePage] = useState(1);
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => { if (search === settledSearch) return; const timer = setTimeout(() => { setSettledSearch(search); setSamplePage(1); }, 300); return () => clearTimeout(timer); }, [search, settledSearch]);
  const [previousManage, setPreviousManage] = useState(scope.permissions.includes("formcatalogs.manage"));
  const [reviewOpen, setReviewOpen] = useState(false); const [discardOpen, setDiscardOpen] = useState(false);
  const [discardProposalOpen, setDiscardProposalOpen] = useState(false);
  // Save does not wait for the sample person: trying it without one marks the person, and from then on it validates live.
  const [attempted, setAttempted] = useState(false);
  const proposalResult = useRef<HTMLDivElement>(null); const sampleInput = useRef<HTMLInputElement>(null);
  const options = useCatalogFilterOptions(scope, { page: samplePage, pageSize: 20, sort: "name", search: settledSearch });
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
  const feedbackId = "catalogs:filters:" + useId(); const active = useRef(true);
  const guard = useUnsavedChangesGuard(editor.dirty || editor.busy, { queryKeys: ["kind"], remountsOnLanguageChange: true });
  const restoreReviewFocus = useRestoreFocusOnClose(reviewOpen, proposalResult);
  const currentName = draft && administrativeName(draft.name, scope.culture) || t("catalogs.new"); useBreadcrumbLeaf(currentName);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  if (previousManage !== canManage) {
    setPreviousManage(canManage);
    if (!canManage) { setSample(null); setSampleName(""); setSearch(""); setSamplePage(1); }
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
    if (needsSample && !sample) { setAttempted(true); sampleInput.current?.focus(); return; }
    const saved = await editor.save(sample?.id);
    if (!saved || !active.current) return;
    setAttempted(false);
    notify({ id: feedbackId, kind: "success", message: t("catalogs.saved") });
    if (!initial) { guard.allowNextNavigation(); void navigate("/catalogos/" + saved.catalog.id, { replace: true }); }
  };
  const discardProposal = async () => {
    const discarded = await editor.discardProposal();
    if (discarded && active.current) notify({ id: feedbackId, kind: "success", message: t("catalogs.proposal.discarded") });
  };
  if (!draft?.filters || [editor.error, options.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  const samples = options.data?.sampleUsers;
  return <Page title={currentName} backTo={{ to: "/catalogos", label: t("catalogs.title") }} status={<span className="text-xs text-[var(--color-content-muted)]">{pendingProposal ? <Badge variant="outline" className="border-[var(--color-warning)] text-[var(--color-warning-700)]">{t("catalogs.proposal.title")}</Badge> : t(draft.isActive ? "catalogs.state.Active" : "catalogs.state.Inactive")}</span>}
    actions={canManage ? <>{pendingProposal ? <Button variant="outline" disabled={!editor.canSave} onClick={() => setDiscardProposalOpen(true)}>{t("catalogs.proposal.discard")}</Button> : <>{draft.id && (!proposal || proposal.state === "Approved") ? <CatalogStateAction isActive={draft.isActive} disabled={!editor.canSave} onChange={isActive => editor.changeMetadata({ isActive })} /> : null}<Button variant="outline" disabled={editor.busy} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button></>}<Button key="catalog-save" disabled={!editor.canSave || (!pendingProposal && !editor.dirty)} onClick={() => void save()}>{t(pendingProposal ? "catalogs.proposal.approve" : "common:actions.save")}</Button></> : undefined}>
    {proposal ? <div ref={proposalResult} tabIndex={-1} className="mb-4 flex flex-col gap-2">
      <Banner><strong>{t("catalogs.proposal.states." + proposal.state)}.</strong>{" "}{t("catalogs.proposal.requested", { name: proposal.requestedBy.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(proposal.requestedAtUtc, scope.culture, timeZoneId) })}{" "}{pendingProposal ? t("catalogs.proposal.pendingHint") : proposal.decidedBy && proposal.decidedAtUtc ? t("catalogs.proposal.decided", { name: proposal.decidedBy.displayName ?? t("responses.unknownPerson"), date: formatDateTimeInZone(proposal.decidedAtUtc, scope.culture, timeZoneId) }) : null}</Banner>
      {proposal.originalProposal.limitations.map((limitation, index) => <p key={index} className="break-words text-sm text-[var(--color-warning-700)]">{t("catalogs.proposal.unsupportedColumn", { criterion: limitation.criterion })}</p>)}
    </div> : null}
    {editor.requiresReview ? <Surface title={t("catalogs.review.title")} padded actions={<Button variant="outline" disabled={editor.busy} onClick={() => setReviewOpen(true)}>{t("review")}</Button>}><p className="text-sm">{t("catalogs.review.required")}</p></Surface> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <CatalogMetadataFields valueType="Text" name={draft.name} description={draft.description} culture={culture} original={original} canManage={canManage && !editor.requiresReview} busy={editor.busy} origin="Filters" errors={fields} onChange={editor.changeMetadata} />
        {!options.data && options.isPending ? <Spinner /> : options.data ? <CatalogFiltersEditor view={view} columns={columns} value={draft.filters} canManage={canManage && !editor.requiresReview} busy={editor.busy} errors={fields} onChange={editor.changeFilters} /> : <EmptyState title={t("catalogs.filters.optionsFailed")} action={<Button variant="outline" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button>} />}
      </div>
      <Surface title={t("catalogs.filters.previewTitle")} padded actions={canManage ? <Button variant="outline" disabled={!sample || editor.busy || editor.requiresReview} onClick={() => { if (sample) void editor.preview(sample.id); }}>{t("catalogs.filters.test")}</Button> : undefined}>
        {canManage ? <>
          <FormField label={t("catalogs.filters.sample")} hint={t("catalogs.filters.sampleHint")} error={fields["sampleUserId"]?.join(" ") ?? (attempted && needsSample && !sample ? t("catalogs.filters.sampleRequired") : undefined)}>
            <Autocomplete ref={sampleInput} value={sampleName} aria-busy={options.isFetching} disabled={editor.busy || editor.requiresReview} options={samples?.items.map(person => ({ id: person.id, label: person.name })) ?? []}
              onValueChange={value => { setSampleName(value); setSearch(value); setSample(null); editor.clearPreview(); }}
              onSelect={id => { const person = samples?.items.find(person => person.id === id); if (person) { setSample(person); setSampleName(person.name); editor.clearPreview(); } }} />
          </FormField>
          {options.error && options.data ? <div><Button variant="outline" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button></div> : null}
          {samples ? <Pagination {...samples} onPageChange={setSamplePage} /> : null}
          {editor.busy ? <Spinner /> : editor.previewResult && !editor.previewResult.exceedsLimit ? <>
            {editor.previewResult.items.length ? <ul className="divide-y divide-[var(--color-border)]">{editor.previewResult.items.map(item => <li key={item.id} className="flex flex-col gap-1 py-3"><span className="break-words text-sm">{item.text}</span>{item.detail ? <span className="break-words text-xs text-[var(--color-content-muted)]">{item.detail}</span> : null}{!item.canSend ? <span className="text-xs text-[var(--color-danger)]">{t("catalogs.filters.optionTooLong")}</span> : null}</li>)}</ul> : <p className="text-sm">{t("catalogs.filters.empty")}</p>}
            <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.filters.result", { count: editor.previewResult.totalCount })}</p>
          </> : !editor.previewResult ? <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.filters.chooseSample")}</p> : null}
        </> : <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.filters.readOnlyPreview")}</p>}
      </Surface>
    </div>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="sm:max-w-4xl" onCloseAutoFocus={restoreReviewFocus}><DialogHeader><DialogTitle>{t("catalogs.review.title")}</DialogTitle><DialogDescription>{t("catalogs.review.description")}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium">{t("catalogs.review.mine")}</p><p className="text-sm">{administrativeName(draft.name, culture)}</p><p className="text-sm">{administrativeName(draft.description, culture)}</p><CatalogFiltersEditor view={view} columns={columns} value={draft.filters} canManage={false} onChange={() => {}} /></div><div><p className="text-sm font-medium">{t("catalogs.review.current")}</p><p className="text-sm">{administrativeName(editor.current?.name, culture)}</p><p className="text-sm">{administrativeName(editor.current?.description, culture)}</p>{editor.current?.filters ? <CatalogFiltersEditor view={view} columns={columns} value={openCatalogFilters(editor.current.filters)} canManage={false} onChange={() => {}} /> : <p className="text-sm">{t("catalogs.review.readFirst")}</p>}</div></div>
      <DialogFooter><Button variant="outline" disabled={editor.busy} onClick={() => void editor.readCurrent()}>{t("catalogs.review.reread")}</Button><Button disabled={editor.busy || !editor.current} onClick={() => { editor.adoptCurrent(); setReviewOpen(false); }}>{t("catalogs.review.adopt")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={discardProposalOpen} onOpenChange={setDiscardProposalOpen} focusFallback={proposalResult} title={t("catalogs.proposal.discardTitle")} description={t("catalogs.proposal.discardHint")} confirmLabel={t("catalogs.proposal.discard")} destructive onConfirm={() => void discardProposal()} />
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={guard.leave} />
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={() => { guard.allowNextNavigation(); void navigate("/catalogos"); }} />
  </Page>;
}
