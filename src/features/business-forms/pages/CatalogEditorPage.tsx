import { catalogItemProblems, duplicateCatalogTexts, generateMissingCatalogCodes } from "../catalogEditing";
import { indexedValidationIssues } from "../validationPaths";
import { readCatalogFieldFeedback, type CatalogInvalidFieldRow } from "../api/catalogFieldFeedback";
import { CatalogFieldConversionDialog } from "../components/CatalogFieldConversionDialog";
import { CatalogFieldsSection } from "../components/CatalogFieldsSection";
import { CatalogPresentationSection } from "../components/CatalogPresentationSection";
import { CatalogImportDialog } from "../components/CatalogImportDialog";
import { CatalogPreview } from "../components/CatalogPreview";
import { CatalogOptionsActions } from "../components/CatalogOptionsActions";
import { useCatalogExport } from "../hooks/useCatalogExport";
import { isCatalogValueType, parseCatalogValue, type CatalogValueType } from "../catalogValues";
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useSystemPresentation } from "@/shared/api/presentation";
import { usePagination } from "@/shared/hooks/usePagination";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { FilterChip } from "@/shared/ui/FilterChip";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { Page } from "@/shared/ui/Page";
import { SearchInput } from "@/shared/ui/SearchInput";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import type { CatalogDetail } from "../api/catalogResponse";
import { catalogItemFieldIssues, catalogItemValue, editedFieldIds } from "../catalogDraft";
import { catalogFieldProblemText, catalogFieldRowReason, type CatalogFieldDraft, type CatalogFieldType } from "../catalogFields";
import { administrativeName } from "../editorModel";
import { catalogItemChanges, currentCatalogItem } from "../catalogItemEdits";
import { CatalogManualItemsEditor } from "../components/CatalogManualItemsEditor";
import { CatalogStateAction } from "../components/CatalogStateAction";
import { CatalogMetadataFields } from "../components/CatalogMetadataFields";
import { useCatalogDraftEditor, type CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems } from "../hooks/useCatalogQueries";

import { CatalogFiltersEditorPage } from "./CatalogFiltersEditorPage";

// The rows the server rejected for one field: a type or source change that does not convert (`type`, which opens «Cambiar el
// tipo»), or a narrowed rule, «único» switched on or a restore (`Forms.Catalog.FieldValuesIncompatible`, on that control).
// They stay marked until edited, until the next Save, or until the field they were judged against (`field`) changes again:
// its type, source or state for a conversion, and also its rules for the rest. `showRows` filters the options table to
// them; `totalCount` keeps the unfiltered list's count, so the last option still cannot move down.
interface FieldErrorRows {
  readonly control: string; readonly field: CatalogFieldDraft; readonly from: CatalogFieldType;
  readonly convertedCount: number; readonly invalidCount: number; readonly rows: readonly CatalogInvalidFieldRow[];
  readonly open: boolean; readonly showRows: boolean; readonly totalCount?: number;
}
const conversionKeys = ["isActive", "type", "sourceCatalogId"] as const;
const ruleKeys = [...conversionKeys, "maxLength", "min", "max", "unique"] as const;
const incompatibleControls = ["isActive", "maxLength", "min", "max", "unique"];
// An option has one text control, in the menu language: leaving it touches the option's text in either language, so a
// missing original shows under it too.
const touchedKey = (localId: string, path: string) => localId + "\u0000" + (path.startsWith("text.") ? "text" : path);

