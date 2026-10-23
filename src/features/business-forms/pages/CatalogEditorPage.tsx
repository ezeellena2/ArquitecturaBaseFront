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
import { catalogFieldProblemText, type CatalogFieldType } from "../catalogFields";
import { localizedValue } from "../editorModel";
import { catalogItemChanges, currentCatalogItem } from "../catalogItemEdits";
import { CatalogManualItemsEditor } from "../components/CatalogManualItemsEditor";
import { CatalogStateAction } from "../components/CatalogStateAction";
import { CatalogMetadataFields } from "../components/CatalogMetadataFields";
import { useCatalogDraftEditor, type CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { useCatalogDetail, useCatalogItems } from "../hooks/useCatalogQueries";
import type { FormCulture } from "../model";

import { CatalogFiltersEditorPage } from "./CatalogFiltersEditorPage";

// A type or source change the server could not convert: its rows stay marked until edited, until the next Save, or
// until that field's type or source changes again. `showRows` filters the options table to them; `totalCount` keeps
// the unfiltered list's count, so the last option still cannot move down.
interface FieldConversion {
  readonly fieldLocalId: string; readonly from: CatalogFieldType; readonly to: CatalogFieldType; readonly sourceCatalogId: string | null;
  readonly convertedCount: number; readonly invalidCount: number; readonly rows: readonly CatalogInvalidFieldRow[];
  readonly open: boolean; readonly showRows: boolean; readonly totalCount?: number;
}

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
  const [culture, setCulture] = useState<FormCulture>("es");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [importSource, setImportSource] = useState<"file" | "paste" | null>(null);
  const importFocus = useRef<HTMLButtonElement>(null);
  const [handledValidation, setHandledValidation] = useState<unknown>(null);
  const [conversion, setConversion] = useState<FieldConversion | null>(null);
  const active = useRef(true);
  const feedbackId = "catalogs:editor:" + useId();
  const presentation = useSystemPresentation();
  const pagination = usePagination(presentation.data?.defaultPageSize, true);
  const draft = editor.draft;
  const exported = useCatalogExport(scope, draft?.id ?? null);
  const pageSize = Number.isSafeInteger(pagination.pageSize) && pagination.pageSize >= 1 && pagination.pageSize <= 100 ? pagination.pageSize : 20;
  const page = Number.isSafeInteger(pagination.page) && pagination.page > 0 ? pagination.page : 1;
  const rowFilter = conversion?.showRows ? conversion.rows.map(row => row.itemId) : null;
  const items = useCatalogItems(scope, draft?.id ?? "", draft?.revision ?? null, rowFilter ? { page: 1, pageSize: 50, sort: "position", ids: rowFilter } : { page, pageSize, sort: "position", search: pagination.search });
  const loadItems = editor.loadItems;
  useEffect(() => { if (items.data) loadItems(items.data.items, draft?.revision ?? null); }, [items.data, loadItems, draft?.revision]);
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  const guard = useUnsavedChangesGuard(editor.dirty || editor.busy, ["kind", "valueType"]);
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
  const localProblems = catalogItemProblems(knownItems);
  for (const issue of localProblems) {
    const key = issue.kind === "duplicateCode" ? issue.otherPosition ? "duplicateCode" : "duplicateCodeNew" : issue.kind;
    (itemErrors[issue.localId] ??= {})[issue.field] = [t("catalogs.items." + key, { row: issue.otherPosition })];
  }
  for (const [localId, duplicate] of Object.entries(duplicateCatalogTexts(knownItems, culture))) itemWarnings[localId] = t("catalogs.items." + (duplicate ? "duplicateText" : "duplicateTextNew"), { row: duplicate });
  const invalidValues = draft ? changedItems.flatMap(item => {
    const parsed = parseCatalogValue(draft.valueType, item.value, draft.culture);
    if (parsed.valid) return [];
    (itemErrors[item.localId] ??= {}).value = [t("catalogs.valueType." + parsed.reason)];
    return [item.localId];
  }) : [];
  const invalidFieldValues = draft ? changedItems.flatMap(item => {
    const issues = catalogItemFieldIssues(draft, item);
    for (const issue of issues) (itemErrors[item.localId] ??= {})["fields." + issue.fieldId] = [t("catalogs.fields." + issue.reason)];
    return issues.length ? [item.localId] : [];
  }) : [];
  const conversionField = conversion ? draft?.fields.find(field => field.localId === conversion.fieldLocalId) : undefined;
  if (conversion && (!conversionField?.isActive || conversionField.type !== conversion.to || conversionField.sourceCatalogId !== conversion.sourceCatalogId)) setConversion(null);
  if (draft && conversion && conversionField?.id) {
    const fieldId = conversionField.id;
    for (const row of conversion.rows) {
      const original = draft.items.originals["item:" + row.itemId];
      if (original && editedFieldIds(draft, currentCatalogItem(draft.items, original)).includes(fieldId)) continue;
      (itemErrors[row.itemId] ??= {})["fields." + fieldId] ??= [catalogFieldProblemText(t, conversionField, row.value, row.reason)];
    }
  }
  const itemErrorPathsStamp = JSON.stringify([...itemErrorPaths, ...definitionErrorPaths]);
  const currentName = draft?.name[scope.culture] || t("catalogs.new");
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
    const keys = Object.keys(editor.error instanceof ApiError ? editor.error.errors ?? {} : {});
    if (keys.some(key => key === "name.en" || key === "description.en")) setCulture("en");
    else if (keys.some(key => key === "name.es" || key === "description.es")) setCulture("es");
    const typeChanged = draft?.fields.find(field => definitionErrors[field.localId]?.type);
    const savedType = draft?.savedFields.find(field => field.id === typeChanged?.id)?.type;
    if (editor.error instanceof ApiError && editor.error.code === "Forms.Catalog.FieldTypeNotConvertible" && fieldFeedback?.invalidRows?.length && typeChanged && savedType)
      setConversion({ fieldLocalId: typeChanged.localId, from: savedType, to: typeChanged.type, sourceCatalogId: typeChanged.sourceCatalogId, convertedCount: fieldFeedback.convertedCount ?? 0, invalidCount: fieldFeedback.invalidCount ?? fieldFeedback.invalidRows.length, rows: fieldFeedback.invalidRows, open: true, showRows: false });
    const invalidItem = changedItems.find(item => itemErrors[item.localId]);
    if (invalidItem) {
      setExpanded(invalidItem.localId);
      setCulture(Object.keys(itemErrors[invalidItem.localId]!).some(key => key.endsWith(".en")) ? "en" : "es");
    }
  }
  const save = async () => {
    if (!editor.canSave || invalidValues.length || invalidFieldValues.length || localProblems.length) return;
    setConversion(null);
    const saved = await editor.save();
    if (!saved || !active.current) return;
    setExpanded(null);
    notify({ id: feedbackId, kind: "success", message: t("catalogs.saved") });
    if (!initial) { guard.allowNextNavigation(); void navigate("/catalogos/" + saved.catalog.id, { replace: true }); }
  };
  const addItem = () => {
    if (!editor.canSave || !draft) return;
    const localId = crypto.randomUUID();
    editor.changeItem({ localId, itemId: null, label: { es: "", en: null }, detail: { es: null, en: null }, code: "", value: null, isActive: true, position: null });
    setExpanded(localId);
  };
  const generateCodes = () => generateMissingCatalogCodes(knownItems).forEach((item, index) => { if (knownItems[index]!.code !== item.code) editor.changeItem(item); });
  const generateCode = (localId: string) => generateMissingCatalogCodes(knownItems).filter(item => item.localId === localId).forEach(editor.changeItem);
  const rowItems = draft ? [...(items.data?.items ?? []).map(item => currentCatalogItem(draft.items, catalogItemValue(item, draft.valueType, draft.culture, draft.savedFields))), ...catalogItemChanges(draft.items).filter(item => item.itemId === null)] : [];
  const restoreReviewFocus = useRestoreFocusOnClose(reviewOpen);
  const hideErrorRows = () => setConversion(current => current && { ...current, showRows: false });
  if (!draft || [editor.error, items.error, exported.error].some(error => error instanceof ApiError && error.status === 403)) return <ForbiddenPage />;
  return <Page title={currentName} backTo={{ to: "/catalogos", label: t("catalogs.title") }} status={<span className="text-xs text-[var(--color-content-muted)]">{initial?.usageCount !== null && initial?.usageCount !== undefined ? <>{t("catalogs.usageHeader", { count: initial.usageCount })} · </> : null}{t(draft.isActive ? "catalogs.state.Active" : "catalogs.state.Inactive")}{editor.dirty ? <> · <span>{t("dirty")}</span></> : null}</span>}
    actions={canManage ? <>{draft.id ? <CatalogStateAction isActive={draft.isActive} disabled={!editor.canSave} onChange={isActive => editor.changeMetadata({ isActive })} /> : null}<Button variant="outline" disabled={editor.busy} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button><Button disabled={readOnly || invalidValues.length > 0 || invalidFieldValues.length > 0 || localProblems.length > 0} onClick={() => void save()}>{t("common:actions.save")}</Button></> : undefined}>
    <div className="flex flex-col gap-4">
      {editor.requiresReview ? <Surface title={t("catalogs.review.title")} padded><p className="text-sm">{t("catalogs.review.required")}</p><Button variant="outline" disabled={editor.busy} onClick={() => setReviewOpen(true)}>{t("common:actions.review")}</Button></Surface> : null}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]"><div className="flex min-w-0 flex-col gap-4"><CatalogMetadataFields valueType={draft.valueType} name={draft.name} description={draft.description} culture={culture} origin={initial?.kind ?? "Manual"} canManage={canManage} busy={readOnly} errors={fields} onCultureChange={setCulture} onChange={editor.changeMetadata} /><CatalogPresentationSection value={draft.presentation} fields={draft.fields} items={rowItems} valueType={draft.valueType} culture={culture} readOnly={readOnly} errors={fields} inputCulture={draft.culture} titleTooLongCount={!editor.dirty ? (editor.saved?.catalog ?? initial)?.presentationCheck?.titleTooLongCount : undefined} examples={!editor.dirty ? (editor.saved?.catalog ?? initial)?.presentationCheck?.examples : undefined} onChange={editor.changePresentation} /></div><div className="xl:sticky xl:top-4"><CatalogPreview items={rowItems} fields={draft.fields} presentation={draft.presentation} valueType={draft.valueType} inputCulture={draft.culture} name={draft.name[culture] || currentName} culture={culture} /></div></div>
      <CatalogFieldsSection fields={draft.fields} culture={culture} scope={scope} readOnly={readOnly} confirmedRemovals={draft.confirmFieldRemovals} errors={definitionErrors} feedback={fieldFeedback} rootErrors={fields.fields} onChange={editor.changeFields} />
      {draft.sortAlphabetically ? <Surface padded><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{t("catalogs.actions.sortPending")}</p><Button variant="outline" disabled={readOnly} onClick={() => editor.changeSort(false)}>{t("catalogs.actions.clearSort")}</Button></div></Surface> : null}
      {localProblems.length ? <p className="text-sm text-[var(--color-danger)]">{t("catalogs.items.reviewInvalid")}</p> : null}
      {draft.moves.length ? <Surface padded><div className="flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{t("catalogs.items.movesPending", { count: draft.moves.length })}</p><Button variant="outline" disabled={readOnly} onClick={editor.clearMoves}>{t("catalogs.items.clearMoves")}</Button></div></Surface> : null}
      {draft.id && items.isPending ? <Surface padded><Spinner /></Surface> : items.error && !items.data ? <EmptyState title={t("catalogs.items.loadFailed")} action={<Button variant="outline" onClick={() => void items.refetch()}>{t("common:actions.retry")}</Button>} /> : <CatalogManualItemsEditor fields={draft.fields} scope={scope} sortPending={draft.sortAlphabetically} warnings={itemWarnings} onGenerateCode={item => generateCode(item.localId)} actions={<CatalogOptionsActions canManage={canManage} busy={readOnly && canManage} saved={!!draft.id} importDisabledReason={!draft.id ? t("catalogs.actions.saveFirst") : editor.dirty ? t("catalogs.actions.saveChangesFirst") : null} hasPendingMoves={draft.moves.length > 0} sortPending={draft.sortAlphabetically} dialogOpen={importSource !== null} focusRef={importFocus} onImport={setImportSource} onExport={template => void exported.download(template)} onSort={() => editor.changeSort(true)} onGenerateCodes={generateCodes} />} valueType={draft.valueType} items={rowItems} editingItems={changedItems} errors={itemErrors} culture={culture} canManage={canManage} busy={readOnly} hasPendingMoves={draft.moves.length > 0} expandedKey={expanded} onExpand={setExpanded} onChange={editor.changeItem} onAdd={addItem} onMove={(item, direction) => { if (item.itemId) editor.changeMove(item.itemId, direction === -1 ? "up" : "down"); }}
        filters={draft.id ? <><div className="p-4"><SearchInput label={t("catalogs.items.search")} value={pagination.search ?? ""} onChange={search => { hideErrorRows(); pagination.setSearch(search); }} /></div>{rowFilter ? <FilterChip removeLabel={t("catalogs.items.clearErrorRows")} onRemove={hideErrorRows}>{t("catalogs.items.errorRows", { count: rowFilter.length })}</FilterChip> : null}</> : undefined}
        pagination={rowFilter ? undefined : items.data} totalCount={rowFilter ? conversion?.totalCount : undefined} onPageChange={next => { setExpanded(null); pagination.setPage(next); }} onPageSizeChange={next => { setExpanded(null); pagination.setPageSize(next); }} />}
    </div>
    {importSource && draft.id && canManage ? <CatalogImportDialog scope={scope} catalog={{ ...initial!, revision: draft.revision!, name: draft.name, description: draft.description, isActive: draft.isActive }} initialSource={importSource} timeZoneId={timeZoneId} focusFallback={importFocus} onClose={() => setImportSource(null)} onObserved={editor.observeCatalog} onApplied={catalog => { editor.observeCatalog(catalog); setExpanded(null); }} onTemplate={() => void exported.download(true)} /> : null}
    {conversion?.open && conversionField ? <CatalogFieldConversionDialog name={localizedValue(conversionField.name, culture, "es") || t("catalogs.fields.new")} from={conversion.from} field={conversionField} convertedCount={conversion.convertedCount} invalidCount={conversion.invalidCount} rows={conversion.rows} onClose={() => setConversion(current => current && { ...current, open: false })} onShowRows={() => { setExpanded(null); setConversion(current => current && { ...current, open: false, showRows: true, totalCount: items.data?.totalCount }); }} /> : null}
    <ConfirmDialog open={discardOpen || guard.isBlocked} onOpenChange={open => { if (!open) { setDiscardOpen(false); guard.stay(); } }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} cancelLabel={t("stay")} destructive onConfirm={() => { if (guard.isBlocked) guard.leave(); else { guard.allowNextNavigation(); void navigate("/catalogos"); } }} />
    <Dialog open={reviewOpen} onOpenChange={setReviewOpen}><DialogContent onCloseAutoFocus={restoreReviewFocus} className="sm:max-w-2xl"><DialogHeader><DialogTitle>{t("catalogs.review.title")}</DialogTitle><DialogDescription>{t("catalogs.review.description")}</DialogDescription></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">{([{ key: "mine", value: draft }, { key: "current", value: editor.current }] as const).map(entry => <Surface key={entry.key} title={t("catalogs.review." + entry.key)} padded>{entry.value ? <><p className="text-sm">{entry.value.name.es}</p><p className="text-sm">{entry.value.name.en}</p><p className="text-xs text-[var(--color-content-muted)]">{entry.value.description.es}</p><p className="text-xs text-[var(--color-content-muted)]">{entry.value.description.en}</p></> : <p className="text-sm">{t("catalogs.review.readFirst")}</p>}</Surface>)}</div>
      <DialogFooter><Button variant="outline" onClick={() => setReviewOpen(false)}>{t("common:actions.close")}</Button><Button variant="outline" disabled={editor.busy || !draft.id} onClick={() => void editor.readCurrent()}>{t("catalogs.review.reread")}</Button><Button disabled={editor.busy || !editor.current} onClick={() => { editor.adoptCurrent(); setConversion(null); setExpanded(null); setReviewOpen(false); }}>{t("catalogs.review.adopt")}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Page>;
}
