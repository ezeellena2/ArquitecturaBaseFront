import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { cn } from "@/shared/lib/utils";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Banner } from "@/shared/ui/Banner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { DocumentIcon } from "@/shared/ui/icons";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { PasteGrid } from "@/shared/ui/PasteGrid";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { CellText } from "@/shared/ui/CellText";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchCatalog } from "../api/catalogs";
import { applyCatalogImport, previewCatalogImport, type CatalogImportPreview } from "../api/catalogImports";
import type { CatalogDetail } from "../api/catalogResponse";
import { catalogPasteColumns, catalogPasteCsv, catalogPasteExtraColumns, readCatalogPaste, type CatalogPastedSheet } from "../catalogPaste";
import { catalogScalarText, catalogTypedValueTypes, isNumericType } from "../catalogValues";
import { administrativeName } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";
import { CatalogRow as Row, CatalogRowHelp as Help, CatalogRowMessage as Message } from "./CatalogRow";

export interface CatalogImportDialogProps { scope: CatalogReadScope; catalog: CatalogDetail; timeZoneId?: string; focusFallback?: RefObject<HTMLElement | null>; onClose: () => void; onApplied: (catalog: CatalogDetail) => void; onObserved: (catalog: CatalogDetail) => void; onTemplate: () => void; downloadingTemplate?: boolean }
type Source = "file" | "paste";
function fresh(owner: string, revision: number, source: Source) {
  return { owner, revision, source, sheet: null as CatalogPastedSheet | null, file: null as File | null, preview: null as CatalogImportPreview | null, busy: null as "preview" | "apply" | null, conflict: false, forbidden: false, fileError: null as string | null, confirmDeactivations: false, confirmEmpty: false, confirmErrors: false };
}
// Another file or other rows leave the previous review behind.
const unreviewed = { preview: null, conflict: false, fileError: null, confirmDeactivations: false, confirmEmpty: false, confirmErrors: false };
const band = "text-xs text-[var(--color-surface-header-foreground)]";
// A line between rows, as in «Campos de…».
const rows = "flex flex-col divide-y divide-[var(--color-border)] [&>*]:px-4 [&>*]:py-3";

