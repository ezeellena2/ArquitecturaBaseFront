import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { maximumFiles, hasInvalidFileCounts } from "../fileQuestions";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
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
import { Textarea } from "@/shared/ui/textarea";
import { Page } from "@/shared/ui/Page";
import { LockIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Spinner } from "@/shared/ui/Spinner";
import { SegmentedControl } from "@/shared/ui/SegmentedControl";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { QuestionEditor } from "../components/QuestionEditor";
import { FormPreview } from "../components/FormPreview";
import { OfficialFormPreview } from "../components/OfficialFormPreview";
import { PublicationProgress } from "../components/PublicationProgress";
import { publicationLabelKey } from "../publicationPresentation";
import { useFormPublication } from "../hooks/useFormPublication";
import { PublicationCheckDialog } from "../components/PublicationCheckDialog";
import { DraftReview, DraftReviewChanges } from "../components/DraftReview";
import { publicationFieldIssues } from "../validationPaths";
import { missingFormTexts, moveItem, newQuestion, suggestedPrefix } from "../editorModel";
import { useFormDefinition, type FormReadScope } from "../hooks/useFormQueries";
import { useFormDraftEditor } from "../hooks/useFormDraftEditor";
import type { FormDetail, FormPublicationCheck } from "../api/response";
import type { DraftEditorValue, FormCulture, FormDefinitionSnapshot } from "../model";

import { missingFormInitial } from "../missingFormSeed";

const FormSuggestionsSection = lazy(() => import("../components/FormSuggestionsSection").then(module => ({ default: module.FormSuggestionsSection })));
const FormRulesSection = lazy(() => import("../components/FormRulesSection").then(module => ({ default: module.FormRulesSection })));

export function FormEditorPage() {
  const { t, i18n } = useTranslation("forms");
  const { formId = "" } = useParams();
  const navigationState = useLocation().state;
  const { data: user } = useCurrentUser();
  const scope: FormReadScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const detail = useFormDefinition(scope, formId);
  const detailFeedbackId = `forms:detail:${scope.actorId}:${scope.culture}:${formId}`;
  useEffect(() => () => { dismissNotification(detailFeedbackId); }, [detailFeedbackId]);
  useEffect(() => {
    if (!detail.error) { dismissNotification(detailFeedbackId); return; }
    const feedback = errorFeedback(detail.error);
    if (["cancelled", "session", "forbidden"].includes(feedback.kind) || detail.error instanceof ApiError && detail.error.status === 404) return;
    notify({ id: detailFeedbackId, kind: "error", message: readErrorMessage(detail.error, t) });
  }, [detail.error, detailFeedbackId, t]);
  if (!user || formId && detail.isPending) return <Page title={t(formId ? "title" : "new")}><Spinner /></Page>;
  if (!scope.permissions.includes("formtemplates.read") || detail.error instanceof ApiError && detail.error.status === 403) return <ForbiddenPage />;
  if (formId && !detail.data) return <Page title={t("title")} backTo={{ to: "/formularios", label: t("title") }}><EmptyState title={t(detail.error instanceof ApiError && detail.error.status === 404 ? "notFound" : "detailFailed")} action={<Button type="button" variant="outline" onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button>} /></Page>;
  return <FormEditor key={`${scope.actorId}:${scope.culture}:${formId}`} scope={scope} timeZoneId={user.timeZoneId} initial={detail.data ?? missingFormInitial(scope, formId, navigationState)} onPublicationChanged={() => { void detail.refetch(); }} />;
}

