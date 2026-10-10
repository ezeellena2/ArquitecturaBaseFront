import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Page } from "@/shared/ui/Page";
import { Spinner } from "@/shared/ui/Spinner";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { QuestionEditor } from "../components/QuestionEditor";
import { FormPreview } from "../components/FormPreview";
import { DraftReview } from "../components/DraftReview";
import { emptyForm, missingFormTexts, moveItem, newQuestion, suggestedPrefix } from "../editorModel";
import { useFormDefinition, type FormReadScope } from "../hooks/useFormQueries";
import { useFormDraftEditor } from "../hooks/useFormDraftEditor";
import type { FormDetail } from "../api/response";
import type { DraftEditorValue, FormCulture, FormDefinitionSnapshot } from "../model";

export function FormEditorPage() {
  const { t, i18n } = useTranslation("forms");
  const { formId = "" } = useParams();
  const { data: user } = useCurrentUser();
  const scope: FormReadScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const detail = useFormDefinition(scope, formId);
  const detailFeedbackId = `forms:detail:${scope.actorId}:${scope.culture}:${formId}`;
  useEffect(() => () => { dismissNotification(detailFeedbackId); }, [detailFeedbackId]);
  useEffect(() => {
    if (!detail.error) { dismissNotification(detailFeedbackId); return; }
    const feedback = errorFeedback(detail.error);
    if (["cancelled", "session", "forbidden"].includes(feedback.kind)) return;
    notify({ id: detailFeedbackId, kind: "error", message: t("detailFailed"), description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
  }, [detail.error, detailFeedbackId, t]);
  if (!user || formId && detail.isPending) return <Page title={t("new")}><Spinner /></Page>;
  if (!scope.permissions.includes("formtemplates.read") || detail.error instanceof ApiError && detail.error.status === 403) return <ForbiddenPage />;
  if (formId && !detail.data) return <Page title={t("title")} backTo={{ to: "/formularios", label: t("title") }}><EmptyState title={t(detail.error instanceof ApiError && detail.error.status === 404 ? "notFound" : "detailFailed")} action={<Button type="button" variant="outline" onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button>} /></Page>;
  return <FormEditor key={`${scope.actorId}:${scope.culture}:${formId}`} scope={scope} timeZoneId={user.timeZoneId} initial={detail.data ?? emptyForm(scope.culture)} />;
}

function FormEditor({ scope, initial, timeZoneId }: { scope: FormReadScope; initial: FormDetail | DraftEditorValue; timeZoneId?: string }) {
  const { t, i18n } = useTranslation("forms");
  useTranslation("forms", { lng: "en" });
  useTranslation("forms", { lng: "es" });
  const [contentCulture, setContentCulture] = useState<FormCulture>("definition" in initial ? initial.definition.draft.culture : initial.draft.culture);
  const navigate = useNavigate();
  const editor = useFormDraftEditor(scope, initial);
  const cooldown = useCountdown(0);
  const { restart: restartCooldown } = cooldown;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prefixTouched, setPrefixTouched] = useState("definition" in initial);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const reviewReturnFocus = useRef<HTMLElement | null>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const active = useRef(true);
  const readCurrent = useRef(editor.readCurrent);
  useEffect(() => { readCurrent.current = editor.readCurrent; }, [editor.readCurrent]);
  const feedbackId = `forms:editor:${editor.session?.scope.editorId}`;
  const session = editor.session;
  const value = session?.value;
  const dirty = !!session && JSON.stringify(session.value) !== JSON.stringify(session.baseline);
  const frozen = !!session && session.phase !== "Editing";
  const guard = useUnsavedChangesGuard(dirty || frozen);
  const reviewRequired = session?.phase === "ReviewRequired";
  const readOnly = !editor.canSave;
  const originalName = value?.name[value.draft.culture] ?? "";
  useBreadcrumbLeaf(originalName || t("new"));
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  useEffect(() => {
    if (!editor.issue) { dismissNotification(feedbackId); return; }
    const issue = editor.issue;
    const visiblePaths = issue.fields?.filter(field => /^(name(?:\.(es|en))?|prefix|draft\.fields|draft\.submitLabel(?:\.(es|en))?)$/.test(field.path)
      || /\.(label|help)(?:\.(es|en))?$/.test(field.path) || /\.(type|required|maxLength|options)$/.test(field.path)).map(field => field.path) ?? [];
    const feedback = errorFeedback(issue.error, { writing: session?.phase === "Unconfirmed", fields: visiblePaths });
    if (issue.kind === "validation" && visiblePaths.length) {
      const first = issue.fields?.find(field => visiblePaths.includes(field.path));
      const language = first?.path.match(/\.(es|en)$/)?.[1] as FormCulture | undefined;
      requestAnimationFrame(() => {
        if (!active.current) return;
        if (language) setContentCulture(language);
        if (first?.fieldLocalId) setExpanded(first.fieldLocalId);
        requestAnimationFrame(() => host.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      });
    }
    if (issue.kind === "validation" && feedback.kind === "fields" || issue.kind === "forbidden" || feedback.kind === "session") return;
    if (feedback.kind === "wait") restartCooldown(Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60)));
    const conflict = issue.kind === "conflict" && issue.code !== "Forms.Draft.RequestConflict";
    const message = issue.code === "Forms.Draft.RequestConflict" ? t("requestConflict") : issue.kind === "validation" ? t("unmappedValidation")
      : feedback.kind === "wait" ? t("wait", { count: feedback.retryAfterSeconds ?? 60 }) : issue.kind === "uncertain" ? operationalErrorMessage(issue.error, t)
      : t(conflict ? "conflict" : issue.kind === "expired" ? "expired" : issue.kind === "missing" ? "notConfirmed" : issue.kind === "read" ? "reviewFailed" : "saveFailed");
    notify({ id: feedbackId, kind: feedback.kind === "wait" ? "warning" : "error", message,
      description: feedback.traceId && issue.kind !== "uncertain" ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined,
      action: conflict ? { label: t("review"), onClick: () => { if (active.current) { reviewReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; void readCurrent.current().then(success => { if (success && active.current) setReviewOpen(true); }); } } } : undefined });
  }, [editor.issue, feedbackId, t, session?.phase, restartCooldown]);
  async function operate(action: () => Promise<FormDefinitionSnapshot | undefined>) {
    const saved = await action();
    if (!saved || !active.current) return;
    notify({ id: `forms:saved:${scope.actorId}:${saved.id}`, kind: "success", message: t("saved", { name: saved.name[saved.draft.culture] }) });
    if (!("definition" in initial)) { guard.allowNextNavigation(); void navigate(`/formularios/${saved.id}`, { replace: true }); }
  }
  function showReview() {
    reviewReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void editor.readCurrent().then(success => { if (success && active.current) setReviewOpen(true); });
  }
  if (!value || !session) return <ForbiddenPage />;
  const errorFor = (path: string) => editor.issue?.fields?.find(issue => issue.path === path || path !== "draft.fields" && issue.path.startsWith(`${path}.`))?.messages[0];
  const prefixLocked = session.confirmed?.prefixLocked ?? false;
  const firstInvalid = editor.issue?.fields?.find(issue => issue.fieldLocalId)?.fieldLocalId;
  const change = (next: DraftEditorValue) => { dismissNotification(feedbackId); editor.change(next); };
  const leave = () => { if (guard.isBlocked) guard.leave(); else { guard.allowNextNavigation(); void navigate("/formularios"); } };
  const updateQuestion = (localId: string, question: typeof value.draft.fields[number]) => {
    change({ ...value, draft: { ...value.draft, fields: value.draft.fields.map(q => q.localId === localId ? question : q) } });
    if (question.localId !== localId) setExpanded(question.localId);
  };
  return <div ref={host}><Page title={originalName || t("new")} backTo={{ to: "/formularios", label: t("title") }} status={<Badge variant="outline">{t(session.phase === "Unconfirmed" ? "uncertain" : dirty ? "dirty" : "draft")}</Badge>} actions={<>
    {!readOnly || dirty ? <Button type="button" variant="outline" disabled={frozen} onClick={() => setDiscardOpen(true)}>{t("discard")}</Button> : null}
    {scope.permissions.includes("formtemplates.manage") ? <Button ref={saveButton} type="button" disabled={!editor.canSave} onClick={() => void operate(editor.save)}>{t(editor.busy && session.phase === "Saving" ? "saving" : "save")}</Button> : null}
  </>}>
    {cooldown.isRunning ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait", { count: cooldown.seconds })}</p> : null}
    {session.phase === "Unconfirmed" ? <Surface padded><p className="text-sm">{t(editor.issue?.kind === "forbidden" ? "noSave" : editor.issue?.code === "Forms.Draft.RequestConflict" ? "requestConflict" : editor.issue?.kind === "expired" ? "expired" : "uncertainHint")}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning || editor.issue?.kind === "expired"} onClick={() => void operate(editor.recover)}>{t(editor.busy ? "recovering" : "recover")}</Button>{editor.issue?.kind === "missing" && scope.permissions.includes("formtemplates.manage") ? <Button type="button" variant="outline" disabled={editor.busy} onClick={() => void operate(editor.retry)}>{t("retrySame")}</Button> : null}</div></Surface> : null}
    {reviewRequired ? <Surface padded><p className="text-sm">{t("reviewPending")}</p><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning} onClick={showReview}>{t("review")}</Button></Surface> : null}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">

        <Surface padded><div className="flex flex-col gap-3"><p className="text-sm font-medium">{t("contentLanguage")}</p><div className="flex flex-wrap gap-2"><SegmentedControl aria-label={t("contentLanguage")} options={(["es", "en"] as const).map(language => ({ key: language, pressed: contentCulture === language, onSelect: () => setContentCulture(language), label: <span>{i18n.getFixedT(language, "forms")("cultures." + language)}{language === value.draft.culture ? <span className="ml-1 text-xs">· {t("languageOriginal")}</span> : null}</span> }))} /></div><div className="flex flex-wrap gap-2">{(["es", "en"] as const).map(language => <Badge key={language} variant="outline">{t("cultures." + language)} · {t("languageMissing", { count: missingFormTexts(value, language) })}</Badge>)}</div><p className="text-xs text-[var(--color-content-muted)]">{t("sharedStructure")}</p></div></Surface>
        <Surface title={t("form")} padded><div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("name")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: originalName }) : undefined} error={errorFor("name." + contentCulture)}><Input readOnly={readOnly} maxLength={120} placeholder={t("missingText", { language: t("cultures." + contentCulture) })} value={value.name[contentCulture] ?? ""} onChange={e => change({ ...value, name: { ...value.name, [contentCulture]: e.target.value }, prefix: prefixTouched || contentCulture !== value.draft.culture ? value.prefix : suggestedPrefix(e.target.value) })} /></FormField>
          <FormField label={t("submitLabel")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: value.draft.submitLabel[value.draft.culture] }) : t("submitHint")} error={errorFor("draft.submitLabel." + contentCulture)}><Input readOnly={readOnly} placeholder={t("missingText", { language: t("cultures." + contentCulture) })} value={value.draft.submitLabel[contentCulture] ?? ""} onChange={e => change({ ...value, draft: { ...value.draft, submitLabel: { ...value.draft.submitLabel, [contentCulture]: e.target.value } } })} /></FormField>
          <FormField label={t("prefix")} error={errorFor("prefix") ?? (editor.issue?.code === "Forms.Definition.PrefixTaken" ? t("prefixTaken") : undefined)} hint={prefixLocked ? t("prefixLocked") : contentCulture !== value.draft.culture ? t("prefixOriginal") : t("prefixHint", { prefix: value.prefix || "…" })}><Input readOnly={readOnly || prefixLocked || contentCulture !== value.draft.culture} value={value.prefix} onChange={e => { setPrefixTouched(true); change({ ...value, prefix: e.target.value }); }} /></FormField>
        </div><p className="text-xs text-[var(--color-content-muted)]">{t("translations")}</p></Surface>
        <Surface title={t("questions")}>
          {value.draft.fields.length === 0 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("emptyQuestions")}</p> : null}
          {value.draft.fields.map((q, index) => <QuestionEditor key={q.localId} question={q} position={index + 1} total={value.draft.fields.length} culture={contentCulture} original={value.draft.culture} expanded={expanded === q.localId || expanded === null && firstInvalid === q.localId} readOnly={readOnly} issues={editor.issue?.fields?.filter(issue => issue.fieldLocalId === q.localId) ?? []} onChange={question => updateQuestion(q.localId, question)} onExpand={open => setExpanded(open ? q.localId : null)} onMove={delta => change({ ...value, draft: { ...value.draft, fields: moveItem(value.draft.fields, index, delta) } })} onRemove={() => { if (q.fieldId || Object.values(q.label).some(Boolean)) setRemoveId(q.localId); else change({ ...value, draft: { ...value.draft, fields: value.draft.fields.filter(field => field.localId !== q.localId) } }); }} />)}
          {errorFor("draft.fields") ? <p role="alert" className="p-4 text-sm text-[var(--color-danger)]">{errorFor("draft.fields")}</p> : null}
          {!readOnly ? <div className="p-4"><Button type="button" variant="outline" disabled={value.draft.fields.length >= 40} onClick={() => { const q = newQuestion("shortText", value.draft.culture, crypto.randomUUID()); change({ ...value, draft: { ...value.draft, fields: [...value.draft.fields, q] } }); setExpanded(q.localId); }}>{t("addQuestion")}</Button></div> : null}
        </Surface>
      </div>
      <FormPreview key={session.scope.editorId} value={value} culture={contentCulture} />
    </div>
  </Page>

  <ConfirmDialog open={(discardOpen || guard.isBlocked) && !frozen} onOpenChange={open => { setDiscardOpen(open); if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} cancelLabel={t("stay")} confirmLabel={t("discard")} destructive onConfirm={leave} />
  {guard.isBlocked && frozen ? <ConfirmDialog open onOpenChange={() => guard.stay()} title={t("uncertain")} description={t("busyLeave")} cancelLabel={t("stay")} confirmLabel={t(session.phase === "Unconfirmed" ? "recover" : "review")} onConfirm={() => { guard.stay(); if (session.phase === "Unconfirmed") void operate(editor.recover); else if (reviewRequired) showReview(); }} /> : null}
  <ConfirmDialog open={removeId !== null} onOpenChange={open => { if (!open) setRemoveId(null); }} title={t("removeTitle")} description={t("removeDescription")} confirmLabel={t("common:actions.confirm")} destructive onConfirm={() => { if (!readOnly) change({ ...value, draft: { ...value.draft, fields: value.draft.fields.filter(q => q.localId !== removeId) } }); }} />
  {editor.review ? <DraftReview key={editor.review.definition.revision} value={value} definition={editor.review.definition} culture={scope.culture} auditSummary={t("reviewAudit", { date: formatDateTimeInZone(editor.review.audit.lastChangedAtUtc, scope.culture, timeZoneId), author: editor.review.audit.lastChangedBy?.displayName ?? "—" })} open={reviewOpen} onCloseAutoFocus={event => { event.preventDefault(); const target = reviewReturnFocus.current; if (target?.isConnected && !target.matches(":disabled")) target.focus(); else (saveButton.current ?? host.current?.querySelector<HTMLInputElement>("input"))?.focus(); }} onOpenChange={setReviewOpen} onUseCurrent={editor.useCurrent} onResolve={editor.resolveReview} /> : null}
  </div>;
}