// IM1-A, IM2-A and IM3-A (2026-10-31): the origin and the review at sight, the help in the (i), a skeleton while reading and,
// while applying, Cancel and the × in sight but off. What waits says so with the common busy button (LC1-A), the template too.
export function CatalogImportDialog({ scope, catalog, timeZoneId, focusFallback, onClose, onApplied, onObserved, onTemplate, downloadingTemplate = false }: CatalogImportDialogProps) {
  const { t, i18n } = useTranslation("forms");
  const owner = JSON.stringify([scope.actorId, scope.culture, [...scope.permissions].sort(), catalog.id]);
  const fields = (catalog.fields ?? []).filter(field => field.isActive).sort((a, b) => a.position - b.position);
  const columnLabel = (column: string) => administrativeName(fields.find(field => field.id === column)?.name, scope.culture) || t("catalogs.import.columns." + column, { defaultValue: column });
  const displayColumn = (column: string, value: string | null | undefined, text?: string) => {
    if (value === null || value === undefined) return "—";
    const type = fields.find(field => field.id === column)?.type;
    if (type === "catalog") return text ?? "—";
    if (type === "boolean" || type === "integer" || type === "decimal" || type === "date") return catalogScalarText(type, value, scope.culture, { yes: t("yes"), no: t("no") });
    return column === "value" && catalog.valueType !== "Text" ? catalogScalarText(catalogTypedValueTypes[catalog.valueType], value, scope.culture) : value;
  };
  // In the grid and in the new options, a column of numbers goes to the right, as in every table (A, 2026-11-02).
  const numericColumn = (column: string | null) => isNumericType(column === "value" ? catalog.valueType : fields.find(field => field.id === column)?.type ?? "");
  const pasteLabels: Parameters<typeof catalogPasteColumns>[2] = { fixed: column => t("catalogs.import.columns." + column), field: field => administrativeName(field.name, scope.culture) || field.key };
  const pasteColumns = catalogPasteColumns(catalog.valueType, fields, pasteLabels);
  const allowed = !!scope.actorId && scope.permissions.includes("formcatalogs.read") && scope.permissions.includes("formcatalogs.manage");
  const [state, setState] = useState(() => fresh(owner, catalog.revision, "file"));
  if (state.owner !== owner) setState(fresh(owner, catalog.revision, "file"));
  const active = useRef(true), currentOwner = useRef(owner), operation = useRef<AbortController | null>(null), fileInput = useRef<HTMLInputElement>(null);
  const id = useId(), errorId = id + "error", feedbackId = "catalogs:import:" + id;
  useLayoutEffect(() => { currentOwner.current = owner; }, [owner]);
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort(); operation.current = null; dismissNotification(feedbackId); }; }, [owner, feedbackId]);
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const owned = state.owner === owner && allowed;
  const busy = !!state.busy, applying = state.busy === "apply";
  const accepts = (controller: AbortController) => active.current && currentOwner.current === owner && operation.current === controller && !controller.signal.aborted;
  const failure = (error: unknown, controller: AbortController, writing: boolean) => {
    if (!accepts(controller)) return;
    if (error instanceof ApiError && error.status === 403) { setState(value => ({ ...fresh(owner, value.revision, value.source), forbidden: true })); return; }
    if (error instanceof ApiError && ["Forms.CatalogImport.MissingColumn", "Forms.CatalogImport.DuplicateColumn"].includes(error.code ?? "") && typeof error.problem.column === "string") {
      setState(value => ({ ...value, busy: null, fileError: t(error.code === "Forms.CatalogImport.MissingColumn" ? "catalogs.import.missingColumn" : "catalogs.import.duplicateColumn", { column: columnLabel(error.problem.column as string) }) }));
      return;
    }
    const conflict = error instanceof ApiError && error.status === 409;
    const fileError = error instanceof ApiError ? error.errors?.file?.join(" ") : undefined;
    setState(value => ({ ...value, busy: null, conflict, fileError: fileError ?? null }));
    if (!["cancelled", "session", "fields"].includes(errorFeedback(error, { fields: ["file"] }).kind)) {
      const message = writing ? operationalErrorMessage(error, t, "save") : readErrorMessage(error, t);
      const sheet = error instanceof ApiError && ["Forms.CatalogImport.TooManyColumns", "Forms.CatalogImport.TooManyRows", "Forms.CatalogImport.TooManyCells"].includes(error.code ?? "") && typeof error.problem.sheet === "string" ? error.problem.sheet : null;
      notify({ id: feedbackId, kind: "error", message: sheet ? t("catalogs.import.sheetError", { sheet, message }) : message });
    }
  };
  // The pasted rows are reviewed as a CSV of the pasted columns only, so a column that was not pasted keeps its values.
  const review = async (refresh = false) => {
    if (!owned || state.forbidden || operation.current) return;
    let file = state.file;
    if (state.source === "paste" && !file) {
      if (!state.sheet) { setState(value => ({ ...value, fileError: t("catalogs.import.pasteEmpty") })); return; }
      file = new File([catalogPasteCsv(state.sheet)], t("catalogs.import.pastedFileName"), { type: "text/csv" });
    }
    if (!file || !/\.(csv|xlsx)$/i.test(file.name) || file.size > 10 * 1024 * 1024) { setState(value => ({ ...value, fileError: t(state.source === "paste" ? "catalogs.import.pasteError.limit" : "catalogs.import.fileError") })); return; }
    const capturedFile = file, controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, file: capturedFile, busy: "preview", fileError: null }));
    try {
      let revision = state.revision;
      if (refresh) { const current = await fetchCatalog(catalog.id, controller.signal); if (!accepts(controller)) return; revision = current.revision; onObserved(current); }
      const preview = await previewCatalogImport(catalog.id, { file: capturedFile, expectedRevision: revision, mode: state.source === "paste" ? "Append" : "Replace" }, controller.signal);
      if (accepts(controller)) setState(value => ({ ...value, revision, preview, busy: null, conflict: false, confirmDeactivations: false, confirmEmpty: false, confirmErrors: false }));
    } catch (error) { failure(error, controller, false); }
    finally { if (operation.current === controller) operation.current = null; }
  };
  const preview = owned ? state.preview : null;
  const confirmed = !!preview && (!preview.confirmations.deactivations || state.confirmDeactivations) && (!preview.confirmations.emptySheet || state.confirmEmpty) && (!preview.confirmations.manyErrors || state.confirmErrors);
  const apply = async () => {
    if (!owned || !preview || !state.file || !confirmed || state.conflict || state.forbidden || operation.current) return;
    const controller = new AbortController(); operation.current = controller;
    setState(value => ({ ...value, busy: "apply" }));
    try {
      const saved = await applyCatalogImport(catalog.id, { file: state.file, expectedRevision: state.revision, mode: preview.mode, sheetSha256: preview.sheetSha256,
        confirmDeactivations: preview.confirmations.deactivations, confirmEmpty: state.confirmEmpty, confirmErrors: preview.counts.errorRows > 0 }, controller.signal);
      if (!accepts(controller)) return;
      notify({ id: feedbackId + ":done", kind: "success", message: t("catalogs.import.applied") }); onApplied(saved.catalog); onClose();
    } catch (error) { failure(error, controller, true); }
    finally { if (operation.current === controller) { operation.current = null; if (active.current) setState(value => ({ ...value, busy: null })); } }
  };
  const close = () => { if (applying) return; operation.current?.abort(); operation.current = null; setState(fresh(owner, state.revision, state.source)); onClose(); };
  const changeSource = (source: Source) => { if (!busy) setState(fresh(owner, state.revision, source)); };
  const chooseFile = (file: File) => { if (!busy) setState(value => ({ ...value, ...unreviewed, file })); };
  const paste = (text: string) => {
    if (busy) return;
    const read = readCatalogPaste(text, pasteColumns, catalogPasteExtraColumns(catalog.originalCulture, pasteLabels));
    setState(value => ({ ...value, ...unreviewed, file: null, sheet: read.valid ? read.sheet : null, fileError: read.valid ? null : t("catalogs.import.pasteError." + read.reason) }));
  };
  const clear = () => { if (!busy) setState(value => ({ ...value, ...unreviewed, file: null, sheet: null })); };
  const confirmation = (key: "confirmDeactivations" | "confirmEmpty" | "confirmErrors", label: string, help?: ReactNode) => <div key={key} className="flex items-center gap-2">
    <Checkbox id={id + key} checked={state[key]} disabled={busy} onCheckedChange={value => setState(current => ({ ...current, [key]: value === true }))} />
    <Label htmlFor={id + key} className="font-normal">{label}</Label>{help}
  </div>;

  const origin = <Surface title={t("catalogs.import.origin")} headingLevel={3} actions={state.source === "file" ? <Button type="button" variant="link" pending={downloadingTemplate} disabled={busy} onClick={onTemplate}>{t(downloadingTemplate ? "catalogs.actions.downloadingTemplate" : "catalogs.import.template")}</Button> : null}>
    <div className={rows}>
      <Row label={<><Label>{t("catalogs.import.from")}</Label><Help label={t("catalogs.import.sourceHelpLabel")} text={t("catalogs.import.sourceHelp")} /></>}>
        <div className="sm:self-start"><SegmentedControl fullWidth aria-label={t("catalogs.import.from")} disabled={busy} options={(["file", "paste"] as const).map(source => ({ key: source, label: t(source === "file" ? "catalogs.import.upload" : "catalogs.import.paste"), pressed: state.source === source, onSelect: () => changeSource(source) }))} /></div>
      </Row>
      {state.source === "file" ? <Row label={<><Label htmlFor={id + "file"}>{t("catalogs.import.file")}</Label><Help label={t("catalogs.import.fileHelpLabel")} text={t("catalogs.import.fileHint")} /></>}>
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("flex h-[var(--height-control)] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border px-2.5 text-sm", state.fileError ? "border-[var(--color-danger)]" : "border-[var(--color-border)]",
            state.file ? "bg-[var(--color-surface)]" : "bg-[var(--color-surface-muted)] text-[var(--color-content-muted)]", busy && "opacity-50")}>
            <DocumentIcon className="size-3.5 shrink-0 text-[var(--color-content-muted)]" /><span id={id + "name"} className="truncate">{state.file?.name ?? t("catalogs.import.noFile")}</span>
          </span>
          {/* The button is what a keyboard or a screen reader reaches: it says the chosen file and the error. */}
          <Button type="button" variant="outline" disabled={busy} aria-describedby={[id + "name", state.fileError ? errorId : null].filter(Boolean).join(" ")} onClick={() => fileInput.current?.click()}>{t(state.file ? "catalogs.import.changeFile" : "catalogs.import.chooseFile")}</Button>
          {/* The button opens it; emptied after each choice, so choosing the same file again (fixed in Excel) is a change. */}
          <Input ref={fileInput} id={id + "file"} type="file" hidden tabIndex={-1} accept=".xlsx,.csv" disabled={busy} aria-invalid={state.fileError ? true : undefined} aria-describedby={state.fileError ? errorId : undefined}
            onChange={event => { const file = event.target.files?.[0]; if (file) chooseFile(file); event.target.value = ""; }} />
        </div>
        {state.fileError ? <Message id={errorId} error>{state.fileError}</Message> : null}
      </Row> : null}
    </div>
  </Surface>;

  const unknown = state.sheet?.columns.filter(column => !column.id) ?? [];
  const pasted = state.source === "paste" ? <Surface title={t("catalogs.import.pastedTitle")} headingLevel={3} actions={<>
    <Help label={t("catalogs.import.pasteHelpLabel")} text={t("catalogs.import.pasteHelp")} />
    {state.sheet ? <><span className={band}>{t("catalogs.import.rowCount", { count: state.sheet.rows.length })}</span><Button type="button" variant="outline" size="sm" disabled={busy} onClick={clear}>{t("catalogs.import.clear")}</Button></> : null}
  </>}>
    <PasteGrid label={t("catalogs.import.sheetLabel")} rows={state.sheet?.rows ?? null} describedBy={state.fileError ? errorId : undefined} disabled={busy} onPaste={paste}
      columns={(state.sheet?.columns ?? pasteColumns.map(column => ({ id: column.id, label: column.label, source: -1 }))).map(column => ({ key: column.source + ":" + column.id,
        label: column.label ?? t("catalogs.import.extraColumn", { number: column.source + 1 }), cell: column.source >= 0 ? column.source : undefined, invalid: !column.id, numeric: numericColumn(column.id) }))} />
    {state.fileError || unknown.length ? <div className="flex flex-col gap-1 border-t border-[var(--color-border)] px-4 py-2">
      {unknown.map(column => <Message key={column.source} error polite>{t("catalogs.import.unknownColumn", { column: column.label ?? t("catalogs.import.extraColumn", { number: column.source + 1 }) })}</Message>)}
      {state.fileError ? <Message id={errorId} error>{state.fileError}</Message> : null}
    </div> : null}
  </Surface> : null;

  // While reading, the review zone is already there with a skeleton where the tabs and the rows go: the dialog does not jump.
  const reading = state.busy === "preview" ? <Surface title={t("catalogs.import.reviewTitle")} headingLevel={3} actions={state.file ? <span className={band}>{state.file.name}</span> : null}>
    <div role="status" aria-label={t("catalogs.import.reviewing")}>
      <div aria-hidden="true" className="flex h-[var(--height-control)] items-center gap-5 border-b border-[var(--color-border)] px-4">{[0, 1, 2, 3].map(index => <Skeleton key={index} className="h-3 w-20" />)}</div>
      <div aria-hidden="true" className="flex h-[var(--height-table-header)] items-center gap-6 border-b border-[var(--color-surface-header-border)] bg-[var(--color-surface-header)] px-4">{["w-12", "w-28", "w-40", "w-80"].map(width => <Skeleton key={width} className={cn("h-2.5", width)} />)}</div>
      {[0, 1, 2, 3, 4].map(row => <div key={row} aria-hidden="true" className="flex h-[var(--height-table-row)] items-center gap-6 border-b border-[var(--color-border)]/50 px-4 last:border-0">
        {["w-12", "w-28", "w-40", "w-80"].map((width, column) => <Skeleton key={width} className={cn("h-3", width, column && row % 2 ? "max-w-[85%]" : null)} />)}
      </div>)}
    </div>
  </Surface> : null;

  const summary = preview ? [state.file?.name, preview.sheetName, t("catalogs.import.rowsRead", { count: preview.rowsRead }), t("catalogs.import.counts.unchanged", { count: preview.counts.unchanged }),
    preview.counts.reactivated ? t("catalogs.import.counts.reactivated", { count: preview.counts.reactivated }) : null, preview.listsTruncated ? t("catalogs.import.truncatedShort") : null].filter(Boolean).join(" · ") : "";
  const tabCounts = preview ? { issues: preview.issues.length, added: preview.counts.added, changed: preview.counts.changed, deactivated: preview.counts.deactivated } : null;
  const reviewed = preview && tabCounts && !reading ? <div className={cn("flex flex-col gap-4 transition-opacity", applying && "opacity-55")}>
    <Surface title={t("catalogs.import.reviewTitle")} headingLevel={3} actions={<span className={band}>{summary}</span>}>
      {state.conflict || preview.alreadyAppliedAtUtc ? <div className="flex flex-col gap-2 px-4 pt-3">
        {state.conflict ? <Banner tone="warning">{t("catalogs.import.conflict")}</Banner> : null}
        {preview.alreadyAppliedAtUtc ? <Banner>{t("catalogs.import.alreadyApplied", { date: formatDateTimeInZone(preview.alreadyAppliedAtUtc, i18n.language, timeZoneId) })}</Banner> : null}
      </div> : null}
      <Tabs defaultValue={preview.issues.length ? "issues" : "added"} className="gap-0">
        <TabsList className="px-4">{(["issues", "added", "changed", "deactivated"] as const).map(key => <TabsTrigger key={key} value={key}>
          {t("catalogs.import.tabs." + key)} <span className={cn("text-xs font-semibold", key === "issues" && preview.counts.errorRows ? "text-[var(--color-danger)]" : "text-[var(--color-content-muted)]")}>{tabCounts[key]}</span>
        </TabsTrigger>)}</TabsList>
        <TabsContent value="issues"><Table><TableHeader><TableRow><TableHead numeric>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.severity")}</TableHead><TableHead>{t("catalogs.import.column")}</TableHead><TableHead>{t("catalogs.import.what")}</TableHead></TableRow></TableHeader><TableBody>{preview.issues.map((issue, index) => <TableRow key={index}><TableCell numeric>{issue.row}</TableCell><TableCell><Badge variant={issue.severity === "Error" ? "danger" : "warning"}>{t("catalogs.import." + (issue.severity === "Error" ? "error" : "warning"))}</Badge></TableCell><TableCell>{issue.code === "Forms.CatalogImport.UnknownColumn" ? issue.column : columnLabel(issue.column)}</TableCell><TableCell className="whitespace-normal">{issue.message}{issue.relatedRow !== null ? <span className="block text-xs text-[var(--color-content-muted)]">{t("catalogs.import.relatedRow", { row: issue.relatedRow })}</span> : null}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
        <TabsContent value="added"><Table scrollLabel={t("catalogs.import.tabs.added")}><TableHeader><TableRow><TableHead numeric>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.columns.code")}</TableHead>{fields.map(field => <TableHead key={field.id} numeric={numericColumn(field.id)}>{columnLabel(field.id)}</TableHead>)}<TableHead>{t("catalogs.import.columns.text")}</TableHead>{catalog.valueType !== "Text" ? <TableHead numeric={numericColumn("value")}>{t("catalogs.import.columns.value")}</TableHead> : null}</TableRow></TableHeader><TableBody>{preview.added.map(item => <TableRow key={item.row}><TableCell numeric>{item.row}</TableCell><TableCell>{item.code}</TableCell>{fields.map(field => <TableCell key={field.id} numeric={numericColumn(field.id)}>{displayColumn(field.id, item.fields?.[field.id], item.fieldTexts?.[field.id])}</TableCell>)}<TableCell>{item.text}</TableCell>{catalog.valueType !== "Text" ? <TableCell numeric={numericColumn("value")}>{displayColumn("value", item.value)}</TableCell> : null}</TableRow>)}</TableBody></Table></TabsContent>
        <TabsContent value="changed"><Table><TableHeader><TableRow><TableHead numeric>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.columns.code")}</TableHead><TableHead>{t("catalogs.import.tabs.changed")}</TableHead></TableRow></TableHeader><TableBody>{preview.changed.map(item => <TableRow key={item.itemId}><TableCell numeric>{item.row}</TableCell><TableCell>{item.code}</TableCell><TableCell className="whitespace-normal">{item.changes.map((change, index) => <p key={index}>{columnLabel(change.column)}: <CellText text={displayColumn(change.column, change.before, change.beforeText)} /> → <CellText text={displayColumn(change.column, change.after, change.afterText)} /></p>)}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
        <TabsContent value="deactivated"><Table><TableHeader><TableRow><TableHead>{t("catalogs.import.columns.code")}</TableHead><TableHead>{t("catalogs.import.columns.text")}</TableHead></TableRow></TableHeader><TableBody>{preview.deactivated.map(item => <TableRow key={item.itemId}><TableCell>{item.code}</TableCell><TableCell>{item.text}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
      </Tabs>
    </Surface>
    {preview.confirmations.deactivations > 0 || preview.confirmations.emptySheet || preview.confirmations.manyErrors ? <Surface title={t("catalogs.import.beforeApply")} headingLevel={3}>
      <div className={rows}>
        {preview.confirmations.deactivations > 0 ? confirmation("confirmDeactivations", t("catalogs.import.confirmDeactivations", { count: preview.confirmations.deactivations }), <Help label={t("catalogs.import.deactivationsHelpLabel")} text={t("catalogs.import.replaceHint")} />) : null}
        {preview.confirmations.emptySheet ? confirmation("confirmEmpty", t("catalogs.import.confirmEmpty")) : null}
        {preview.confirmations.manyErrors ? confirmation("confirmErrors", t("catalogs.import.confirmErrors")) : null}
      </div>
    </Surface> : null}
  </div> : null;

  const primary = !owned || state.forbidden ? null
    : busy ? <Button type="button" pending>{t(applying ? "catalogs.import.applying" : "catalogs.import.reviewing")}</Button>
    : state.conflict ? <Button type="button" onClick={() => void review(true)}>{t("catalogs.import.reviewAgain")}</Button>
    : !preview ? <Button type="button" onClick={() => void review()}>{t("catalogs.import.review")}</Button>
    : <Button type="button" disabled={!confirmed} onClick={() => void apply()}>{t(preview.counts.errorRows ? "catalogs.import.applyWithoutErrors" : "catalogs.import.apply", { count: preview.counts.errorRows })}</Button>;
  return <Dialog open onOpenChange={open => { if (!open && !applying) close(); }}><DialogContent mobileFullscreen aria-describedby={undefined} className="flex flex-col sm:max-w-6xl" closeDisabledReason={applying ? t("catalogs.import.waitApply") : undefined} onCloseAutoFocus={restoreFocus}>
    <DialogHeader><DialogTitle className="pr-6">{t("catalogs.import.title", { name: administrativeName(catalog.name, scope.culture) })}</DialogTitle></DialogHeader>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      {!owned || state.forbidden ? <p>{t("catalogs.import.forbidden")}</p> : <>{origin}{pasted}{reading}{reviewed}</>}
    </div>
    <DialogFooter className="shrink-0 sm:items-center">
      <DisabledReason reason={applying ? t("catalogs.import.waitApply") : null} className="max-sm:*:flex-1"><Button type="button" variant="outline" disabled={applying} onClick={close}>{t("common:actions.cancel")}</Button></DisabledReason>
      {primary}
    </DialogFooter>
  </DialogContent></Dialog>;
}