function FormEditor({ scope, initial, timeZoneId, onPublicationChanged }: { scope: FormReadScope; initial: FormDetail | DraftEditorValue; timeZoneId?: string; onPublicationChanged: () => void }) {
  const { t, i18n } = useTranslation("forms");
  useTranslation("forms", { lng: "en" });
  useTranslation("forms", { lng: "es" });
  const [rulesDirty, setRulesDirty] = useState(false);
  const [suggestionsDirty, setSuggestionsDirty] = useState(false);
  const [contentCulture, setContentCulture] = useState<FormCulture>("definition" in initial ? initial.definition.draft.culture : initial.draft.culture);
  const navigate = useNavigate();
  const editor = useFormDraftEditor(scope, initial);
  const presentation = useSystemPresentation();
  const publication = useFormPublication(scope);
  const projection = "definition" in initial ? initial.publication : undefined;
  const { resume } = publication;
  useEffect(() => { if ("definition" in initial && initial.capabilities.canPublish) void resume(initial.definition.id, initial.publication); }, [initial, resume]);
  const refreshedState = useRef<string | null>(null);
  useEffect(() => { const state = publication.status; if (state && ["Published", "Failed"].includes(state.state) && refreshedState.current !== state.operationId + ":" + state.state) { refreshedState.current = state.operationId + ":" + state.state; onPublicationChanged(); } }, [publication.status, onPublicationChanged]);
  const prefixLock = useRef(editor.lockPrefix);
  const requireReview = useRef(editor.requireReview);
  useEffect(() => { prefixLock.current = editor.lockPrefix; requireReview.current = editor.requireReview; }, [editor.lockPrefix, editor.requireReview]);
  const publicationDefinitionId = publication.confirmed ? (publication.status ?? publication.receipt)?.definitionId : null;
  useEffect(() => { if (publicationDefinitionId) prefixLock.current(publicationDefinitionId); }, [publicationDefinitionId]);
  const { resetRejected } = publication;

  const cooldown = useCountdown(0);
  const { restart: restartCooldown } = cooldown;
  const [expanded, setExpanded] = useState<string | null>(null);
  const [prefixTouched, setPrefixTouched] = useState("definition" in initial);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [retainedReview, setRetainedReview] = useState<{ value: DraftEditorValue; definition: FormDefinitionSnapshot } | null>(null);
  const [publicationOpen, setPublicationOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  useEffect(() => {
    const error = publication.error;
    if (error instanceof ApiError && ["Forms.Draft.RevisionConflict", "Forms.Publication.DraftMustBeSaved"].includes(error.code ?? "")) {
      const frame = requestAnimationFrame(() => { setPublicationOpen(false); requireReview.current(error); resetRejected(); });
      return () => cancelAnimationFrame(frame);
    }
  }, [publication.error, resetRejected]);
  const host = useRef<HTMLDivElement>(null);
  const reviewReturnFocus = useRef<HTMLElement | null>(null);
  const saveButton = useRef<HTMLButtonElement>(null);
  const addQuestionButton = useRef<HTMLButtonElement>(null);
  const removalFocus = useRef<HTMLElement | null>(null);
  const active = useRef(true);
  const readCurrent = useRef(editor.readCurrent);
  useEffect(() => { readCurrent.current = editor.readCurrent; }, [editor.readCurrent]);
  const feedbackId = `forms:editor:${editor.session?.scope.editorId}`;
  const session = editor.session;
  const value = session?.value;
  const dirty = !!session && JSON.stringify(session.value) !== JSON.stringify(session.baseline);
  const frozen = !!session && session.phase !== "Editing";
  const publicationPending = ["Accepting", "Unconfirmed"].includes(publication.phase);
  const guard = useUnsavedChangesGuard(dirty || rulesDirty || suggestionsDirty || frozen || publicationPending);
  const reviewRequired = session?.phase === "ReviewRequired";
  const readOnly = !editor.canSave;
  const originalName = value?.name[value.draft.culture] ?? "";
  useBreadcrumbLeaf(originalName || t("new"));
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  useEffect(() => {
    if (!editor.issue) { dismissNotification(feedbackId); return; }
    const issue = editor.issue;
    const visiblePaths = issue.fields?.filter(field => /^(name(?:\.(es|en))?|prefix|offerWhen|draft\.fields|draft\.submitLabel(?:\.(es|en))?)$/.test(field.path)
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
    if (action === editor.save && value && hasInvalidFileCounts(value.draft.fields)) return;
    const saved = await action();
    if (!saved || !active.current) return;
    setRetainedReview(null);
    notify({ id: `forms:saved:${scope.actorId}:${saved.id}`, kind: "success", message: t("saved", { name: saved.name[saved.draft.culture] }) });
    if (!("definition" in initial)) { guard.allowNextNavigation(); void navigate(`/formularios/${saved.id}`, { replace: true }); }
    return saved;
  }
  function showReview() {
    reviewReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void editor.readCurrent().then(success => { if (success && active.current) setReviewOpen(true); });
  }
  if (!value || !session) return <ForbiddenPage />;
  const visibleIssues = [...(editor.issue?.fields ?? []), ...publicationFieldIssues(value, publication.status?.issues ?? [])];
  const errorFor = (path: string) => visibleIssues.find(issue => issue.path === path || path !== "draft.fields" && issue.path.startsWith(`${path}.`))?.messages[0];
  const prefixLocked = (session.confirmed?.prefixLocked ?? false) || ["Accepting", "Unconfirmed"].includes(publication.phase);
  const publicationState = publication.status?.state ?? publication.receipt?.state ?? publication.aggregate?.state ?? projection?.currentOperation?.state ?? (projection?.activeVersion ? "Published" : undefined);
  const publicationVersion = publication.status?.versionNumber ?? publication.receipt?.versionNumber ?? publication.aggregate?.versionNumber ?? projection?.currentOperation?.versionNumber ?? projection?.activeVersion?.versionNumber;
  const publicationLabel = publication.phase === "Accepting" ? "publication.accepting" : publication.phase === "Unconfirmed" || publicationState === "Uncertain" ? "publication.unconfirmed" : publicationState ? publicationLabelKey(publicationState) : null;
  const firstInvalid = editor.issue?.fields?.find(issue => issue.fieldLocalId)?.fieldLocalId;
  const change = (next: DraftEditorValue) => { dismissNotification(feedbackId); editor.change(next); };
  const leave = () => { if (guard.isBlocked) guard.leave(); else { guard.allowNextNavigation(); void navigate("/formularios"); } };
  const updateQuestion = (localId: string, question: typeof value.draft.fields[number]) => {
    change({ ...value, draft: { ...value.draft, fields: value.draft.fields.map(q => q.localId === localId ? question : q) } });
    if (question.localId !== localId) setExpanded(question.localId);
  };
  function goToPublicationIssue(issue: FormPublicationCheck["issues"][number]) {
    setPublicationOpen(false);
    if (issue.culture) setContentCulture(issue.culture);
    const question = value!.draft.fields.find(q => q.fieldId === issue.fieldId);
    if (question) setExpanded(question.localId);
    requestAnimationFrame(() => {
      if (!active.current) return;
      if (!question) { host.current?.querySelector<HTMLInputElement>(issue.path.startsWith("name") ? '[data-form-text="name"]' : '[data-form-text="submitLabel"]')?.focus(); return; }
      const container = [...(host.current?.querySelectorAll<HTMLElement>("[data-question-local-id]") ?? [])].find(element => element.dataset.questionLocalId === question.localId);
      const option = question.type === "choice" && !question.source ? question.options.find(o => o.choiceId === issue.choiceId) : undefined;
      const optionInput = option ? [...(container?.querySelectorAll<HTMLInputElement>("[data-choice-local-id]") ?? [])].find(element => element.dataset.choiceLocalId === option.localId) : undefined;
      (optionInput ?? container?.querySelector<HTMLElement>(issue.path.includes(".source") ? '[data-question-control="catalog"]' : issue.path.includes(".help") ? '[data-question-control="help"]' : '[data-question-control="label"]'))?.focus();
    });
  }
  function removeQuestion(localId: string) {
    if (readOnly) return;
    const index = value!.draft.fields.findIndex(q => q.localId === localId);
    const neighbor = value!.draft.fields[index + 1] ?? value!.draft.fields[index - 1];
    const row = [...(host.current?.querySelectorAll<HTMLElement>("[data-question-local-id]") ?? [])].find(element => element.dataset.questionLocalId === neighbor?.localId);
    removalFocus.current = row?.querySelector<HTMLButtonElement>('[data-question-action="edit"]') ?? addQuestionButton.current;
    change({ ...value!, draft: { ...value!.draft, fields: value!.draft.fields.filter(q => q.localId !== localId) } });
    if (!removeId) requestAnimationFrame(() => removalFocus.current?.focus());
  }
  return <div ref={host}><Page title={originalName || t("new")} backTo={{ to: "/formularios", label: t("title") }} status={<Badge variant="outline" className={publicationState === "Published" ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]" : publicationState === "Failed" ? "border-danger/30 bg-danger/5 text-[var(--color-danger)]" : dirty || frozen || publicationPending || publicationState === "Uncertain" ? "border-[var(--color-warning)]/45 bg-[var(--color-warning-50)] text-[var(--color-warning-700)]" : undefined}>{publicationLabel ? t(publicationLabel, { version: publicationVersion }) : t(session.phase === "Unconfirmed" ? "uncertain" : dirty ? "dirty" : "draft")}</Badge>} actions={<>
    {!readOnly || dirty || rulesDirty || suggestionsDirty ? <Button type="button" variant="outline" disabled={frozen || publicationPending} onClick={() => { if (dirty || rulesDirty || suggestionsDirty) setDiscardOpen(true); else leave(); }}>{t("discard")}</Button> : null}
    {scope.permissions.includes("formtemplates.manage") ? <Button ref={saveButton} type="button" variant={scope.permissions.includes("formtemplates.publish") && session.confirmed ? "outline" : "default"} disabled={!editor.canSave || hasInvalidFileCounts(value.draft.fields)} onClick={() => void operate(editor.save)}>{t(editor.busy && session.phase === "Saving" ? "saving" : "save")}</Button> : null}
    {scope.permissions.includes("formtemplates.publish") && (!("definition" in initial) || initial.capabilities.canPublish) && session.confirmed ? <Button type="button" disabled={frozen || editor.busy || ["Accepting", "Unconfirmed"].includes(publication.phase) || publication.phase === "Accepted" && !["Published", "Failed"].includes(publication.status?.state ?? "")} onClick={() => { publication.resetRejected(); setPublicationOpen(true); }}>{t("publication.title")}</Button> : null}
    {"definition" in initial && initial.capabilities.canPreview && projection?.activeVersion ? <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>{t("publication.previewAction")}</Button> : null}
  </>}>
    <div className="flex flex-col gap-4">
    {cooldown.isRunning ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait", { count: cooldown.seconds })}</p> : null}
    <PublicationProgress publication={publication} projection={projection} feedbackId={`forms:publication:${session.scope.editorId}`} onReplay={() => void publication.replay()} onGoToIssue={goToPublicationIssue} canLocateIssue={issue => publicationFieldIssues(value, [issue]).length > 0} />
    {session.phase === "Unconfirmed" ? <Surface padded><p className="text-sm">{t(editor.issue?.kind === "forbidden" ? "noSave" : editor.issue?.code === "Forms.Draft.RequestConflict" ? "requestConflict" : editor.issue?.kind === "expired" ? "expired" : "uncertainHint")}</p><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning || editor.issue?.kind === "expired"} onClick={() => void operate(editor.recover)}>{t(editor.busy ? "recovering" : "recover")}</Button>{editor.issue?.kind === "missing" && scope.permissions.includes("formtemplates.manage") ? <Button type="button" variant="outline" disabled={editor.busy} onClick={() => void operate(editor.retry)}>{t("retrySame")}</Button> : null}</div></Surface> : null}
    {reviewRequired ? <Surface padded><p className="text-sm">{t("reviewPending")}</p><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning} onClick={showReview}>{t("review")}</Button></Surface> : null}
    {retainedReview ? <Surface title={t("reviewChangesToInspect")} padded><p className="mb-3 text-sm">{t("reviewNoSave")}</p><DraftReviewChanges catalogScope={scope} value={retainedReview.value} definition={retainedReview.definition} culture={scope.culture} /></Surface> : null}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">

        <Surface padded><div className="flex flex-col gap-3"><p className="text-sm font-medium">{t("contentLanguage")}</p><div className="flex flex-wrap gap-2"><SegmentedControl wrapLabels aria-label={t("contentLanguage")} options={(["es", "en"] as const).map(language => ({ key: language, pressed: contentCulture === language, onSelect: () => setContentCulture(language), label: <span>{i18n.getFixedT(language, "forms")("cultures." + language)}{" "}{language === value.draft.culture ? <span className="text-xs">· {t("languageOriginal")}</span> : <span className="text-xs text-[var(--color-content-muted)]">· {missingFormTexts(value, language) ? t("languageMissing", { count: missingFormTexts(value, language) }) : t("languageComplete")}</span>}</span> }))} /></div><p className="text-xs text-[var(--color-content-muted)]">{t("contentLanguageHint", { language: t("cultureNamesInText." + value.draft.culture) })}</p></div></Surface>
        <Surface title={t("form")} padded><div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("name")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: originalName }) : undefined} error={errorFor("name." + contentCulture)}><Input readOnly={readOnly} maxLength={120} placeholder={contentCulture !== value.draft.culture ? t("missingText") : undefined} data-form-text="name" value={value.name[contentCulture] ?? ""} onChange={e => change({ ...value, name: { ...value.name, [contentCulture]: e.target.value }, prefix: prefixTouched || contentCulture !== value.draft.culture ? value.prefix : suggestedPrefix(e.target.value) })} /></FormField>
          <FormField label={t("submitLabel")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: value.draft.submitLabel[value.draft.culture] }) : t("submitHint")} error={errorFor("draft.submitLabel." + contentCulture)}><Input readOnly={readOnly} placeholder={contentCulture !== value.draft.culture ? t("missingText") : undefined} data-form-text="submitLabel" value={value.draft.submitLabel[contentCulture] ?? ""} onChange={e => change({ ...value, draft: { ...value.draft, submitLabel: { ...value.draft.submitLabel, [contentCulture]: e.target.value } } })} /></FormField>
          <FormField label={<span className="inline-flex items-center gap-1">{t("prefix")}{prefixLocked || contentCulture !== value.draft.culture ? <LockIcon className="size-3.5" /> : null}</span>} error={errorFor("prefix") ?? (editor.issue?.code === "Forms.Definition.PrefixTaken" ? t("prefixTaken") : undefined)} hint={publicationPending ? t("publication.prefixPending") : prefixLocked ? t("prefixLocked") : contentCulture !== value.draft.culture ? t("prefixOriginal") : t("prefixHint", { prefix: value.prefix || "…" })}><Input readOnly={readOnly || prefixLocked || contentCulture !== value.draft.culture} value={value.prefix} onChange={e => { setPrefixTouched(true); change({ ...value, prefix: e.target.value }); }} /></FormField>
          <div className="sm:col-span-2"><FormField label={t("offerWhen")} hint={t("offerWhenHint")} error={errorFor("offerWhen")}><Textarea readOnly={readOnly} maxLength={1000} value={value.offerWhen ?? ""} onChange={event => change({ ...value, offerWhen: event.target.value || null })} /></FormField></div>
        </div><p className="text-xs text-[var(--color-content-muted)]">{t("translations")}</p></Surface>
        <Surface title={t("questions")} actions={<>{maximumFiles(value.draft.fields) > 0 ? <span className="text-xs text-[var(--color-content-muted)]">{t("files.budget", { total: maximumFiles(value.draft.fields) })}</span> : null}<span className="text-xs text-[var(--color-content-muted)]">{t("publication.questions", { count: value.draft.fields.length })}</span>{!readOnly ? <Button ref={addQuestionButton} type="button" variant="outline" disabled={value.draft.fields.length >= 40} onClick={() => { const q = newQuestion("shortText", value.draft.culture, crypto.randomUUID()); change({ ...value, draft: { ...value.draft, fields: [...value.draft.fields, q] } }); setExpanded(q.localId); }}>{t("addQuestion")}</Button> : null}</>}>
          {value.draft.fields.length === 0 ? <EmptyState embedded title={t("emptyQuestions")} /> : null}
          {value.draft.fields.map((q, index) => <QuestionEditor key={q.localId} catalogScope={scope} filesAvailable={presentation.data?.installedFeatures?.includes("form-files") ?? false} question={q} position={index + 1} total={value.draft.fields.length} culture={contentCulture} original={value.draft.culture} expanded={expanded === q.localId || expanded === null && firstInvalid === q.localId} readOnly={readOnly} issues={visibleIssues.filter(issue => issue.fieldLocalId === q.localId)} onChange={question => updateQuestion(q.localId, question)} onExpand={open => setExpanded(open ? q.localId : null)} onMove={delta => change({ ...value, draft: { ...value.draft, fields: moveItem(value.draft.fields, index, delta) } })} onRemove={() => { if (q.fieldId || Object.values(q.label).some(Boolean)) setRemoveId(q.localId); else removeQuestion(q.localId); }} />)}
          {value.draft.fields.length >= 40 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("questionLimit", { count: 40 })}</p> : null}
          {errorFor("draft.fields") ? <p role="alert" className="p-4 text-sm text-[var(--color-danger)]">{errorFor("draft.fields")}</p> : null}

        </Surface>
      </div>
      <FormPreview key={session.scope.editorId} value={value} culture={contentCulture} />
    </div>
    {session.confirmed && scope.permissions.includes("formsuggestions.manage") ? <Suspense fallback={<Spinner />}><FormSuggestionsSection publishedVersionId={projection?.activeVersion?.versionId??null} timeZoneId={timeZoneId} definitionId={session.confirmed.id} definitionRevision={session.confirmed.revision} scope={scope} contentCulture={contentCulture} onDirtyChange={setSuggestionsDirty} /></Suspense> : null}
    {session.confirmed && scope.permissions.includes("formrules.manage") ? <Suspense fallback={<Spinner />}><FormRulesSection timeZoneId={timeZoneId} definitionId={session.confirmed.id} definitionRevision={session.confirmed.revision} scope={scope} contentCulture={contentCulture} onDirtyChange={setRulesDirty} /></Suspense> : null}
    </div>
  </Page>

  {previewOpen && "definition" in initial && initial.capabilities.canPreview && projection?.activeVersion ? <OfficialFormPreview key={projection.activeVersion.versionId} definitionId={initial.definition.id} versionId={projection.activeVersion.versionId} versionNumber={projection.activeVersion.versionNumber} cultures={projection.activeVersion.cultures} initialCulture={contentCulture} onClose={() => setPreviewOpen(false)} /> : null}
  {publicationOpen && session.confirmed && scope.permissions.includes("formtemplates.publish") ? <PublicationCheckDialog key={session.confirmed.revision + ":" + [...scope.permissions].sort().join(",")} scope={scope} id={session.confirmed.id} revision={session.confirmed.revision} savedAt={"definition" in initial ? formatDateTimeInZone(initial.audit.lastChangedAtUtc, scope.culture, timeZoneId) : undefined} prefixLocked={session.confirmed.prefixLocked} baseVersionId={projection?.activeVersion?.versionId} baseVersionNumber={projection?.activeVersion?.versionNumber} value={value} dirty={dirty} canSave={editor.canSave && !cooldown.isRunning && !hasInvalidFileCounts(value.draft.fields)} accepting={publication.busy} onAccept={(body, checked) => {
    const acceptance = publication.accept(session.confirmed!.id, body, checked);
    setPublicationOpen(false);
    void acceptance.then(receipt => { if (receipt && active.current) notify({ id: `forms:publication-accepted:${scope.actorId}:${receipt.operationId}`, kind: "success", message: t("publication.accepted", { version: receipt.versionNumber }) }); });
  }} onOpenChange={setPublicationOpen} onSave={() => {
    setPublicationOpen(false);
    void operate(editor.save).then(saved => { if (saved && active.current) setPublicationOpen(true); });
  }} onConflict={error => { setPublicationOpen(false); editor.requireReview(error); }} onGoToIssue={goToPublicationIssue} /> : null}
  <ConfirmDialog open={(discardOpen || guard.isBlocked) && !frozen && !publicationPending} onOpenChange={open => { setDiscardOpen(open); if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} cancelLabel={t("stay")} confirmLabel={t("discard")} destructive onConfirm={leave} />
  {guard.isBlocked && publicationPending ? <ConfirmDialog open onOpenChange={() => guard.stay()} title={t("publication.unconfirmed")} description={t("publication.unconfirmedHint")} cancelLabel={t("stay")} confirmLabel={t("publication.consult")} onConfirm={() => { guard.stay(); void publication.consult(); }} /> : null}
  {guard.isBlocked && session.phase === "Saving" && !publicationPending ? <Dialog open onOpenChange={() => guard.stay()}><DialogContent><DialogHeader><DialogTitle>{t("saving")}</DialogTitle><DialogDescription>{t("savingLeave")}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => guard.stay()}>{t("stay")}</Button></DialogFooter></DialogContent></Dialog> : null}
  {guard.isBlocked && frozen && session.phase !== "Saving" && !publicationPending ? <ConfirmDialog open onOpenChange={() => guard.stay()} title={t(reviewRequired ? "reviewTitle" : "uncertain")} description={t(reviewRequired ? "reviewPending" : "busyLeave")} cancelLabel={t("stay")} confirmLabel={t(session.phase === "Unconfirmed" ? "recover" : "review")} onConfirm={() => { guard.stay(); if (session.phase === "Unconfirmed") void operate(editor.recover); else if (reviewRequired) showReview(); }} /> : null}
  <ConfirmDialog focusFallback={removalFocus} open={removeId !== null} onOpenChange={open => { if (!open) setRemoveId(null); }} title={t("removeTitle")} description={t("removeDescription")} confirmLabel={t("removeQuestionAction")} destructive onConfirm={() => { if (removeId) removeQuestion(removeId); }} />
  {editor.review ? <DraftReview catalogScope={scope} key={editor.review.definition.revision} value={value} definition={editor.review.definition} culture={scope.culture} auditSummary={t("reviewAudit", { date: formatDateTimeInZone(editor.review.audit.lastChangedAtUtc, scope.culture, timeZoneId), author: editor.review.audit.lastChangedBy?.displayName ?? "—" })} open={reviewOpen} onCloseAutoFocus={event => { event.preventDefault(); const target = reviewReturnFocus.current; if (target?.isConnected && !target.matches(":disabled")) target.focus(); else (saveButton.current ?? host.current?.querySelector<HTMLInputElement>("input"))?.focus(); }} onOpenChange={setReviewOpen} onUseCurrent={editor.useCurrent} onResolve={choices => { setRetainedReview({ value, definition: editor.review!.definition }); editor.resolveReview(choices); }} /> : null}
  </div>;
}
