import { useEffect, useId, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Banner } from "@/shared/ui/Banner";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/Tabs";
import { Textarea } from "@/shared/ui/textarea";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { fetchCatalog } from "../api/catalogs";
import { applyCatalogImport, previewCatalogImport, type CatalogImportPreview } from "../api/catalogImports";
import type { CatalogDetail } from "../api/catalogResponse";
import { parseCatalogPaste } from "../catalogPaste";
import { catalogScalarText, catalogTypedValueTypes } from "../catalogValues";
import { administrativeName } from "../editorModel";
import type { CatalogReadScope } from "../hooks/useCatalogDraftEditor";

export interface CatalogImportDialogProps { scope: CatalogReadScope; catalog: CatalogDetail; initialSource: "file" | "paste"; timeZoneId?: string; focusFallback?: RefObject<HTMLElement | null>; onClose: () => void; onApplied: (catalog: CatalogDetail) => void; onObserved: (catalog: CatalogDetail) => void; onTemplate: () => void }
function fresh(owner: string, revision: number, source: "file" | "paste") {
  return { owner, revision, source, paste: "", file: null as File | null, preview: null as CatalogImportPreview | null, busy: null as "preview" | "apply" | null, conflict: false, forbidden: false, fileError: null as string | null, confirmDeactivations: false, confirmEmpty: false, confirmErrors: false };
}
export function CatalogImportDialog({ scope, catalog, initialSource, timeZoneId, focusFallback, onClose, onApplied, onObserved, onTemplate }: CatalogImportDialogProps) {
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
  const allowed = !!scope.actorId && scope.permissions.includes("formcatalogs.read") && scope.permissions.includes("formcatalogs.manage");
  const [state, setState] = useState(() => fresh(owner, catalog.revision, initialSource));
  if (state.owner !== owner) setState(fresh(owner, catalog.revision, initialSource));
  const active = useRef(true), currentOwner = useRef(owner), operation = useRef<AbortController | null>(null);
  const feedbackId = "catalogs:import:" + useId();
  useLayoutEffect(() => { currentOwner.current = owner; }, [owner]);
  useEffect(() => { active.current = true; return () => { active.current = false; operation.current?.abort(); operation.current = null; dismissNotification(feedbackId); }; }, [owner, feedbackId]);
  const restoreFocus = useRestoreFocusOnClose(true, focusFallback);
  const owned = state.owner === owner && allowed;
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
  const review = async (refresh = false) => {
    if (!owned || state.forbidden || operation.current) return;
    let file = state.file;
    if (state.source === "paste" && !file) {
      const pasted = parseCatalogPaste(state.paste);
      if (!pasted.valid) { setState(value => ({ ...value, fileError: t("catalogs.import.pasteError." + pasted.reason) })); return; }
      file = new File([pasted.csv], t("catalogs.import.pastedFileName"), { type: "text/csv" });
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
  const close = () => { if (state.busy === "apply") return; operation.current?.abort(); operation.current = null; setState(fresh(owner, state.revision, state.source)); onClose(); };
  const changeSource = (source: string) => { if (!state.busy && (source === "file" || source === "paste")) setState(fresh(owner, state.revision, source)); };
  return <Dialog open onOpenChange={open => { if (!open && state.busy !== "apply") close(); }}><DialogContent mobileFullscreen className="flex flex-col sm:max-w-3xl" showCloseButton={state.busy !== "apply"} onCloseAutoFocus={restoreFocus}>
    <DialogHeader><DialogTitle className="pr-6">{t("catalogs.import.title", { name: administrativeName(catalog.name, scope.culture) })}</DialogTitle><DialogDescription>{t("catalogs.import.description")}</DialogDescription></DialogHeader>
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
      <ol className="flex flex-wrap gap-4 text-sm">{["fileStep", "reviewStep", "applyStep"].map((step, index) => <li key={step} aria-current={index === (preview ? 1 : 0) ? "step" : undefined}>{index + 1} · {t("catalogs.import." + (state.source === "paste" && step === "fileStep" ? "pasteStep" : step))}</li>)}</ol>
      {!owned || state.forbidden ? <p>{t("catalogs.import.forbidden")}</p> : !preview ? <Tabs value={state.source} onValueChange={changeSource}>
        <TabsList><TabsTrigger value="file" disabled={!!state.busy}>{t("catalogs.import.upload")}</TabsTrigger><TabsTrigger value="paste" disabled={!!state.busy}>{t("catalogs.import.paste")}</TabsTrigger></TabsList>
        <TabsContent value="file"><div className="space-y-3"><Button type="button" variant="link" onClick={onTemplate}>{t("catalogs.import.template")}</Button><FormField label={t("catalogs.import.file")} hint={t("catalogs.import.fileHint")} error={state.fileError ?? undefined}><Input type="file" accept=".xlsx,.csv" disabled={!!state.busy} onChange={event => setState(value => ({ ...value, file: event.target.files?.[0] ?? null, fileError: null }))}/></FormField></div></TabsContent>
        <TabsContent value="paste"><FormField label={t("catalogs.import.pastedRows")} hint={t("catalogs.import.pasteHint")} error={state.fileError ?? undefined}><Textarea disabled={!!state.busy} value={state.paste} onChange={event => setState(value => ({ ...value, paste: event.target.value, file: null, fileError: null }))}/></FormField></TabsContent>
      </Tabs> : <>
        <p className="text-sm">{state.file?.name} · {t("catalogs.import.rowsRead", { count: preview.rowsRead })} · {preview.sheetName}</p>
        <div className="flex flex-wrap gap-2">{(["added", "changed", "deactivated", "reactivated", "unchanged", "errorRows", "warnings"] as const).map(key => <Badge key={key} variant="outline">{t("catalogs.import.counts." + key, { count: preview.counts[key] })}</Badge>)}</div>
        {state.conflict ? <Banner tone="warning">{t("catalogs.import.conflict")}</Banner> : null}
        {preview.alreadyAppliedAtUtc ? <Banner>{t("catalogs.import.alreadyApplied", { date: formatDateTimeInZone(preview.alreadyAppliedAtUtc, i18n.language, timeZoneId) })}</Banner> : null}
        <Tabs defaultValue={preview.issues.length ? "issues" : "added"}><TabsList>{["issues", "added", "changed", "deactivated"].map(key => <TabsTrigger key={key} value={key}>{t("catalogs.import.tabs." + key)}</TabsTrigger>)}</TabsList>
          <TabsContent value="issues"><Table><TableHeader><TableRow><TableHead>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.severity")}</TableHead><TableHead>{t("catalogs.import.column")}</TableHead><TableHead>{t("catalogs.import.what")}</TableHead></TableRow></TableHeader><TableBody>{preview.issues.map((issue, index) => <TableRow key={index}><TableCell>{issue.row}</TableCell><TableCell><Badge variant={issue.severity === "Error" ? "danger" : "warning"}>{t("catalogs.import." + (issue.severity === "Error" ? "error" : "warning"))}</Badge></TableCell><TableCell>{issue.code === "Forms.CatalogImport.UnknownColumn" ? issue.column : columnLabel(issue.column)}</TableCell><TableCell className="whitespace-normal">{issue.message}{issue.relatedRow !== null ? <span className="block text-xs text-[var(--color-content-muted)]">{t("catalogs.import.relatedRow", { row: issue.relatedRow })}</span> : null}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
          <TabsContent value="added"><Table scrollLabel={t("catalogs.import.tabs.added")}><TableHeader><TableRow><TableHead>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.columns.code")}</TableHead>{fields.map(field => <TableHead key={field.id}>{columnLabel(field.id)}</TableHead>)}<TableHead>{t("catalogs.import.columns.text")}</TableHead>{catalog.valueType !== "Text" ? <TableHead>{t("catalogs.import.columns.value")}</TableHead> : null}</TableRow></TableHeader><TableBody>{preview.added.map(item => <TableRow key={item.row}><TableCell>{item.row}</TableCell><TableCell>{item.code}</TableCell>{fields.map(field => <TableCell key={field.id}>{displayColumn(field.id, item.fields?.[field.id], item.fieldTexts?.[field.id])}</TableCell>)}<TableCell>{item.text}</TableCell>{catalog.valueType !== "Text" ? <TableCell>{displayColumn("value", item.value)}</TableCell> : null}</TableRow>)}</TableBody></Table></TabsContent>
          <TabsContent value="changed"><Table><TableHeader><TableRow><TableHead>{t("catalogs.import.row")}</TableHead><TableHead>{t("catalogs.import.columns.code")}</TableHead><TableHead>{t("catalogs.import.tabs.changed")}</TableHead></TableRow></TableHeader><TableBody>{preview.changed.map(item => <TableRow key={item.itemId}><TableCell>{item.row}</TableCell><TableCell>{item.code}</TableCell><TableCell className="whitespace-normal">{item.changes.map((change, index) => <p key={index}>{columnLabel(change.column)}: {displayColumn(change.column, change.before, change.beforeText)} → {displayColumn(change.column, change.after, change.afterText)}</p>)}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
          <TabsContent value="deactivated"><Table><TableHeader><TableRow><TableHead>{t("catalogs.import.columns.code")}</TableHead><TableHead>{t("catalogs.import.columns.text")}</TableHead></TableRow></TableHeader><TableBody>{preview.deactivated.map(item => <TableRow key={item.itemId}><TableCell>{item.code}</TableCell><TableCell>{item.text}</TableCell></TableRow>)}</TableBody></Table></TabsContent>
        </Tabs>
        {preview.listsTruncated ? <p className="text-sm">{t("catalogs.import.truncated")}</p> : null}
        {preview.counts.errorRows ? <Banner tone="warning">{t("catalogs.import.skipped", { count: preview.counts.errorRows })}</Banner> : null}
        <p className="text-sm">{t(preview.mode === "Replace" ? "catalogs.import.replaceHint" : "catalogs.import.appendHint")}</p>
        {preview.confirmations.deactivations > 0 ? <CheckboxField disabled={!!state.busy} label={t("catalogs.import.confirmDeactivations", { count: preview.confirmations.deactivations })} checked={state.confirmDeactivations} onCheckedChange={confirmDeactivations => setState(value => ({ ...value, confirmDeactivations }))}/> : null}
        {preview.confirmations.emptySheet ? <CheckboxField disabled={!!state.busy} label={t("catalogs.import.confirmEmpty")} checked={state.confirmEmpty} onCheckedChange={confirmEmpty => setState(value => ({ ...value, confirmEmpty }))}/> : null}
        {preview.confirmations.manyErrors ? <CheckboxField disabled={!!state.busy} label={t("catalogs.import.confirmErrors")} checked={state.confirmErrors} onCheckedChange={confirmErrors => setState(value => ({ ...value, confirmErrors }))}/> : null}
      </>}
    </div>
    <DialogFooter className="shrink-0"><Button type="button" variant="outline" disabled={state.busy === "apply"} onClick={close}>{t("common:actions.cancel")}</Button>{owned && !state.forbidden ? state.conflict ? <Button disabled={!!state.busy} onClick={() => void review(true)}>{t("catalogs.import.reviewAgain")}</Button> : !preview ? <Button disabled={!!state.busy} onClick={() => void review()}>{t("catalogs.import.review")}</Button> : <Button disabled={!!state.busy || !confirmed} onClick={() => void apply()}>{t(preview.counts.errorRows ? "catalogs.import.applyWithoutErrors" : "catalogs.import.apply", { count: preview.counts.errorRows })}</Button> : null}</DialogFooter>
  </DialogContent></Dialog>;
}