export function CatalogEditorPage() {
  const { t, i18n } = useTranslation("forms");
  const { catalogId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const { data: user } = useCurrentUser();
  const scope: CatalogReadScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const detail = useCatalogDetail(scope, catalogId);
  const detailOwner = JSON.stringify([scope.actorId, scope.culture, catalogId]);
  const canRead = scope.actorId !== null && scope.permissions.includes("formcatalogs.read");
  const [mountedDetail, setMountedDetail] = useState<{ owner: string; detail: CatalogDetail } | null>(null);
  // A permitted metadata refetch never replaces or unmounts the current draft. Losing Read drops the baseline.
  if (!canRead && mountedDetail) setMountedDetail(null);
  else if (canRead && detail.data && mountedDetail?.owner !== detailOwner) setMountedDetail({ owner: detailOwner, detail: detail.data });
  else if (mountedDetail && mountedDetail.owner !== detailOwner) setMountedDetail(null);
  const initial = canRead && mountedDetail?.owner === detailOwner ? mountedDetail.detail : detail.data;
  const feedbackId = "catalogs:detail:" + useId();
  useEffect(() => () => { dismissNotification(feedbackId); }, [feedbackId]);
  useEffect(() => {
    if (!detail.error) { dismissNotification(feedbackId); return; }
    if (["cancelled", "session", "forbidden"].includes(errorFeedback(detail.error).kind) || detail.error instanceof ApiError && detail.error.status === 404) return;
    notify({ id: feedbackId, kind: "error", message: readErrorMessage(detail.error, t) });
  }, [detail.error, feedbackId, t]);
  if (!user) return <Page title={t("catalogs.title")}><Spinner /></Page>;
  if (!scope.permissions.includes("formcatalogs.read") || detail.error instanceof ApiError && detail.error.status === 403) return <ForbiddenPage />;
  if (catalogId && detail.isPending && !initial) return <Page title={t("catalogs.title")}><Spinner /></Page>;
  if (catalogId && !initial) return <Page title={t("catalogs.title")} backTo={{ to: "/catalogos", label: t("catalogs.title") }}><EmptyState title={t(detail.error instanceof ApiError && detail.error.status === 404 ? "catalogs.notFound" : "catalogs.detailFailed")} action={<Button variant="outline" onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button>} /></Page>;
  if (!catalogId && !scope.permissions.includes("formcatalogs.manage")) return <ForbiddenPage />;
  if ((initial?.kind ?? searchParams.get("kind")) === "Filters") return <CatalogFiltersEditorPage key={detailOwner} scope={scope} initial={initial} timeZoneId={user.timeZoneId} />;
  const requestedType = searchParams.get("valueType");
  const valueType = isCatalogValueType(requestedType) ? requestedType : "Text";
  return <ManualCatalogEditor key={JSON.stringify([scope.actorId, scope.culture, catalogId, initial?.valueType ?? valueType])} scope={scope} initial={initial} valueType={valueType} timeZoneId={user.timeZoneId} />;
}

function ManualCatalogEditor({ scope, initial, valueType, timeZoneId }: { scope: CatalogReadScope; initial?: CatalogDetail; valueType: CatalogValueType; timeZoneId: string }) {
  const { t } = useTranslation("forms");
  const navigate = useNavigate();
  const editor = useCatalogDraftEditor(scope, initial, "Manual", valueType);
  // No language selector: the texts are edited in the menu language, which is the original of a new catalog. Changing the
  // menu language remounts the editor.
  const culture = scope.culture;
  const original = initial?.originalCulture ?? scope.culture;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [importSource, setImportSource] = useState<"file" | "paste" | null>(null);
  const importFocus = useRef<HTMLButtonElement>(null);
  const [handledValidation, setHandledValidation] = useState<unknown>(null);
  const [errorRows, setErrorRows] = useState<FieldErrorRows | null>(null);
  // The options that were in the draft when Save was tried, and the controls left (`touchedKey`): where an empty value shows.
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(() => new Set());
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  // The option a failed Save opened: its first marked control takes the focus, even when it was already open.
  const [focusOption, setFocusOption] = useState<{ localId: string } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const active = useRef(true);
  const feedbackId = "catalogs:editor:" + useId();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const draft = editor.draft;
  const exported = useCatalogExport(scope, draft?.id ?? null);
  const pageSize = Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : 20;
  const page = Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1;
  const rowFilter = errorRows?.showRows ? errorRows.rows.map(row => row.itemId) : null;
  const items = useCatalogItems(scope, draft?.id ?? "", draft?.revision ?? null, rowFilter ? { page: 1, pageSize: 50, sort: "position", ids: rowFilter } : { page, pageSize, sort: "position", search: pagination.search });
  const loadItems = editor.loadItems;
  useEffect(() => { if (items.data) loadItems(items.data.items, draft?.revision ?? null); }, [items.data, loadItems, draft?.revision]);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  const guard = useUnsavedChangesGuard(editor.dirty || editor.busy, { queryKeys: ["kind", "valueType"], remountsOnLanguageChange: true });
  const canManage = scope.permissions.includes("formcatalogs.manage") && (initial?.kind ?? "Manual") === "Manual";
  const readOnly = !editor.canSave;
  const fields = editor.error instanceof ApiError ? editor.error.errors ?? {} : {};
  const fieldFeedback = editor.error instanceof ApiError ? readCatalogFieldFeedback(editor.error.problem) : null;
  const changedItems = draft ? catalogItemChanges(draft.items) : [];
  const itemErrors: Record<string, Record<string, readonly string[]>> = {};
  const itemErrorPaths: string[] = [];
  for (const issue of indexedValidationIssues(changedItems, fields, "items")) {
    (itemErrors[issue.localId] ??= {})[issue.relativePath] = issue.messages;
    itemErrorPaths.push(issue.path);
  }
  const definitionErrors: Record<string, Record<string, readonly string[]>> = {};
  const definitionErrorPaths: string[] = [];
  for (const issue of indexedValidationIssues(draft?.fields ?? [], fields, "fields")) {
    (definitionErrors[issue.localId] ??= {})[issue.relativePath] = issue.messages;
    definitionErrorPaths.push(issue.path);
  }
  const knownItems = draft ? [...Object.values(draft.items.originals).map(item => currentCatalogItem(draft.items, item)), ...changedItems.filter(item => item.itemId === null)] : [];
  const itemWarnings: Record<string, string> = {};
  // What the editor finds wrong in the options before saving. An empty control (`required`) is marked only after Save was
  // tried with that option in the draft or after leaving that control; the rest show while typing.
  const itemProblems: { localId: string; path: string; required: boolean; message: string }[] = [];
  for (const issue of catalogItemProblems(knownItems, original)) {
    const key = issue.kind === "duplicateCode" ? issue.otherPosition ? "duplicateCode" : "duplicateCodeNew" : issue.kind;
    itemProblems.push({ localId: issue.localId, path: issue.field, required: issue.kind === "required", message: t("catalogs.items." + key, { row: issue.otherPosition }) });
  }
  for (const [localId, duplicate] of Object.entries(duplicateCatalogTexts(knownItems, culture))) itemWarnings[localId] = t("catalogs.items." + (duplicate ? "duplicateText" : "duplicateTextNew"), { row: duplicate });
  if (draft) for (const item of changedItems) {
    const parsed = parseCatalogValue(draft.valueType, item.value, draft.culture);
    if (!parsed.valid) itemProblems.push({ localId: item.localId, path: "value", required: parsed.reason === "required", message: t("catalogs.valueType." + parsed.reason) });
    for (const issue of catalogItemFieldIssues(draft, item)) {
      const field = draft.fields.find(field => field.id === issue.fieldId)!;
      itemProblems.push({ localId: item.localId, path: "fields." + issue.fieldId, required: issue.reason === "required", message: catalogFieldProblemText(t, field, item.fields?.[issue.fieldId] ?? null, issue.reason, draft.culture) });
    }
  }
  for (const problem of itemProblems) if (!problem.required || attempted.has(problem.localId) || touched.has(touchedKey(problem.localId, problem.path))) (itemErrors[problem.localId] ??= {})[problem.path] = [problem.message];
  const errorField = errorRows ? draft?.fields.find(field => field.localId === errorRows.field.localId) : undefined;
  if (errorRows && (!errorField || (errorRows.control === "type" ? conversionKeys : ruleKeys).some(key => errorField[key] !== errorRows.field[key]))) setErrorRows(null);
  if (draft && errorRows && errorField?.id) {
    const fieldId = errorField.id;
    for (const row of errorRows.rows) {
      const original = draft.items.originals["item:" + row.itemId];
      if (original && editedFieldIds(draft, currentCatalogItem(draft.items, original)).includes(fieldId)) continue;
      (itemErrors[row.itemId] ??= {})["fields." + fieldId] ??= [catalogFieldProblemText(t, errorField, row.value, catalogFieldRowReason(errorRows.control, errorField, row.reason), draft.culture)];
    }
  }
  const itemErrorPathsStamp = JSON.stringify([...itemErrorPaths, ...definitionErrorPaths]);
  const currentName = administrativeName(draft?.name, scope.culture) || t("catalogs.new");
  useBreadcrumbLeaf(currentName);
  useEffect(() => {
    const error = editor.error ?? items.error;
    if (!error) { dismissNotification(feedbackId); return; }
    const feedback = errorFeedback(error, { writing: !!editor.error, fields: ["name.es", "name.en", "description.es", "description.en", "fields", "presentation", "presentation.title", "presentation.description", ...JSON.parse(itemErrorPathsStamp) as string[]], conflictCodes: ["Forms.Catalog.RevisionConflict"] });
    if (["cancelled", "session", "forbidden", "fields", "conflict"].includes(feedback.kind)) return;
    notify({ id: feedbackId, kind: "error", message: editor.error ? operationalErrorMessage(error, t, "save") : readErrorMessage(error, t) });
  }, [editor.error, items.error, feedbackId, t, itemErrorPathsStamp]);
  if (editor.error !== handledValidation) {
    setHandledValidation(editor.error);
    const code = editor.error instanceof ApiError ? editor.error.code : null;
    const controls = code === "Forms.Catalog.FieldTypeNotConvertible" ? ["type"] : code === "Forms.Catalog.FieldValuesIncompatible" ? incompatibleControls : [];
    const failed = draft?.fields.flatMap(field => controls.filter(control => definitionErrors[field.localId]?.[control]).map(control => ({ field, control })))[0];
    const savedType = draft?.savedFields.find(field => field.id === failed?.field.id)?.type;
    if (fieldFeedback?.invalidRows?.length && failed && savedType)
      setErrorRows({ control: failed.control, field: failed.field, from: savedType, convertedCount: fieldFeedback.convertedCount ?? 0, invalidCount: fieldFeedback.invalidCount ?? fieldFeedback.invalidRows.length, rows: fieldFeedback.invalidRows, open: failed.control === "type", showRows: false });
    const invalidItem = changedItems.find(item => itemErrors[item.localId]);
    if (invalidItem) setExpanded(invalidItem.localId);
  }
  const save = async () => {
    if (!editor.canSave) return;
    if (itemProblems.length) {
      // Trying to save marks what is empty in every option of the draft, which then validates as it is corrected, and opens
      // the first option with a problem, with the focus on the first control it marks. Nothing is sent.
      setAttempted(new Set(knownItems.map(item => item.localId)));
      const failing = new Set(itemProblems.map(problem => problem.localId));
      const first = [...changedItems, ...knownItems].find(item => failing.has(item.localId))!.localId;
      setExpanded(first);
      setFocusOption({ localId: first });
      return;
    }
    setErrorRows(null);
    const saved = await editor.save();
    if (!saved || !active.current) return;
    setAttempted(new Set()); setTouched(new Set());
    setExpanded(null);
    notify({ id: feedbackId, kind: "success", message: t("catalogs.saved") });
    if (!initial) { guard.allowNextNavigation(); void navigate("/catalogos/" + saved.catalog.id, { replace: true }); }
  };
  const addItem = () => {
    if (!editor.canSave || !draft) return;
    const localId = crypto.randomUUID();
    editor.changeItem({ localId, itemId: null, label: { es: null, en: null }, detail: { es: null, en: null }, code: "", value: null, isActive: true, position: null });
    setExpanded(localId);
  };
  const generateCodes = () => generateMissingCatalogCodes(knownItems).forEach((item, index) => { if (knownItems[index]!.code !== item.code) editor.changeItem(item); });
  const generateCode = (localId: string) => generateMissingCatalogCodes(knownItems).filter(item => item.localId === localId).forEach(editor.changeItem);
  const rowItems = draft ? [...(items.data?.items ?? []).map(item => currentCatalogItem(draft.items, catalogItemValue(item, draft.valueType, draft.culture, draft.savedFields))), ...catalogItemChanges(draft.items).filter(item => item.itemId === null)] : [];
  const restoreReviewFocus = useRestoreFocusOnClose(reviewOpen);
  // Runs after the option editor's own effect, which puts the cursor in Texto when it opens, so the marked control keeps the
  // focus; focusing it also scrolls it into view.
  useEffect(() => { if (focusOption) host.current?.querySelector<HTMLElement>('[data-catalog-option="' + focusOption.localId + '"] [aria-invalid="true"]')?.focus(); }, [focusOption]);
  const hideErrorRows = () => setErrorRows(current => current && { ...current, showRows: false });
  const showErrorRows = () => { setExpanded(null); setErrorRows(current => current && { ...current, open: false, showRows: true, totalCount: items.data?.totalCount }); };
  if (!draft || [editor.error, items.error, exported.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  return <Page title={currentName} backTo={{ to: "/catalogos", label: t("catalogs.title") }} status={<span className="text-xs text-[var(--color-content-muted)]">{initial?.usageCount !== null && initial?.usageCount !== undefined ? <>{t("catalogs.usageHeader", { count: initial.usageCount })} · </> : null}{t(draft.isActive ? "catalogs.state.Active" : "catalogs.state.Inactive")}</span>}
    actions={canManage ? <>{draft.id ? <CatalogStateAction isActive={draft.isActive} disabled={!editor.canSave} onChange={isActive => editor.changeMetadata({ isActive })} /> : null}<Button variant="outline" disabled={editor.busy} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button><Button disabled={readOnly} onClick={() => void save()}>{t("common:actions.save")}</Button></> : undefined}>
    <div ref={host} className="flex flex-col gap-4">
      {editor.requiresReview ? <Surface title={t("catalogs.review.title")} padded actions={<Button variant="outline" disabled={editor.busy} onClick={() => setReviewOpen(true)}>{t("common:actions.review")}</Button>}><p className="text-sm">{t("catalogs.review.required")}</p></Surface> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="flex min-w-0 flex-col gap-4"><CatalogMetadataFields valueType={draft.valueType} name={draft.name} description={draft.description} culture={culture} original={original} origin={initial?.kind ?? "Manual"} canManage={canManage} busy={readOnly} errors={fields} onChange={editor.changeMetadata} /><CatalogPresentationSection value={draft.presentation} fields={draft.fields} items={rowItems} valueType={draft.valueType} culture={culture} readOnly={readOnly} errors={fields} inputCulture={draft.culture} check={!editor.dirty ? (editor.confirmed ?? initial)?.presentationCheck : undefined} onChange={editor.changePresentation} /></div><div className="xl:sticky xl:top-4"><CatalogPreview items={rowItems} fields={draft.fields} presentation={draft.presentation} valueType={draft.valueType} inputCulture={draft.culture} name={currentName} culture={culture} /></div></div>
      <CatalogFieldsSection fields={draft.fields} presentation={draft.presentation} culture={culture} original={original} scope={scope} readOnly={readOnly} confirmedRemovals={draft.confirmFieldRemovals} errors={definitionErrors} feedback={fieldFeedback} rootErrors={fields.fields} errorRows={errorRows && errorRows.control !== "type" && !errorRows.showRows ? { count: errorRows.rows.length, onShow: showErrorRows } : undefined} onChange={editor.changeFields} />
      {draft.sortAlphabetically ? <Surface padded><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{t("catalogs.actions.sortPending")}</p><Button variant="outline" disabled={readOnly} onClick={() => editor.changeSort(false)}>{t("catalogs.actions.clearSort")}</Button></div></Surface> : null}
      {draft.moves.length ? <Surface padded><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{t("catalogs.items.movesPending", { count: draft.moves.length })}</p><Button variant="outline" disabled={readOnly} onClick={editor.clearMoves}>{t("catalogs.items.clearMoves")}</Button></div></Surface> : null}
      {draft.id && items.isPending ? <Surface padded><Spinner /></Surface> : items.error && !items.data ? <EmptyState title={t("catalogs.items.loadFailed")} action={<Button variant="outline" onClick={() => void items.refetch()}>{t("common:actions.retry")}</Button>} /> : <CatalogManualItemsEditor fields={draft.fields} scope={scope} sortPending={draft.sortAlphabetically} warnings={itemWarnings} onGenerateCode={item => generateCode(item.localId)} actions={<CatalogOptionsActions canManage={canManage} busy={readOnly && canManage} saved={!!draft.id} importDisabledReason={!draft.id ? t("catalogs.actions.saveFirst") : editor.dirty ? t("catalogs.actions.saveChangesFirst") : null} hasPendingMoves={draft.moves.length > 0} sortPending={draft.sortAlphabetically} dialogOpen={importSource !== null} focusRef={importFocus} onImport={setImportSource} onExport={template => void exported.download(template)} onSort={() => editor.changeSort(true)} onGenerateCodes={generateCodes} />} valueType={draft.valueType} items={rowItems} editingItems={changedItems} errors={itemErrors} culture={culture} original={original} canManage={canManage} busy={readOnly} hasPendingMoves={draft.moves.length > 0} expandedKey={expanded} onExpand={setExpanded} onChange={editor.changeItem} onFieldBlur={(localId, path) => setTouched(current => current.has(touchedKey(localId, path)) ? current : new Set(current).add(touchedKey(localId, path)))} onAdd={addItem} onMove={(item, direction) => { if (item.itemId) editor.changeMove(item.itemId, direction === -1 ? "up" : "down"); }}
        filters={draft.id ? <><div className="p-4"><SearchInput label={t("catalogs.items.search")} value={pagination.search ?? ""} onChange={search => { hideErrorRows(); pagination.setSearch(search); }} /></div>{rowFilter ? <FilterChip removeLabel={t("catalogs.items.clearErrorRows")} onRemove={hideErrorRows}>{t("catalogs.items.errorRows", { count: rowFilter.length })}</FilterChip> : null}</> : undefined}
        pagination={rowFilter ? undefined : items.data} totalCount={rowFilter ? errorRows?.totalCount : undefined} onPageChange={next => { setExpanded(null); pagination.setPage(next); }} onPageSizeChange={next => { setExpanded(null); pagination.setPageSize(next); }} />}
    </div>
    {importSource && draft.id && canManage ? <CatalogImportDialog scope={scope} catalog={editor.confirmed ?? initial!} initialSource={importSource} timeZoneId={timeZoneId} focusFallback={importFocus} onClose={() => setImportSource(null)} onObserved={editor.observeCatalog} onApplied={catalog => { editor.observeCatalog(catalog); setExpanded(null); }} onTemplate={() => void exported.download(true)} /> : null}
    {errorRows?.open && errorField ? <CatalogFieldConversionDialog name={administrativeName(errorField.name, culture) || t("catalogs.fields.new")} from={errorRows.from} field={errorField} culture={draft.culture}convertedCount={errorRows.convertedCount} invalidCount={errorRows.invalidCount} rows={errorRows.rows} onClose={() => setErrorRows(current => current && { ...current, open: false })} onShowRows={showErrorRows} /> : null}
    <ConfirmDialog open={discardOpen || guard.isBlocked} onOpenChange={open => { if (!open) { setDiscardOpen(false); guard.stay(); } }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} cancelLabel={t("stay")} destructive onConfirm={() => { if (guard.isBlocked) guard.leave(); else { guard.allowNextNavigation(); void navigate("/catalogos"); } }} />
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent onCloseAutoFocus={restoreReviewFocus} className="sm:max-w-2xl"><DialogHeader><DialogTitle>{t("catalogs.review.title")}</DialogTitle><DialogDescription>{t("catalogs.review.description")}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">{([{ key: "mine", value: draft }, { key: "current", value: editor.current }] as const).map(entry => <Surface key={entry.key} title={t("catalogs.review." + entry.key)} padded>{entry.value ? <><p className="text-sm">{administrativeName(entry.value.name, culture)}</p><p className="text-xs text-[var(--color-content-muted)]">{administrativeName(entry.value.description, culture)}</p></> : <p className="text-sm">{t("catalogs.review.readFirst")}</p>}</Surface>)}</div>
      <DialogFooter><Button variant="outline" onClick={() => setReviewOpen(false)}>{t("common:actions.close")}</Button><Button variant="outline" disabled={editor.busy || !draft.id} onClick={() => void editor.readCurrent()}>{t("catalogs.review.reread")}</Button><Button disabled={editor.busy || !editor.current} onClick={() => { editor.adoptCurrent(); setErrorRows(null); setAttempted(new Set()); setTouched(new Set()); setExpanded(null); setReviewOpen(false); }}>{t("catalogs.review.adopt")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Page>;
}
