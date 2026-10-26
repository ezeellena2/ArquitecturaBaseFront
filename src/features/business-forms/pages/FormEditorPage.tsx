import { useQueryClient } from "@tanstack/react-query";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { useSystemPresentation } from "@/shared/api/presentation";
import { maximumFiles, hasInvalidFileCounts } from "../fileQuestions";
import { hasInvalidSelectionCounts } from "../selectionQuestions";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { formatDateTimeInZone } from "@/shared/lib/dateTime";
import { useBreadcrumbLeaf } from "@/shared/hooks/useBreadcrumbLeaf";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { FormField } from "@/shared/ui/FormField";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";
import { Page } from "@/shared/ui/Page";
import { LockIcon } from "@/shared/ui/icons";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { QuestionEditor } from "../components/QuestionEditor";
import { FormPreview } from "../components/FormPreview";
import { OfficialFormPreview } from "../components/OfficialFormPreview";
import { PublicationProgress } from "../components/PublicationProgress";
import { publicationLabelKey } from "../publicationPresentation";
import { useFormPublication } from "../hooks/useFormPublication";
import { useFormOverviewScope } from "../hooks/useFormOverview";
import { useResponseScope } from "../hooks/useResponseQueries";
import { FormDeletionDialog } from "../components/FormDeletionDialog";
import { FormDeactivationDialog } from "../components/FormDeactivationDialog";
import { FormLifecycleMenu } from "../components/FormLifecycleMenu";
import { FormLifecycleNotice } from "../components/FormLifecycleNotice";
import { PublicationCheckDialog } from "../components/PublicationCheckDialog";
import { DraftReview, DraftReviewChanges } from "../components/DraftReview";
import { localizedIssue, localizedIssueMessage, publicationFieldIssues } from "../validationPaths";
import { localizedValue, missingFormTexts, moveItem, newQuestion, suggestedPrefix } from "../editorModel";
import { formActorKey, formDetailKey, useFormDefinition, type FormReadScope } from "../hooks/useFormQueries";
import { useFormDraftEditor } from "../hooks/useFormDraftEditor";
import type { FormDeactivation, FormDetail, FormPublicationCheck } from "../api/response";
import type { CatalogQuestionPreview, DraftEditorValue, FormDefinitionSnapshot } from "../model";

import { missingFormInitial } from "../missingFormSeed";

const FormSuggestionsSection = lazy(() => import("../components/FormSuggestionsSection").then(module => ({ default: module.FormSuggestionsSection })));
const FormRulesSection = lazy(() => import("../components/FormRulesSection").then(module => ({ default: module.FormRulesSection })));

export function FormEditorPage() {
  const { t, i18n } = useTranslation("forms");
  const { formId = "" } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navigationState = location.state;
  const reactivateOnOpen = navigationState !== null && typeof navigationState === "object" && "reactivateFormId" in navigationState && navigationState.reactivateFormId === formId;
  // «Ir a la pregunta» from a catalog field's uses names the question to open.
  const openQuestionFieldId = navigationState !== null && typeof navigationState === "object" && "questionFieldId" in navigationState && typeof navigationState.questionFieldId === "string" ? navigationState.questionFieldId : null;
  const { data: user } = useCurrentUser();
  const scope: FormReadScope = { actorId: user?.id ?? null, culture: i18n.language.startsWith("en") ? "en" : "es", permissions: user?.permissions ?? [] };
  const detail = useFormDefinition(scope, formId);
  // Changing the menu language reads the detail again under its own key. Meanwhile, or if that read fails, the editor keeps
  // the last one of the same actor, permissions and form read in the other language, and its draft: translating is editing
  // the same form. In the same language nothing is retained: a removed detail (a deleted form) leaves the editor as before.
  const detailOwner = JSON.stringify([scope.actorId, [...scope.permissions].sort(), formId]);
  const [mountedDetail, setMountedDetail] = useState<{ owner: string; culture: string; detail: FormDetail } | null>(null);
  if (detail.data && (mountedDetail?.owner !== detailOwner || mountedDetail.culture !== scope.culture || mountedDetail.detail !== detail.data)) setMountedDetail({ owner: detailOwner, culture: scope.culture, detail: detail.data });
  const loaded = detail.data ?? (mountedDetail?.owner === detailOwner && mountedDetail.culture !== scope.culture ? mountedDetail.detail : undefined);
  const detailFeedbackId = `forms:detail:${scope.actorId}:${scope.culture}:${formId}`;
  useEffect(() => () => { dismissNotification(detailFeedbackId); }, [detailFeedbackId]);
  useEffect(() => {
    if (!detail.error) { dismissNotification(detailFeedbackId); return; }
    const feedback = errorFeedback(detail.error);
    if (["cancelled", "session", "forbidden"].includes(feedback.kind) || detail.error instanceof ApiError && detail.error.status === 404) return;
    notify({ id: detailFeedbackId, kind: "error", message: readErrorMessage(detail.error, t) });
  }, [detail.error, detailFeedbackId, t]);
  useEffect(() => { if (reactivateOnOpen && detail.data && detail.isFetchedAfterMount && !detail.isError) void navigate(location.pathname + location.search, { replace: true, state: null }); }, [reactivateOnOpen, detail.data, detail.isFetchedAfterMount, detail.isError, navigate, location.pathname, location.search]);
  if (!user || formId && (detail.isPending && !loaded || reactivateOnOpen && !detail.isFetchedAfterMount)) return <Page title={t(formId ? "title" : "new")}><Spinner /></Page>;
  if (!scope.permissions.includes("formtemplates.read") || detail.error instanceof ApiError && detail.error.status === 403) return <ForbiddenPage />;
  if (formId && (!loaded || reactivateOnOpen && detail.isError)) return <Page title={t("title")} backTo={{ to: "/formularios", label: t("title") }}><EmptyState title={t(detail.error instanceof ApiError && detail.error.status === 404 ? "notFound" : "detailFailed")} action={<Button type="button" variant="outline" onClick={() => void detail.refetch()}>{t("common:actions.retry")}</Button>} /></Page>;
  // The menu language is not part of the key: the editor shows the same draft in the new language.
  return <FormEditor key={`${scope.actorId}:${formId}`} scope={scope} reactivateOnOpen={reactivateOnOpen} openQuestionFieldId={openQuestionFieldId} timeZoneId={user.timeZoneId} initial={loaded ?? missingFormInitial(scope, formId, navigationState)} onPublicationChanged={() => { void detail.refetch(); }} />;
}

