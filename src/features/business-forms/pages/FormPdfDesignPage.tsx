import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, readErrorMessage } from "@/shared/api/errorFeedback";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Button } from "@/shared/ui/button";
import { FormField } from "@/shared/ui/FormField";
import { CheckboxField } from "@/shared/ui/CheckboxField";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Spinner } from "@/shared/ui/Spinner";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { notify } from "@/shared/ui/notifications";
import { formScopeKey, usePrivateQueryCleanup, type FormReadScope } from "../hooks/useFormQueries";
import { fetchPdfDesign, savePdfDesign, previewPdfDesign, type FormPdfDesign } from "../api/pdf";
import { fetchRuleOptions } from "../api/rules";
import { localizedValue } from "../editorModel";
import { preparePdfDesign, type PdfDesign } from "../pdfDesign";
import type { FormCulture } from "../model";
import { FormPdfPreview } from "../components/FormPdfPreview";
type PdfEditorProps = {
    definitionId: string;
    scope: FormReadScope;
    timeZoneId?: string;
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
    return <PdfDesignAccess key={owner} definitionId={formId} scope={scope} timeZoneId={user?.timeZoneId}/>;
}
function PdfDesignAccess(props: Omit<PdfEditorProps, "onDenied">) { const [denied, setDenied] = useState(false); const onDenied = useCallback(() => setDenied(true), []); return denied ? <ForbiddenPage /> : <PdfDesignEditor {...props} onDenied={onDenied}/>; }
function PdfDesignEditor({ definitionId, scope, timeZoneId, onDenied }: PdfEditorProps) {
    const { t, i18n } = useTranslation("forms");
    const navigate = useNavigate();
    const root = [...formScopeKey(scope), "pdf-design", definitionId];
    usePrivateQueryCleanup(root);
    const query = useQuery({ queryKey: root, queryFn: async ({ signal }) => { const [current, options] = await Promise.all([fetchPdfDesign(definitionId, signal), fetchRuleOptions(definitionId, signal)]); return { current, options }; }, gcTime: 0, meta: { errorOwner: "local" } });
    const [baseline, setBaseline] = useState<FormPdfDesign | null>(null);
    const [draft, setDraft] = useState<PdfDesign | null>(null);
    const [error, setError] = useState<unknown>(null);
    const [busy, setBusy] = useState(false);
    const [validation, setValidation] = useState(false);
    const [review, setReview] = useState(false);
    const [current, setCurrent] = useState<FormPdfDesign | null>(null);
    const [discard, setDiscard] = useState(false);
    const [culture, setCulture] = useState<FormCulture>(scope.culture);
    const [preview, setPreview] = useState<{
        design: PdfDesign;
        culture: FormCulture;
    } | null>(null);
    const active = useRef(true);
    const request = useRef<AbortController | null>(null);
    const cooldown = useCountdown(0);
    useEffect(() => { active.current = true; return () => { active.current = false; request.current?.abort(); }; }, []);
    useEffect(() => { if (query.error instanceof ApiError && query.error.status === 403)
        onDenied(); }, [query.error, onDenied]);
    if (query.data && !baseline) {
        setBaseline(query.data.current);
        setDraft(query.data.current.design);
    }
    const dirty = !!draft && !!baseline && JSON.stringify(draft) !== JSON.stringify(baseline.design);
    const guard = useUnsavedChangesGuard(dirty || busy);
    const back = scope.permissions.includes("formtemplates.read") ? "/formularios/" + definitionId : "/";
    useBreadcrumbLeaf(t("pdf.title"), query.data ? localizedValue(query.data.options.name, scope.culture, query.data.options.originalCulture) : undefined);
    const loadPreview = useCallback((signal: AbortSignal) => previewPdfDesign(definitionId, preview!.design, preview!.culture, signal), [definitionId, preview]);
    const change = (next: PdfDesign) => { setDraft(next); setPreview(null); setError(null); };
    const save = async () => { if (!draft || !baseline || busy || review || cooldown.isRunning)
        return; const prepared = preparePdfDesign(draft, baseline.originalCulture); setValidation(true); if (!prepared.design)
        return; const controller = new AbortController(); request.current = controller; setBusy(true); setError(null); try {
        const result = await savePdfDesign(definitionId, baseline.revision, prepared.design, controller.signal);
        if (!active.current || controller.signal.aborted)
            return;
        setBaseline(result);
        setDraft(result.design);
        setValidation(false);
        notify({ id: "forms:pdf-design:" + definitionId, kind: "success", message: t("pdf.saved") });
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
    }
    finally {
        if (active.current)
            setBusy(false);
    } };
    const reread = async () => { if (busy)
        return; const controller = new AbortController(); request.current = controller; setBusy(true); try {
        const value = await fetchPdfDesign(definitionId, controller.signal);
        if (active.current && !controller.signal.aborted)
            setCurrent(value);
    }
    catch (failure) {
        if (active.current && !controller.signal.aborted) {
            if (failure instanceof ApiError && failure.status === 403)
                onDenied();
            else
                setError(failure);
        }
    }
    finally {
        if (active.current)
            setBusy(false);
    } };
    if (query.isPending || !baseline || !draft)
        return <Page title={t("pdf.title")}>{query.error ? <div role="status"><p>{readErrorMessage(query.error, t)}</p><Button variant="outline" onClick={() => void query.refetch()}>{t("common:actions.retry")}</Button></div> : <Spinner />}</Page>;
    const original = baseline.originalCulture;
    const other: FormCulture = original === "es" ? "en" : "es";
    const options = query.data!.options;
    const prepared = preparePdfDesign(draft, original);
    const fieldError = (path: string) => validation && prepared.errors[path] ? t("pdf.errors." + prepared.errors[path]) : error instanceof ApiError ? error.errors?.["design." + path]?.[0] : undefined;
    const selectedUnknown = [...new Set([...baseline.design.questionIds, ...draft.questionIds])].filter(id => !options.questions.some(question => question.fieldId === id));
    const blocked = busy || review;
    return <Page title={draft.name[original] || t("pdf.title")} status={t("pdf.status", { name: localizedValue(options.name, scope.culture, original) }) + (dirty ? " · " + t("dirty") : "")} backTo={{ to: back, label: t("pdf.back") }} actions={<Button variant="outline" disabled={busy} onClick={() => { if (dirty)
        setDiscard(true);
    else
        void navigate(back); }}>{t("discard")}</Button>}>
  {review ? <Surface title={t("pdf.conflict")} padded><p>{t("pdf.conflictHint")}</p><div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void reread()}>{t("pdf.reread")}</Button>{current ? <Button disabled={busy} onClick={() => { setBaseline(current); setDraft(current.design); setReview(false); setCurrent(null); setError(null); setValidation(false); setPreview(null); }}>{t("pdf.useCurrent")}</Button> : null}</div></Surface> : null}
  <div className="grid items-start gap-4 xl:grid-cols-[3fr_2fr]">
   <Surface title={t("pdf.receipt")} padded actions={<Button disabled={blocked || cooldown.isRunning || !dirty && baseline.revision > 0} onClick={() => void save()}>{t("pdf.save")}</Button>}>
    <div className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><FormField label={t("pdf.name")} required error={fieldError("name." + original)}><Input maxLength={160} value={draft.name[original] ?? ""} disabled={blocked} onChange={event => change({ ...draft, name: { ...draft.name, [original]: event.target.value } })}/></FormField><FormField label={t("pdf.translation", { language: t("cultures." + other) })} hint={t("pdf.optionalTranslation")} error={fieldError("name." + other)}><Input maxLength={160} value={draft.name[other] ?? ""} disabled={blocked} onChange={event => change({ ...draft, name: { ...draft.name, [other]: event.target.value } })}/></FormField></div>
    <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">{t("pdf.questions")}</legend>{[...options.questions.map(question => ({ id: question.fieldId, label: localizedValue(question.label, scope.culture, original) })), ...selectedUnknown.map(id => ({ id, label: t("pdf.retiredQuestion") }))].map(question => <CheckboxField key={question.id} label={question.label} checked={draft.questionIds.includes(question.id)} disabled={blocked} onCheckedChange={checked => change({ ...draft, questionIds: checked ? [...draft.questionIds, question.id] : draft.questionIds.filter(id => id !== question.id) })}/>)}</fieldset>
    <CheckboxField label={t("pdf.includePhotos")} description={t("pdf.photosHint")} checked={draft.includePhotos} disabled={blocked} onCheckedChange={checked => change({ ...draft, includePhotos: checked })}/>
    <CheckboxField label={t("pdf.includeApproval")} description={t("pdf.approvalHint")} checked={draft.includeApproval} disabled={blocked} onCheckedChange={checked => change({ ...draft, includeApproval: checked })}/>
    <div className="grid gap-4 sm:grid-cols-2"><FormField label={t("pdf.footer")} hint={t("pdf.footerHint")} error={fieldError("footer." + original)}><Textarea maxLength={1000} rows={3} disabled={blocked} value={draft.footer?.[original] ?? ""} onChange={event => change({ ...draft, footer: { ...draft.footer, [original]: event.target.value } })}/></FormField><FormField label={t("pdf.footerTranslation", { language: t("cultures." + other) })} hint={t("pdf.optionalTranslation")} error={fieldError("footer." + other)}><Textarea maxLength={1000} rows={3} disabled={blocked} value={draft.footer?.[other] ?? ""} onChange={event => change({ ...draft, footer: { ...draft.footer, [other]: event.target.value } })}/></FormField></div>
    {error && !review ? <p role="status" className="text-sm">{readErrorMessage(error, t)}</p> : null}{cooldown.isRunning ? <p role="status">{t("wait", { count: cooldown.seconds })}</p> : null}
    <p className="text-xs text-[var(--color-content-muted)]">{baseline.revision ? t("pdf.revision", { revision: baseline.revision, date: baseline.createdAtUtc ? formatDateTimeInZone(baseline.createdAtUtc, i18n.language, timeZoneId) : "" }) : t("pdf.noRevision")}</p><p className="text-xs text-[var(--color-content-muted)]">{t("pdf.fixedHint")}</p>
   </div></Surface>
   <Surface title={t("pdf.preview")} padded actions={<SegmentedControl aria-label={t("pdf.previewLanguage")} options={(["es", "en"] as const).map(value => ({ key: value, label: value === "es" ? "Español" : "English", pressed: culture === value, onSelect: () => { setCulture(value); setPreview(null); } }))}/>}><div className="space-y-4"><Button variant="outline" disabled={blocked || !prepared.design} onClick={() => { if (prepared.design)
        setPreview({ design: prepared.design, culture }); }}>{t("pdf.preview")}</Button>{preview ? <FormPdfPreview load={loadPreview} onForbidden={onDenied} requestedCulture={preview.culture} example/> : <p className="text-sm text-[var(--color-content-muted)]">{t("pdf.previewHint")}</p>}</div></Surface>
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
