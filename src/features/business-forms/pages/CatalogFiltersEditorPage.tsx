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
import { CatalogMetadataFields } from "../components/CatalogMetadataFields";
import { useCatalogDraftEditor, type CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogFilterOptions } from "../hooks/useCatalogQueries";
import type { FormCulture } from "../model";

export function CatalogFiltersEditorPage({ scope, initial }: { scope: CatalogReadScope; initial?: CatalogDetail }) {
  const { t } = useTranslation("forms"); const navigate = useNavigate();
  const editor = useCatalogDraftEditor(scope, initial, "Filters");
  const [culture, setCulture] = useState<FormCulture>("es");
  const [sample, setSample] = useState<{ id: string; name: string } | null>(null);
  const [sampleName, setSampleName] = useState(""); const [search, setSearch] = useState(""); const [samplePage, setSamplePage] = useState(1);
  const [settledSearch, setSettledSearch] = useState("");
  useEffect(() => { const timer = setTimeout(() => { setSettledSearch(search); setSamplePage(1); }, 300); return () => clearTimeout(timer); }, [search]);
  const [previousManage, setPreviousManage] = useState(scope.permissions.includes("formcatalogs.manage"));
  const [handledValidation, setHandledValidation] = useState<unknown>(null);
  const [reviewOpen, setReviewOpen] = useState(false); const [discardOpen, setDiscardOpen] = useState(false);
  const options = useCatalogFilterOptions(scope, { page: samplePage, pageSize: 20, sort: "name", search: settledSearch });
  const canManage = scope.permissions.includes("formcatalogs.manage");
  const draft = editor.draft; const fields = editor.error instanceof ApiError ? editor.error.errors ?? {} : {};
  const feedbackId = "catalogs:filters:" + useId(); const active = useRef(true);
  const guard = useUnsavedChangesGuard(editor.dirty || editor.busy, ["kind"]);
  const restoreReviewFocus = useRestoreFocusOnClose(reviewOpen);
  const currentName = draft?.name[scope.culture] || t("catalogs.new"); useBreadcrumbLeaf(currentName);
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
    notify({ id: feedbackId, kind: "error", message: editor.error ? operationalErrorMessage(error, t) : readErrorMessage(error, t) });
  }, [editor.error, options.error, fieldPathsStamp, feedbackId, t]);
  useEffect(() => { if (editor.previewResult?.exceedsLimit) notify({ id: feedbackId, kind: "warning", message: t("catalogs.filters.exceedsLimit") }); }, [editor.previewResult, feedbackId, t]);
  if (handledValidation !== editor.error) {
    setHandledValidation(editor.error);
    if (fields["name.en"] || fields["description.en"]) setCulture("en");
    else if (fields["name.es"] || fields["description.es"]) setCulture("es");
  }
  const columns = options.data?.columns.map(column => ({ ...column, label: t("catalogs.filters.columnLabels." + column.key),
    operators: column.operators.map(key => ({ key, label: t("catalogs.filters.operatorLabels." + key) })),
    choices: column.choices ?? undefined })) ?? [];
  const view = { key: "users", label: t("catalogs.filters.users") };
  const save = async () => {
    if (!sample || !editor.canSave) return;
    const saved = await editor.save(sample.id);
    if (!saved || !active.current) return;
    notify({ id: feedbackId, kind: "success", message: t("catalogs.saved") });
    if (!initial) { guard.allowNextNavigation(); void navigate("/catalogos/" + saved.catalog.id, { replace: true }); }
  };
  if (!draft?.filters || [editor.error, options.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  const samples = options.data?.sampleUsers;
  return <Page title={currentName} backTo={{ to: "/catalogos", label: t("catalogs.title") }} status={editor.dirty ? <span className="text-xs text-[var(--color-content-muted)]">{t("dirty")}</span> : undefined}
    actions={canManage ? <><Button variant="outline" disabled={editor.busy} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button><Button disabled={!editor.canSave || !sample} onClick={() => void save()}>{t("common:actions.save")}</Button></> : undefined}>
    {editor.requiresReview ? <Surface title={t("catalogs.review.title")} padded><p className="text-sm">{t("catalogs.review.required")}</p><div><Button variant="outline" disabled={editor.busy} onClick={() => setReviewOpen(true)}>{t("review")}</Button></div></Surface> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <CatalogMetadataFields name={draft.name} description={draft.description} culture={culture} onCultureChange={setCulture} canManage={canManage && !editor.requiresReview} busy={editor.busy} origin="Filters" errors={fields} onChange={editor.changeMetadata} />
        {!options.data && options.isPending ? <Spinner /> : options.data ? <CatalogFiltersEditor view={view} columns={columns} value={draft.filters} canManage={canManage && !editor.requiresReview} busy={editor.busy} errors={fields} onChange={editor.changeFilters} /> : <EmptyState title={t("catalogs.filters.optionsFailed")} action={<Button variant="outline" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button>} />}
      </div>
      <Surface title={t("catalogs.filters.previewTitle")} padded>
        {canManage ? <>
          <FormField label={t("catalogs.filters.sample")} hint={t("catalogs.filters.sampleHint")} error={fields["sampleUserId"]?.join(" ")}>
            <Autocomplete value={sampleName} aria-busy={options.isFetching} disabled={editor.busy || editor.requiresReview} options={samples?.items.map(person => ({ id: person.id, label: person.name })) ?? []}
              onValueChange={value => { setSampleName(value); setSearch(value); setSample(null); editor.clearPreview(); }}
              onSelect={id => { const person = samples?.items.find(person => person.id === id); if (person) { setSample(person); setSampleName(person.name); editor.clearPreview(); } }} />
          </FormField>
          {options.error && options.data ? <div><Button variant="outline" onClick={() => void options.refetch()}>{t("common:actions.retry")}</Button></div> : null}
          {samples ? <Pagination {...samples} onPageChange={setSamplePage} /> : null}
          <div><Button variant="outline" disabled={!sample || editor.busy || editor.requiresReview} onClick={() => { if (sample) void editor.preview(sample.id); }}>{t("catalogs.filters.test")}</Button></div>
          {editor.busy ? <Spinner /> : editor.previewResult && !editor.previewResult.exceedsLimit ? <>
            {editor.previewResult.items.length ? <ul className="divide-y divide-[var(--color-border)]">{editor.previewResult.items.map(item => <li key={item.id} className="flex flex-col gap-1 py-3"><span className="break-words text-sm">{item.text}</span>{item.detail ? <span className="break-words text-xs text-[var(--color-content-muted)]">{item.detail}</span> : null}</li>)}</ul> : <p className="text-sm">{t("catalogs.filters.empty")}</p>}
            <p className="text-xs text-[var(--color-content-muted)]">{t("catalogs.filters.result", { count: editor.previewResult.totalCount })}</p>
          </> : !editor.previewResult ? <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.filters.chooseSample")}</p> : null}
        </> : <p className="text-sm text-[var(--color-content-muted)]">{t("catalogs.filters.readOnlyPreview")}</p>}
      </Surface>
    </div>
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent className="sm:max-w-4xl" onCloseAutoFocus={restoreReviewFocus}><DialogHeader><DialogTitle>{t("catalogs.review.title")}</DialogTitle><DialogDescription>{t("catalogs.review.description")}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2"><div><p className="text-sm font-medium">{t("catalogs.review.mine")}</p><p className="text-sm">{draft.name[culture]}</p><p className="text-sm">{draft.description[culture]}</p><CatalogFiltersEditor view={view} columns={columns} value={draft.filters} canManage={false} onChange={() => {}} /></div><div><p className="text-sm font-medium">{t("catalogs.review.current")}</p><p className="text-sm">{editor.current?.name[culture]}</p><p className="text-sm">{editor.current?.description[culture]}</p>{editor.current?.filters ? <CatalogFiltersEditor view={view} columns={columns} value={openCatalogFilters(editor.current.filters)} canManage={false} onChange={() => {}} /> : <p className="text-sm">{t("catalogs.review.readFirst")}</p>}</div></div>
      <DialogFooter><Button variant="outline" disabled={editor.busy} onClick={() => void editor.readCurrent()}>{t("catalogs.review.reread")}</Button><Button disabled={editor.busy || !editor.current} onClick={() => { editor.adoptCurrent(); setReviewOpen(false); }}>{t("catalogs.review.adopt")}</Button></DialogFooter>
    </DialogContent></Dialog>
    <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={guard.leave} />
    <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} onConfirm={() => { guard.allowNextNavigation(); void navigate("/catalogos"); }} />
  </Page>;
}