function FormEditor({ scope, initial, timeZoneId, onPublicationChanged, reactivateOnOpen, openQuestionFieldId }: { reactivateOnOpen: boolean; openQuestionFieldId: string | null; scope: FormReadScope; initial: FormDetail | DraftEditorValue; timeZoneId?: string; onPublicationChanged: () => void }) {
  const { t } = useTranslation("forms");
  // The preview falls back to the original's texts: they load with the editor, not while a translation is being typed.
  useTranslation("forms", { lng: "definition" in initial ? initial.definition.draft.culture : initial.draft.culture });
  const [rulesDirty, setRulesDirty] = useState(false);
  const [suggestionsDirty, setSuggestionsDirty] = useState(false);
  // No content language selector: the form is edited in the menu language. Changing it keeps the draft and shows its other
  // translation, with the original as the reference.
  const contentCulture = scope.culture;
  const navigate = useNavigate();
  const editor = useFormDraftEditor(scope, initial);
  const presentation = useSystemPresentation();
  const publication = useFormPublication(scope);
  const queryClient = useQueryClient();
  const responseScope = useResponseScope();
  const overviewScope = useFormOverviewScope();
  const lifecycle = "definition" in initial ? initial.lifecycle : undefined;
  const canPublish = scope.permissions.includes("formtemplates.publish") && (!("definition" in initial) || initial.capabilities.canPublish);
  const deactivated = !!lifecycle?.deactivatedAtUtc;
  const projection = "definition" in initial ? initial.publication : undefined;
  const { resume } = publication;
  useEffect(() => { if ("definition" in initial && initial.capabilities.canPublish) void resume(initial.definition.id, initial.publication); }, [initial, resume]);
  const refreshedState = useRef<string | null>(null);
  useEffect(() => { const state = publication.status; if (state && ["Published", "Failed"].includes(state.state) && refreshedState.current !== state.operationId + ":" + state.state) { refreshedState.current = state.operationId + ":" + state.state; onPublicationChanged(); if (publication.startedHere) void queryClient.invalidateQueries({ queryKey: ["form-overview", overviewScope.owner] }); } }, [publication.status, publication.startedHere, onPublicationChanged, queryClient, overviewScope.owner]);
  const prefixLock = useRef(editor.lockPrefix);
  const requireReview = useRef(editor.requireReview);
  useEffect(() => { prefixLock.current = editor.lockPrefix; requireReview.current = editor.requireReview; }, [editor.lockPrefix, editor.requireReview]);
  const publicationDefinitionId = publication.confirmed ? (publication.status ?? publication.receipt)?.definitionId : null;
  useEffect(() => { if (publicationDefinitionId) prefixLock.current(publicationDefinitionId); }, [publicationDefinitionId]);
  const { resetRejected } = publication;

  const cooldown = useCountdown(0);
  const { restart: restartCooldown } = cooldown;
  // The wait of a 429 is the reason of the actions it disables, never a text on the page.
  const waitReason = cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null;
  const previewOwner = JSON.stringify([scope.actorId, scope.culture, [...scope.permissions].sort(), editor.session?.scope.editorId]);
  const [catalogPreviews, setCatalogPreviews] = useState<{ owner: string; items: Readonly<Record<string, CatalogQuestionPreview | null>> }>({ owner: previewOwner, items: {} });
  const observeCatalogPreview = useCallback((questionId: string, preview: CatalogQuestionPreview | null) => setCatalogPreviews(previous => {
    const items = previous.owner === previewOwner ? previous.items : {};
    return JSON.stringify(items[questionId] ?? null) === JSON.stringify(preview) && previous.owner === previewOwner ? previous : { owner: previewOwner, items: { ...items, [questionId]: preview } };
  }), [previewOwner]);
  // Arriving from a catalog field's uses opens that question of the draft; a use left only in the active version opens none.
  const [expanded, setExpanded] = useState<string | null>(() => openQuestionFieldId ? editor.session?.value.draft.fields.find(q => q.fieldId === openQuestionFieldId)?.localId ?? null : null);
  const [prefixTouched, setPrefixTouched] = useState("definition" in initial);
  const [removeId, setRemoveId] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [retainedReview, setRetainedReview] = useState<{ value: DraftEditorValue; definition: FormDefinitionSnapshot } | null>(null);
  const lifecycleAction = useRef<HTMLButtonElement>(null);
  const deletionFallback = useRef<HTMLElement | null>(null);
  const publicationAction = useRef<HTMLButtonElement>(null);
  const publicationReturnFocus = useRef<HTMLElement | null>(null);
  const publicationLeadsToRange = useRef(false);
  const [publicationOpen, setPublicationOpen] = useState(() => reactivateOnOpen && !!lifecycle?.deactivatedAtUtc && lifecycle.canReactivate && canPublish);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [deletionOpen, setDeletionOpen] = useState(false);
  // A blocking problem located from the check stays under its field, with its language, until the next change, save or check.
  const [locatedIssue, setLocatedIssue] = useState<FormPublicationCheck["issues"][number] | null>(null);
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
  // Once a question is drawn, focuses the control `control` picks inside it.
  const focusQuestion = useCallback((localId: string, control: (container: HTMLElement | undefined) => HTMLElement | null | undefined) => requestAnimationFrame(() => {
    if (!active.current) return;
    control([...(host.current?.querySelectorAll<HTMLElement>("[data-question-local-id]") ?? [])].find(element => element.dataset.questionLocalId === localId))?.focus();
  }), []);
  const revealQuestion = useCallback((localId: string, control: (container: HTMLElement | undefined) => HTMLElement | null | undefined) => { setExpanded(localId); focusQuestion(localId, control); }, [focusQuestion]);
  // The question opened on arrival takes the focus on its catalog control. While the catalog cannot be chosen (its list is still loading)
  // the label holds the focus, and the catalog takes it as soon as it is enabled, unless the focus already left the label.
  const arrivalQuestion = useRef(expanded);
  useEffect(() => {
    const localId = arrivalQuestion.current;
    if (!localId) return;
    let catalogWait: MutationObserver | undefined;
    const frame = focusQuestion(localId, container => {
      const label = container?.querySelector<HTMLElement>('[data-question-control="label"]');
      const catalog = container?.querySelector<HTMLSelectElement>('[data-question-control="catalog"]');
      if (!catalog?.disabled) return catalog ?? label;
      catalogWait = new MutationObserver(() => {
        if (catalog.disabled) return;
        catalogWait?.disconnect();
        if (document.activeElement === label) catalog.focus();
      });
      catalogWait.observe(catalog, { attributes: true, attributeFilter: ["disabled"] });
      return label;
    });
    return () => { cancelAnimationFrame(frame); catalogWait?.disconnect(); };
  }, [focusQuestion]);
  const dirty = !!session && JSON.stringify(session.value) !== JSON.stringify(session.baseline);
  const frozen = !!session && session.phase !== "Editing";
  const publicationPending = ["Accepting", "Unconfirmed"].includes(publication.phase);
  const guard = useUnsavedChangesGuard(dirty || rulesDirty || suggestionsDirty || frozen || publicationPending);
  const reviewRequired = session?.phase === "ReviewRequired";
  const readOnly = !editor.canSave;
  // An enabled Save says there are changes. A new form has nothing saved yet, so it can be saved as it is (validated on the attempt).
  const saveEnabled = editor.canSave && (dirty || !session?.confirmed);
  const knownDeleted = editor.issue?.kind === "read" && editor.issue.code === "Forms.Definition.NotFound";
  const originalName = value?.name[value.draft.culture] ?? "";
  // The title and the breadcrumb show the name in the menu language and, without a translation, the original.
  const displayName = value ? localizedValue(value.name, contentCulture, value.draft.culture) : "";
  // The lifecycle dialogs name the confirmed form like the title: in the menu language and, without a translation, the original.
  const confirmedName = session?.confirmed ? localizedValue(session.confirmed.name, contentCulture, session.confirmed.draft.culture) || originalName : originalName;
  useBreadcrumbLeaf(displayName || t("new"));
  useEffect(() => { active.current = true; return () => { active.current = false; dismissNotification(feedbackId); }; }, [feedbackId]);
  useEffect(() => {
    if (!editor.issue) { dismissNotification(feedbackId); return; }
    const issue = editor.issue;
    const visiblePaths = issue.fields?.filter(field => /^(name(?:\.(es|en))?|prefix|offerWhen|draft\.fields|draft\.submitLabel(?:\.(es|en))?)$/.test(field.path)
      || /\.(label|help)(?:\.(es|en))?$/.test(field.path) || /\.(type|required|maxLength|options|selection(?:\.(?:minSelected|maxSelected))?)$/.test(field.path) || /\.source(?:\.|$)/.test(field.path)).map(field => field.path) ?? [];
    const feedback = errorFeedback(issue.error, { writing: session?.phase === "Unconfirmed", fields: visiblePaths });
    if (issue.kind === "validation" && visiblePaths.length) {
      const first = issue.fields?.find(field => visiblePaths.includes(field.path));
      requestAnimationFrame(() => {
        if (!active.current) return;
        if (first?.fieldLocalId) setExpanded(first.fieldLocalId);
        requestAnimationFrame(() => host.current?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus());
      });
    }
    if (issue.kind === "validation" && feedback.kind === "fields" || issue.kind === "forbidden" || feedback.kind === "session") return;
    if (feedback.kind === "wait") restartCooldown(Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60)));
    const conflict = issue.kind === "conflict" && issue.code !== "Forms.Draft.RequestConflict";
    const message = issue.code === "Forms.Definition.NotFound" ? t("lifecycle.deletedWhileEditing") : issue.code === "Forms.Draft.RequestConflict" ? t("requestConflict") : issue.kind === "validation" ? t("unmappedValidation")
      : feedback.kind === "wait" ? t("wait", { count: feedback.retryAfterSeconds ?? 60 }) : issue.kind === "uncertain" ? operationalErrorMessage(issue.error, t)
      : t(conflict ? "conflict" : issue.kind === "expired" ? "expired" : issue.kind === "missing" ? "notConfirmed" : issue.kind === "read" ? "reviewFailed" : "saveFailed");
    notify({ id: feedbackId, kind: feedback.kind === "wait" ? "warning" : "error", message,
      description: feedback.traceId && issue.kind !== "uncertain" ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined,
      action: conflict ? { label: t("review"), onClick: () => { if (active.current) { reviewReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; void readCurrent.current().then(success => { if (success && active.current) setReviewOpen(true); }); } } } : undefined });
  }, [editor.issue, feedbackId, t, session?.phase, restartCooldown]);
  // Save stays enabled with an invalid range: trying it opens the first question with one and focuses its first marked control, without sending.
  const invalidRangeQuestion = () => value?.draft.fields.find(q => hasInvalidFileCounts([q]) || hasInvalidSelectionCounts([q]));
  async function operate(action: () => Promise<FormDefinitionSnapshot | undefined>) {
    const invalidRange = action === editor.save ? invalidRangeQuestion() : undefined;
    if (invalidRange) { revealQuestion(invalidRange.localId, container => container?.querySelector<HTMLElement>("[aria-invalid='true']")); return; }
    setLocatedIssue(null);
    const saved = await action();
    if (!saved || !active.current) return;
    setRetainedReview(null);
    notify({ id: `forms:saved:${scope.actorId}:${saved.id}`, kind: "success", message: t("saved", { name: localizedValue(saved.name, contentCulture, saved.draft.culture) }) });
    if (!("definition" in initial)) { guard.allowNextNavigation(); void navigate(`/formularios/${saved.id}`, { replace: true }); }
    return saved;
  }
  function showReview() {
    reviewReturnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    void editor.readCurrent().then(success => { if (success && active.current) setReviewOpen(true); });
  }
  if (!value || !session) return <ForbiddenPage />;
  const visibleIssues = [...(editor.issue?.fields ?? []), ...publicationFieldIssues(value, [...publication.status?.issues ?? [], ...locatedIssue ? [locatedIssue] : []])];
  const errorFor = (path: string) => visibleIssues.find(issue => issue.path === path || path !== "draft.fields" && issue.path.startsWith(`${path}.`))?.messages[0];
  // The name and the final button show an error of either language under the visible field.
  const formTextIssues = Object.fromEntries(visibleIssues.filter(issue => !issue.fieldLocalId).reverse().map(issue => [issue.path, issue.messages]));
  const textError = (path: "name" | "draft.submitLabel") => localizedIssueMessage(localizedIssue(formTextIssues, path, contentCulture), contentCulture, t);
  const prefixLocked = (session.confirmed?.prefixLocked ?? false) || ["Accepting", "Unconfirmed"].includes(publication.phase);
  const publicationState = publication.status?.state ?? publication.receipt?.state ?? publication.aggregate?.state ?? projection?.currentOperation?.state ?? (projection?.activeVersion ? "Published" : undefined);
  const publicationVersion = publication.status?.versionNumber ?? publication.receipt?.versionNumber ?? publication.aggregate?.versionNumber ?? projection?.currentOperation?.versionNumber ?? projection?.activeVersion?.versionNumber;
  const publicationLabel = publication.phase === "Accepting" ? "publication.accepting" : publication.phase === "Unconfirmed" || publicationState === "Uncertain" ? "publication.unconfirmed" : publicationState ? publicationLabelKey(publicationState) : null;
  const firstInvalid = editor.issue?.fields?.find(issue => issue.fieldLocalId)?.fieldLocalId;
  const change = (next: DraftEditorValue) => { dismissNotification(feedbackId); setLocatedIssue(null); editor.change(next); };
  const openPublication = (returnFocus: HTMLElement | null) => { publicationReturnFocus.current = returnFocus; setLocatedIssue(null); publication.resetRejected(); setPublicationOpen(true); };
  const leave = () => { if (guard.isBlocked) guard.leave(); else { guard.allowNextNavigation(); void navigate("/formularios"); } };
  const updateQuestion = (localId: string, question: typeof value.draft.fields[number]) => {
    change({ ...value, draft: { ...value.draft, fields: value.draft.fields.map(q => q.localId === localId ? question : q) } });
    if (question.localId !== localId) setExpanded(question.localId);
  };
  // Completing a translation only locates its control; a problem also stays under it.
  function goToPublicationIssue(issue: FormPublicationCheck["issues"][number]) {
    setLocatedIssue(issue);
    locatePublicationIssue(issue);
  }
  function locatePublicationIssue(issue: FormPublicationCheck["issues"][number]) {
    setPublicationOpen(false);
    const question = value!.draft.fields.find(q => q.fieldId === issue.fieldId);
    if (!question) {
      requestAnimationFrame(() => { if (active.current) host.current?.querySelector<HTMLInputElement>(issue.path.startsWith("name") ? '[data-form-text="name"]' : '[data-form-text="submitLabel"]')?.focus(); });
      return;
    }
    revealQuestion(question.localId, container => {
      const option = (question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options.find(o => o.choiceId === issue.choiceId) : undefined;
      const optionInput = option ? [...(container?.querySelectorAll<HTMLInputElement>("[data-choice-local-id]") ?? [])].find(element => element.dataset.choiceLocalId === option.localId) : undefined;
      const selectionInput = issue.path.includes(".selection") ? container?.querySelectorAll<HTMLInputElement>('[data-question-control="selection"] input')[issue.path.endsWith(".maxSelected") ? 1 : 0] : undefined;
      return optionInput ?? selectionInput ?? container?.querySelector<HTMLElement>(issue.path.includes(".source") ? '[data-question-control="catalog"]' : issue.path.includes(".help") ? '[data-question-control="help"]' : '[data-question-control="label"]');
    });
  }
  async function confirmDeactivation(result: FormDeactivation, expectedRevision: number) {
    if (!active.current) return;
    const adopted = editor.confirmRevision(result.definitionId, expectedRevision, result.revision);
    if (adopted) queryClient.setQueryData<FormDetail>(formDetailKey(scope, result.definitionId), previous => previous && previous.definition.revision === expectedRevision
      ? { ...previous, definition: { ...previous.definition, revision: result.revision }, lifecycle: result.lifecycle } : previous);
    await Promise.all([queryClient.invalidateQueries({ queryKey: formActorKey(scope.actorId) }), queryClient.invalidateQueries({ queryKey: ["form-overview", overviewScope.owner] }), queryClient.invalidateQueries({ queryKey: ["form-responses", responseScope.owner] })]);
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
  return <div ref={host}><Page title={displayName || t("new")} backTo={{ to: "/formularios", label: t("title") }} status={<Badge variant="outline" className={deactivated ? undefined : publicationState === "Published" ? "bg-[var(--color-success-50)] text-[var(--color-success-700)]" : publicationState === "Failed" ? "border-danger/30 bg-danger/5 text-[var(--color-danger)]" : publicationPending || publicationState === "Uncertain" ? "border-[var(--color-warning)]/45 bg-[var(--color-warning-50)] text-[var(--color-warning-700)]" : undefined}>{deactivated ? t(projection?.activeVersion ? "lifecycle.state" : "lifecycle.stateWithoutVersion", { version: projection?.activeVersion?.versionNumber }) : publicationLabel ? t(publicationLabel, { version: publicationVersion }) : t("draft")}</Badge>} actions={<>
    {!readOnly || dirty || rulesDirty || suggestionsDirty ? <Button type="button" variant="outline" disabled={frozen || publicationPending} onClick={() => { if (dirty || rulesDirty || suggestionsDirty) setDiscardOpen(true); else leave(); }}>{t("discard")}</Button> : null}
    {scope.permissions.includes("formtemplates.manage") ? <DisabledReason reason={saveEnabled ? waitReason : null}><Button ref={saveButton} type="button" variant={scope.permissions.includes("formtemplates.publish") && session.confirmed ? "outline" : "default"} disabled={!saveEnabled || cooldown.isRunning} onClick={() => void operate(editor.save)}>{t(editor.busy && session.phase === "Saving" ? "saving" : "save")}</Button></DisabledReason> : null}
    {canPublish && session.confirmed ? <Button ref={publicationAction} type="button" disabled={knownDeleted || deactivated && !lifecycle?.canReactivate || frozen || editor.busy || ["Accepting", "Unconfirmed"].includes(publication.phase) || publication.phase === "Accepted" && !["Published", "Failed"].includes(publication.status?.state ?? "")} onClick={() => openPublication(publicationAction.current)}>{t(deactivated ? "lifecycle.reactivate" : "publication.title")}</Button> : null}
    {lifecycle && (scope.permissions.includes("formtemplates.publish") || scope.permissions.includes("formtemplates.manage")) ? <FormLifecycleMenu canManage={scope.permissions.includes("formtemplates.manage")} canPublish={canPublish} onDelete={() => { deletionFallback.current = lifecycleAction.current; setDeletionOpen(true); }} triggerRef={lifecycleAction} lifecycle={lifecycle} blocked={knownDeleted || frozen || editor.busy || publicationPending} onDeactivate={() => setDeactivationOpen(true)} onReactivate={() => openPublication(lifecycleAction.current)} /> : null}
    {"definition" in initial && initial.capabilities.canPreview && projection?.activeVersion ? <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>{t("publication.previewAction")}</Button> : null}
  </>}>
    <div className="flex flex-col gap-4">
    {lifecycle ? <FormLifecycleNotice lifecycle={lifecycle} timeZoneId={timeZoneId} /> : null}
    {!deactivated || publication.phase === "Accepting" || publication.phase === "Unconfirmed" || (publicationVersion ?? 0) > (projection?.activeVersion?.versionNumber ?? 0) ? <PublicationProgress publication={publication} projection={projection} feedbackId={`forms:publication:${session.scope.editorId}`} onReplay={() => void publication.replay()} onGoToIssue={goToPublicationIssue} canLocateIssue={issue => publicationFieldIssues(value, [issue]).length > 0} /> : null}
    {/* An unconfirmed save and a pending review are states of the flow: their own surface, titled, with the actions in its band. */}
    {session.phase === "Unconfirmed" ? <Surface title={t("uncertain")} padded actions={<>
      <DisabledReason reason={editor.busy || editor.issue?.kind === "expired" ? null : waitReason}><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning || editor.issue?.kind === "expired"} onClick={() => void operate(editor.recover)}>{t(editor.busy ? "recovering" : "recover")}</Button></DisabledReason>
      {editor.issue?.kind === "missing" && scope.permissions.includes("formtemplates.manage") ? <Button type="button" variant="outline" disabled={editor.busy} onClick={() => void operate(editor.retry)}>{t("retrySame")}</Button> : null}
    </>}><p className="text-sm">{t(editor.issue?.kind === "forbidden" ? "noSave" : editor.issue?.code === "Forms.Draft.RequestConflict" ? "requestConflict" : editor.issue?.kind === "expired" ? "expired" : "uncertainHint")}</p></Surface> : null}
    {reviewRequired ? <Surface title={t("reviewTitle")} padded actions={<DisabledReason reason={editor.busy ? null : waitReason}><Button type="button" variant="outline" disabled={editor.busy || cooldown.isRunning} onClick={showReview}>{t("review")}</Button></DisabledReason>}><p className="text-sm">{t("reviewPending")}</p></Surface> : null}
    {retainedReview ? <Surface title={t("reviewChangesToInspect")} padded><p className="mb-3 text-sm">{t("reviewNoSave")}</p><DraftReviewChanges catalogScope={scope} value={retainedReview.value} definition={retainedReview.definition} culture={scope.culture} /></Surface> : null}
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex min-w-0 flex-col gap-4">

        <Surface title={t("form")} padded><div className="grid gap-4 sm:grid-cols-2">
          <FormField label={t("name")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: originalName }) : undefined} error={textError("name")}><Input readOnly={readOnly} maxLength={120} placeholder={contentCulture !== value.draft.culture ? t("missingText") : undefined} data-form-text="name" value={value.name[contentCulture] ?? ""} onChange={e => change({ ...value, name: { ...value.name, [contentCulture]: e.target.value }, prefix: prefixTouched || contentCulture !== value.draft.culture ? value.prefix : suggestedPrefix(e.target.value) })} /></FormField>
          <FormField label={t("submitLabel")} hint={contentCulture !== value.draft.culture ? t("originalText", { language: t("cultures." + value.draft.culture), text: value.draft.submitLabel[value.draft.culture] }) : t("submitHint")} error={textError("draft.submitLabel")}><Input readOnly={readOnly} placeholder={contentCulture !== value.draft.culture ? t("missingText") : undefined} data-form-text="submitLabel" value={value.draft.submitLabel[contentCulture] ?? ""} onChange={e => change({ ...value, draft: { ...value.draft, submitLabel: { ...value.draft.submitLabel, [contentCulture]: e.target.value } } })} /></FormField>
          <FormField label={<span className="inline-flex items-center gap-1">{t("prefix")}{prefixLocked || contentCulture !== value.draft.culture ? <LockIcon className="size-3.5" /> : null}</span>} error={errorFor("prefix") ?? (editor.issue?.code === "Forms.Definition.PrefixTaken" ? t("prefixTaken") : undefined)} hint={publicationPending ? t("publication.prefixPending") : prefixLocked ? t("prefixLocked") : contentCulture !== value.draft.culture ? t("prefixOriginal") : t("prefixHint", { prefix: value.prefix || "…" })}><Input readOnly={readOnly || prefixLocked || contentCulture !== value.draft.culture} value={value.prefix} onChange={e => { setPrefixTouched(true); change({ ...value, prefix: e.target.value }); }} /></FormField>
          <div className="sm:col-span-2"><FormField label={t("offerWhen")} hint={t("offerWhenHint")} error={errorFor("offerWhen")}><Textarea readOnly={readOnly} maxLength={1000} value={value.offerWhen ?? ""} onChange={event => change({ ...value, offerWhen: event.target.value || null })} /></FormField></div>
        </div></Surface>
        <Surface title={t("questions")} actions={<>{maximumFiles(value.draft.fields) > 0 ? <span className="text-xs text-[var(--color-content-muted)]">{t("files.budget", { total: maximumFiles(value.draft.fields) })}</span> : null}<span className="text-xs text-[var(--color-content-muted)]">{t("publication.questions", { count: value.draft.fields.length })}</span>{!readOnly ? <DisabledReason reason={value.draft.fields.length >= 40 ? t("questionLimit", { count: 40 }) : null}><Button ref={addQuestionButton} type="button" variant="outline" disabled={value.draft.fields.length >= 40} onClick={() => { const q = newQuestion("shortText", value.draft.culture, crypto.randomUUID()); change({ ...value, draft: { ...value.draft, fields: [...value.draft.fields, q] } }); setExpanded(q.localId); }}>{t("addQuestion")}</Button></DisabledReason> : null}</>}>
          {value.draft.fields.length === 0 ? <EmptyState embedded title={t("emptyQuestions")} /> : null}
          {value.draft.fields.map((q, index) => <QuestionEditor key={q.localId} catalogScope={scope} definitionId={session.confirmed?.id ?? null} previewCulture={contentCulture !== value.draft.culture && missingFormTexts(value, contentCulture) ? value.draft.culture : contentCulture} onPreviewChange={observeCatalogPreview} filesAvailable={presentation.data?.installedFeatures?.includes("form-files") ?? false} question={q} position={index + 1} total={value.draft.fields.length} culture={contentCulture} original={value.draft.culture} expanded={expanded === q.localId || expanded === null && firstInvalid === q.localId} readOnly={readOnly} issues={visibleIssues.filter(issue => issue.fieldLocalId === q.localId)} onChange={question => updateQuestion(q.localId, question)} onExpand={open => setExpanded(open ? q.localId : null)} onMove={delta => change({ ...value, draft: { ...value.draft, fields: moveItem(value.draft.fields, index, delta) } })} onRemove={() => { if (q.fieldId || Object.values(q.label).some(Boolean)) setRemoveId(q.localId); else removeQuestion(q.localId); }} />)}
          {errorFor("draft.fields") ? <p role="alert" className="p-4 text-sm text-[var(--color-danger)]">{errorFor("draft.fields")}</p> : null}

        </Surface>
      </div>
      <FormPreview key={session.scope.editorId} value={value} culture={contentCulture} catalogPreviews={catalogPreviews.owner === previewOwner ? catalogPreviews.items : {}} />
    </div>
    {session.confirmed && scope.permissions.includes("formsuggestions.manage") ? <Suspense fallback={<Spinner />}><FormSuggestionsSection publishedVersionId={projection?.activeVersion?.versionId??null} timeZoneId={timeZoneId} definitionId={session.confirmed.id} definitionRevision={session.confirmed.revision} scope={scope} onDirtyChange={setSuggestionsDirty} /></Suspense> : null}
    {session.confirmed && scope.permissions.includes("formrules.manage") ? <Suspense fallback={<Spinner />}><FormRulesSection timeZoneId={timeZoneId} definitionId={session.confirmed.id} definitionRevision={session.confirmed.revision} scope={scope} onDirtyChange={setRulesDirty} /></Suspense> : null}
    </div>
  </Page>

  {previewOpen && "definition" in initial && initial.capabilities.canPreview && projection?.activeVersion ? <OfficialFormPreview key={projection.activeVersion.versionId} definitionId={initial.definition.id} versionId={projection.activeVersion.versionId} versionNumber={projection.activeVersion.versionNumber} cultures={projection.activeVersion.cultures} culture={scope.culture} originalCulture={value.draft.culture} onClose={() => setPreviewOpen(false)} /> : null}
  {deactivationOpen && scope.permissions.includes("formtemplates.publish") && session.confirmed ? <FormDeactivationDialog id={session.confirmed.id} name={confirmedName} focusFallback={lifecycleAction} timeZoneId={timeZoneId} scope={scope} expectedRevision={session.confirmed.revision} onRevisionMismatch={() => { setDeactivationOpen(false); editor.requireReview(new ApiError(409, { code: "Forms.Draft.RevisionConflict" })); }} onComplete={confirmDeactivation} onObserved={() => Promise.all([queryClient.invalidateQueries({ queryKey: formActorKey(scope.actorId) }), queryClient.invalidateQueries({ queryKey: ["form-overview", overviewScope.owner] }), queryClient.invalidateQueries({ queryKey: ["form-responses", responseScope.owner] })]).then(() => undefined)} onClose={() => setDeactivationOpen(false)} /> : null}
  {deletionOpen && session.confirmed && scope.permissions.includes("formtemplates.manage") ? <FormDeletionDialog id={session.confirmed.id} name={confirmedName} prefix={session.confirmed.prefix} hasPublishedVersion={!!projection?.activeVersion} revision={session.confirmed.revision} scope={scope} focusFallback={deletionFallback} onChanged={() => { deletionFallback.current = host.current?.querySelector<HTMLElement>('[data-form-text="name"]') ?? null; void queryClient.invalidateQueries({ queryKey: formActorKey(scope.actorId) }); }} onClose={() => { if (!deletionFallback.current?.isConnected) deletionFallback.current = lifecycleAction.current ?? host.current?.querySelector<HTMLElement>('[data-form-text="name"]') ?? null; setDeletionOpen(false); }} onDeleted={() => { guard.allowNextNavigation(); void navigate("/formularios", { replace: true }); queryClient.removeQueries({ queryKey: formDetailKey(scope, session.confirmed!.id) }); void queryClient.invalidateQueries({ queryKey: formActorKey(scope.actorId) }); void queryClient.invalidateQueries({ queryKey: ["form-overview", overviewScope.owner] }); void queryClient.invalidateQueries({ queryKey: ["form-responses", responseScope.owner] }); }} /> : null}
  {publicationOpen && session.confirmed && scope.permissions.includes("formtemplates.publish") ? <PublicationCheckDialog onCloseAutoFocus={event => { if (publicationLeadsToRange.current) { publicationLeadsToRange.current = false; event.preventDefault(); return; } const target = [publicationReturnFocus.current, publicationAction.current, lifecycleAction.current].find(node => node?.isConnected && !node.matches(":disabled")); if (target) { event.preventDefault(); target.focus(); } }} key={session.confirmed.revision + ":" + [...scope.permissions].sort().join(",")} scope={scope} id={session.confirmed.id} revision={session.confirmed.revision} reactivation={deactivated && lifecycle ? { name: confirmedName, nextRecordNumber: lifecycle.nextRecordNumber } : undefined} savedAt={"definition" in initial ? formatDateTimeInZone(initial.audit.lastChangedAtUtc, scope.culture, timeZoneId) : undefined} prefixLocked={session.confirmed.prefixLocked} baseVersionId={projection?.activeVersion?.versionId} baseVersionNumber={projection?.activeVersion?.versionNumber} value={value} dirty={dirty} canSave={editor.canSave && !cooldown.isRunning} accepting={publication.busy} onAccept={(body, checked) => {
    const acceptance = publication.accept(session.confirmed!.id, body, checked);
    setPublicationOpen(false);
    void acceptance.then(receipt => { if (receipt && active.current) notify({ id: `forms:publication-accepted:${scope.actorId}:${receipt.operationId}`, kind: "success", message: t("publication.accepted", { version: receipt.versionNumber }) }); });
  }} onOpenChange={setPublicationOpen} onSave={() => {
    // With an invalid range the dialog closes without taking the focus back: Save leads it to the marked control.
    publicationLeadsToRange.current = !!invalidRangeQuestion();
    setPublicationOpen(false);
    void operate(editor.save).then(saved => { if (saved && active.current) setPublicationOpen(true); });
  }} onConflict={error => { setPublicationOpen(false); editor.requireReview(error); }} onGoToIssue={goToPublicationIssue} onCompleteTranslation={locatePublicationIssue} /> : null}
  <ConfirmDialog open={(discardOpen || guard.isBlocked) && !frozen && !publicationPending} onOpenChange={open => { setDiscardOpen(open); if (!open) guard.stay(); }} title={t("discardTitle")} description={t("discardDescription")} cancelLabel={t("stay")} confirmLabel={t("discard")} destructive onConfirm={leave} />
  {guard.isBlocked && publicationPending ? <ConfirmDialog open onOpenChange={() => guard.stay()} title={t("publication.unconfirmed")} description={t("publication.unconfirmedHint")} cancelLabel={t("stay")} confirmLabel={t("publication.consult")} onConfirm={() => { guard.stay(); void publication.consult(); }} /> : null}
  {guard.isBlocked && session.phase === "Saving" && !publicationPending ? <Dialog open onOpenChange={() => guard.stay()}><DialogContent><DialogHeader><DialogTitle>{t("saving")}</DialogTitle><DialogDescription>{t("savingLeave")}</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={() => guard.stay()}>{t("stay")}</Button></DialogFooter></DialogContent></Dialog> : null}
  {guard.isBlocked && frozen && session.phase !== "Saving" && !publicationPending ? <ConfirmDialog open onOpenChange={() => guard.stay()} title={t(reviewRequired ? "reviewTitle" : "uncertain")} description={t(reviewRequired ? "reviewPending" : "busyLeave")} cancelLabel={t("stay")} confirmLabel={t(session.phase === "Unconfirmed" ? "recover" : "review")} onConfirm={() => { guard.stay(); if (session.phase === "Unconfirmed") void operate(editor.recover); else if (reviewRequired) showReview(); }} /> : null}
  <ConfirmDialog focusFallback={removalFocus} open={removeId !== null} onOpenChange={open => { if (!open) setRemoveId(null); }} title={t("removeTitle")} description={t("removeDescription")} confirmLabel={t("removeQuestionAction")} destructive onConfirm={() => { if (removeId) removeQuestion(removeId); }} />
  {editor.review ? <DraftReview catalogScope={scope} key={editor.review.definition.revision} value={value} definition={editor.review.definition} culture={scope.culture} auditSummary={t("reviewAudit", { date: formatDateTimeInZone(editor.review.audit.lastChangedAtUtc, scope.culture, timeZoneId), author: editor.review.audit.lastChangedBy?.displayName ?? "—" })} open={reviewOpen} onCloseAutoFocus={event => { event.preventDefault(); [reviewReturnFocus.current, saveButton.current, host.current?.querySelector<HTMLElement>('[data-form-text="name"]')].find(node => node?.isConnected && !node.matches(":disabled"))?.focus(); }} onOpenChange={setReviewOpen} onUseCurrent={editor.useCurrent} onResolve={choices => { setRetainedReview({ value, definition: editor.review!.definition }); editor.resolveReview(choices); }} /> : null}
  </div>;
}
