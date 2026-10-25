import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { FormField } from "@/shared/ui/FormField";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Spinner } from "@/shared/ui/Spinner";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { EmptyState } from "@/shared/ui/EmptyState";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
import { fetchPdfDesign, savePdfDesign, previewPdfDesign, type FormPdfDesign } from "../api/pdf";
import { fetchRuleOptions } from "../api/rules";
import { contentReference, contentRequired, localizedValue } from "../editorModel";
import { preparePdfDesign, type PdfDesign } from "../pdfDesign";
import type { LocalizedText } from "../model";
import { localizedIssue, localizedIssueMessage } from "../validationPaths";
import { FormPdfPreview } from "../components/FormPdfPreview";
type PdfEditorProps = {
    definitionId: string;
    scope: FormReadScope;
    onDenied: () => void;
};
export function FormPdfDesignPage() {
    const { formId = "" } = useParams();
    const { data: user } = useCurrentUser();
    const { i18n } = useTranslation();
    const scope: FormReadScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
    const owner = JSON.stringify([...formScopeKey(scope), formId]);
    if (!scope.actorId || !scope.permissions.includes("formrules.manage"))
        return <ForbiddenPage />;
    return <PdfDesignAccess key={owner} definitionId={formId} scope={scope}/>;
}
function PdfDesignAccess(props: Omit<PdfEditorProps, "onDenied">) { const [denied, setDenied] = useState(false); const onDenied = useCallback(() => setDenied(true), []); return denied ? <ForbiddenPage /> : <PdfDesignEditor {...props} onDenied={onDenied}/>; }
function PdfDesignEditor({ definitionId, scope, onDenied }: PdfEditorProps) {
    const { t } = useTranslation("forms");
    const navigate = useNavigate();
    const root = [...formScopeKey(scope), "pdf-design", definitionId];
    const notificationRoot = "forms:pdf-design:" + JSON.stringify(root);
    const pendingNotices = useRef(new Set<string>());
    useEffect(() => () => { for (const operation of pendingNotices.current) dismissNotification(notificationRoot + ":" + operation); }, [notificationRoot]);
    usePrivateQueryCleanup(root);
    const query = useQuery({ queryKey: root, queryFn: async ({ signal }) => { const [current, options] = await Promise.all([fetchPdfDesign(definitionId, signal), fetchRuleOptions(definitionId, signal)]); return { current, options }; }, gcTime: 0 });
    const [baseline, setBaseline] = useState<FormPdfDesign | null>(null);
    const [draft, setDraft] = useState<PdfDesign | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [busy, setBusy] = useState(false);
    const [validation, setValidation] = useState(false);
    const [review, setReview] = useState(false);
    const [current, setCurrent] = useState<FormPdfDesign | null>(null);
    const [discard, setDiscard] = useState(false);
    // No language selector: the texts are edited, and the preview asked for, in the menu language. Changing it remounts the editor.
    const culture = scope.culture;
    const [preview, setPreview] = useState<PdfDesign | null>(null);
    const active = useRef(true);
    const request = useRef<AbortController | null>(null);
    const host = useRef<HTMLDivElement>(null);
    const cooldown = useCountdown(0);
    useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
    useEffect(() => { if (query.error instanceof ApiError && query.error.status === 403)
        onDenied(); }, [query.error, onDenied]);
    if (query.data && !baseline) {
        setBaseline(query.data.current);
        setDraft(query.data.current.design);
    }
    const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline.design);
    const guard = useUnsavedChangesGuard(dirty || busy, { remountsOnLanguageChange: true });
    const back = scope.permissions.includes("formtemplates.read") ? "/formularios/" + definitionId : "/";
    useBreadcrumbLeaf(t("pdf.title"), query.data ? localizedValue(query.data.options.name, scope.culture, query.data.options.originalCulture) : undefined);
    const loadPreview = useCallback((signal: AbortSignal) => previewPdfDesign(definitionId, preview!, culture, signal), [definitionId, preview, culture]);
    const change = (next: PdfDesign) => { setDraft(next); setPreview(null); setError(null); };
    // Trying to save or preview an invalid design marks its errors and focuses the first one; nothing is sent.
    const markInvalid = () => { setValidation(true); requestAnimationFrame(() => host.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus()); };
    const save = async () => { if (!draft || !baseline || busy || review || cooldown.isRunning)
        return; const prepared = preparePdfDesign(draft, baseline.originalCulture); if (!prepared.design) {
        markInvalid();
        return;
    } setValidation(true); const controller = new AbortController(); request.current = controller; setBusy(true); setError(null); dismissNotification(notificationRoot + ":save"); pendingNotices.current.delete("save"); try {
        const result = await savePdfDesign(definitionId, baseline.revision, prepared.design, controller.signal);
        if (!active.current || controller.signal.aborted)
            return;
        setBaseline(result);
        setDraft(result.design);
        setValidation(false);
        notify({ id: notificationRoot + ":save", kind: "success", message: t("pdf.saved") });
    }
    catch (failure) {
        if (!active.current || controller.signal.aborted || errorFeedback(failure).kind === "cancelled")
            return;
        if (failure instanceof ApiError && failure.status === 403) {
            onDenied();
            return;
        }
        if (failure instanceof ApiError && failure.status === 409)
            setReview(true);
        if (failure instanceof ApiError && failure.status === 429)
            cooldown.restart(failure.retryAfterSeconds ?? 60);
        setError(failure);
        const fields = ["name.es", "name.en", "footer.es", "footer.en"].map(path => "design." + path);
        if (!["cancelled", "session", "forbidden", "fields"].includes(errorFeedback(failure, { fields }).kind)) { pendingNotices.current.add("save"); notify({ id: notificationRoot + ":save", kind: "error", message: operationalErrorMessage(failure, t, "save") }); }
    }
    finally {
        if (active.current)
            setBusy(false);
    } };
    const reread = async () => { if (busy)
        return; const controller = new AbortController(); request.current = controller; setBusy(true); dismissNotification(notificationRoot + ":reread"); pendingNotices.current.delete("reread"); try {
        const value = await fetchPdfDesign(definitionId, controller.signal);
        if (active.current && !controller.signal.aborted)
            setCurrent(value);
    }
    catch (failure) {
        if (active.current && !controller.signal.aborted) {
            if (failure instanceof ApiError && failure.status === 403)
                onDenied();
            else if (!["cancelled", "session"].includes(errorFeedback(failure).kind)) {
                pendingNotices.current.add("reread"); notify({ id: notificationRoot + ":reread", kind: "error", message: readErrorMessage(failure, t) });
                if (failure instanceof ApiError && failure.status === 429) cooldown.restart(failure.retryAfterSeconds ?? 60);
            }
        }
    }
    finally {
        if (active.current)
            setBusy(false);
    } };
    if (query.isPending || !baseline || !draft)
        return <Page title={t("pdf.title")}>{query.error ? <EmptyState title={t("common:states.loadFailed")} action={<Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button>}/> : <Spinner />}</Page>;
    const original = baseline.originalCulture;
    const options = query.data!.options;
    const prepared = preparePdfDesign(draft, original);
    const fieldError = (path: string) => validation && prepared.errors[path] ? t("pdf.errors." + prepared.errors[path]) : error instanceof ApiError ? error.errors?.["design." + path]?.[0] : undefined;
    // An error of the language not on screen (the original's, for instance) is shown under the same field, with its language.
    const textError = (path: "name" | "footer") => localizedIssueMessage(localizedIssue(Object.fromEntries((["es", "en"] as const).flatMap(language => { const message = fieldError(path + "." + language); return message ? [[path + "." + language, [message]]] : []; })), path, culture), culture, t);
    const reference = (text: LocalizedText | null) => { const value = contentReference(text, culture, original); return value ? t("originalText", { language: t("cultures." + original), text: value }) : undefined; };
    const selectedUnknown = [...new Set([...baseline.design.questionIds, ...draft.questionIds])].filter(id => !options.questions.some(question => question.fieldId === id));
    const blocked = busy || review;
    // Without changes or while saving, a disabled Save is obvious; a wait or a conflict is told as its reason, with no text beside it.
    const saveDisabledReason = busy ? null : cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : review ? t("pdf.saveConflict") : null;
    // Next to the title only what is designed: an enabled Save already says there are changes, and revisions are not shown here.
    return <Page title={localizedValue(draft.name, culture, original) || t("pdf.title")} status={t("pdf.status", { name: localizedValue(options.name, scope.culture, original) })} backTo={{ to: back, label: t("pdf.back") }} actions={<Button variant="outline" disabled={busy} onClick={() => { if (dirty)
        setDiscard(true);
    else
        void navigate(back); }}>{t("discard")}</Button>}>
  {review ? <Surface title={t("pdf.conflict")} padded actions={<><Button variant="outline" disabled={busy} onClick={() => void reread()}>{t("pdf.reread")}</Button>{current ? <Button disabled={busy} onClick={() => { setBaseline(current); setDraft(current.design); setReview(false); setCurrent(null); setError(null); setValidation(false); setPreview(null); pendingNotices.current.delete("save"); dismissNotification(notificationRoot + ":save"); }}>{t("pdf.useCurrent")}</Button> : null}</>}><p>{t("pdf.conflictHint")}</p></Surface> : null}
  <div ref={host} className="grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
   <Surface title={t("pdf.receipt")} padded actions={<DisabledReason reason={saveDisabledReason}><Button disabled={blocked || cooldown.isRunning || !dirty && baseline.revision > 0} onClick={() => void save()}>{t("pdf.save")}</Button></DisabledReason>}>
    <div className="space-y-5"><FormField label={t("pdf.name")} required={contentRequired(draft.name, culture, original)} hint={reference(draft.name)} error={textError("name")}><Input maxLength={160} placeholder={culture !== original ? t("missingText") : undefined} value={draft.name[culture] ?? ""} disabled={blocked} onChange={event => change({ ...draft, name: { ...draft.name, [culture]: event.target.value } })}/></FormField>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{t("pdf.questions")}</legend>{[...options.questions.map(question => ({ id: question.fieldId, label: localizedValue(question.label, scope.culture, original) })), ...selectedUnknown.map(id => ({ id, label: t("pdf.retiredQuestion") }))].map(question => <CheckboxField key={question.id} label={question.label} checked={draft.questionIds.includes(question.id)} disabled={blocked} onCheckedChange={checked => change({ ...draft, questionIds: checked ? [...draft.questionIds, question.id] : draft.questionIds.filter(id => id !== question.id) })}/>)}</fieldset>
    <CheckboxField label={t("pdf.includePhotos")} description={t("pdf.photosHint")} checked={draft.includePhotos} disabled={blocked} onCheckedChange={checked => change({ ...draft, includePhotos: checked })}/>
    <CheckboxField label={t("pdf.includeApproval")} description={t("pdf.approvalHint")} checked={draft.includeApproval} disabled={blocked} onCheckedChange={checked => change({ ...draft, includeApproval: checked })}/>
    <FormField label={t("pdf.footer")} hint={reference(draft.footer) ?? t("pdf.footerHint")} error={textError("footer")}><Textarea maxLength={1000} rows={3} disabled={blocked} placeholder={culture !== original && draft.footer?.[original]?.trim() ? t("missingText") : undefined} value={draft.footer?.[culture] ?? ""} onChange={event => change({ ...draft, footer: { ...draft.footer, [culture]: event.target.value } })}/></FormField>
    <p className="text-xs text-[var(--color-content-muted)]">{t("pdf.fixedHint")}</p>
   </div></Surface>
   <Surface title={t("pdf.preview")} padded actions={<Button variant="outline" disabled={blocked} onClick={() => { if (prepared.design)
        setPreview(prepared.design);
    else
        markInvalid(); }}>{t("pdf.preview")}</Button>}>{preview ? <FormPdfPreview operationId={notificationRoot + ":preview"} load={loadPreview} onForbidden={onDenied} requestedCulture={culture} example/> : <p className="text-sm text-[var(--color-content-muted)]">{t("pdf.previewHint")}</p>}</Surface>
  </div>
  <ConfirmDialog open={discard || guard.isBlocked} onOpenChange={open => { if (!open) {
        setDiscard(false);
        guard.stay();
    } }} title={t("discardTitle")} description={t("discardDescription")} confirmLabel={t("discard")} cancelLabel={t("stay")} destructive onConfirm={() => { if (guard.isBlocked)
        guard.leave();
    else {
        guard.allowNextNavigation();
        void navigate(back);
    } }}/>
 </Page>;
}
