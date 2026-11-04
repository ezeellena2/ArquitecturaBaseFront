import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { InfoTip } from "@/shared/ui/InfoTip";
import { Skeleton } from "@/shared/ui/skeleton";
import { Surface } from "@/shared/ui/Surface";
import { AlertCircleIcon, AlertTriangleIcon } from "@/shared/ui/icons";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { hasFormTexts, localizedValue } from "../editorModel";
import { useFormPublicationCheck } from "../hooks/useFormPublicationCheck";
import type { FormReadScope } from "../hooks/useFormQueries";
import type { DraftEditorValue } from "../model";
import type { FormPublicationCheck } from "../api/response";
import { publicationIssueText } from "../publicationPresentation";

type PublicationIssue = FormPublicationCheck["issues"][number];
type PublicationWarning = FormPublicationCheck["warnings"][number];
// Rows with a line between them, as in «Campos de…».
const rows = "flex flex-col divide-y divide-[var(--color-border)] [&>*]:px-4 [&>*]:py-3";
const muted = "text-[var(--color-content-muted)]";

// A row of «Qué se publica»: the label on the left from 640 px and on top below, like a `CatalogRow`.
function SummaryRow({ label, children }: { label: string; children: ReactNode }) {
  return <div className="grid gap-1 sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-x-4">
    <dt className="text-sm font-medium sm:flex sm:min-h-[var(--height-control)] sm:items-center">{label}</dt>
    <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm sm:min-h-[var(--height-control)]">{children}</dd>
  </div>;
}
// What stops the publication or is worth reviewing: what it is, the concrete detail and where to fix it, at the right from
// 640 px and under the text below.
function Finding({ tone, title, action, children }: { tone: "danger" | "warning"; title: string | null; action?: ReactNode; children: ReactNode }) {
  const Icon = tone === "danger" ? AlertCircleIcon : AlertTriangleIcon;
  return <li className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-3 gap-y-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
    <Icon aria-hidden="true" className={cn("mt-0.5 size-4 shrink-0", tone === "danger" ? "text-[var(--color-danger)]" : "text-[var(--color-warning-700)]")} />
    <div className="flex min-w-0 flex-col gap-0.5 text-sm">{title ? <p className="font-medium">{title}</p> : null}{children}</div>
    {action ? <div className="col-start-2 sm:col-start-auto">{action}</div> : null}
  </li>;
}
// A text with its (i) right after the last word, also when the line wraps.
function WithHelp({ label, help, children }: { label: string; help: string; children: ReactNode }) {
  return <p className={muted}><span>{children}</span> <span className="-my-1 inline-flex align-middle"><InfoTip label={label} text={help} /></span></p>;
}

// Before publishing (board PU1-A, 2026-11-01): what stops it and what is worth reviewing, each in its zone only when there is
// any, and what is published in rows. Explanations go in the (i); why Publish is off is its reason, not a note under it.
export function PublicationCheckDialog({ scope, id, revision, value, dirty, canSave, onAccept, accepting, onOpenChange, onSave, onConflict, onGoToIssue, onCompleteTranslation, savedAt, prefixLocked, reactivation, onCloseAutoFocus: restoreExternalFocus }: {
  reactivation?: { name: string; nextRecordNumber: string | null };
  onCloseAutoFocus?: (event: Event) => void;
  scope: FormReadScope; id: string; revision: number; value: DraftEditorValue; dirty: boolean; canSave: boolean; savedAt?: string; prefixLocked: boolean;
  onAccept: (body: DraftEditorValue & { expectedRevision: number }, checked: FormPublicationCheck) => void; accepting: boolean;
  onOpenChange: (open: boolean) => void; onSave: () => void; onConflict: (error: unknown) => void; onGoToIssue: (issue: PublicationIssue) => void; onCompleteTranslation: (missing: PublicationIssue) => void;
}) {
  const { t } = useTranslation("forms");
  const check = useFormPublicationCheck(scope);
  const { check: runCheck } = check;
  const [now, setNow] = useState(Date.now);
  const expired = check.result?.checkExpiresAtUtc ? Date.parse(check.result.checkExpiresAtUtc) <= now : false;
  useEffect(() => { if (!check.result?.checkExpiresAtUtc) return; const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, [check.result?.checkExpiresAtUtc]);
  const [body] = useState(() => ({ ...value, expectedRevision: revision }));
  const restoreFocus = useRestoreFocusOnClose(true);
  const locatingIssue = useRef(false);
  const onCloseAutoFocus = (event: Event) => {
    if (locatingIssue.current) event.preventDefault();
    else (restoreExternalFocus ?? restoreFocus)(event);
  };
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  // The wait of a 429 is the reason of the disabled check actions, not a text in the dialog.
  const waitReason = cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null;
  const feedbackId = "forms:publication-check:" + scope.actorId + ":" + id + ":" + revision;
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);
  useEffect(() => { if (!dirty) void runCheck(id, body); }, [body, runCheck, dirty, id]);
  useEffect(() => {
    if (!check.error) return;
    if (check.error instanceof ApiError && check.error.status === 409) { onConflict(check.error); return; }
    const feedback = errorFeedback(check.error);
    if (["cancelled", "session", "forbidden"].includes(feedback.kind)) return;
    if (feedback.kind === "wait") restart(Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60)));
    notify({ id: feedbackId, kind: feedback.kind === "wait" ? "warning" : "error",
      message: feedback.kind === "wait" ? t("wait", { count: feedback.retryAfterSeconds ?? 60 }) : t("publication.checkFailed"),
      description: feedback.traceId ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
  }, [check.error, feedbackId, onConflict, restart, t]);
  const checking = !dirty && (check.busy || !check.result && !check.error);
  const result = dirty || checking ? null : check.result;
  const list = new Intl.ListFormat(scope.culture, { type: "conjunction" });
  // NI2-C (2026-11-03): written in the menu language, with no translation started, the form says nothing about languages,
  // not even while checking.
  const monolingual = value.draft.culture === scope.culture && !hasFormTexts(value, scope.culture === "es" ? "en" : "es");
  const questionOf = (fieldId: string | null) => value.draft.fields.find(q => !!q.fieldId && q.fieldId.toLowerCase() === fieldId?.toLowerCase());
  const questionName = (fieldId: string | null) => { const question = questionOf(fieldId); return question ? localizedValue(question.label, scope.culture, value.draft.culture) : null; };
  const choiceName = (issue: PublicationIssue) => {
    const question = questionOf(issue.fieldId);
    const option = question && (question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options.find(choice => choice.choiceId === issue.choiceId) : undefined;
    return option ? localizedValue(option.label, scope.culture, value.draft.culture) : null;
  };
  const issueName = (issue: PublicationIssue) => {
    const name = questionName(issue.fieldId)
      ?? (issue.path.startsWith("name") ? t("name") : issue.path.startsWith("draft.submitLabel") ? t("submitLabel") : issue.channelId || issue.path === "channel" ? t("publication.channelIssue") : t("publication.formIssue"));
    // NI1-A (2026-11-03): a problem names its language only when it is not the menu's.
    return issue.culture && issue.culture !== scope.culture ? t("localizedChange", { name, language: t("cultures." + issue.culture) }) : name;
  };
  // A text over its limit says how long it is, and which text when it is not the title (the limit comes in the issue).
  const issueDetail = (issue: PublicationIssue) => {
    const text = issue.code === "WhatsApp.Flow.TextTooLong" && issue.limit !== null ? publicationIssueText(issue, value) : null;
    if (!text) return issue.message;
    return t(text.part === "help" ? "publication.helpTooLong" : text.part === "option" ? "publication.optionTooLong" : "publication.textTooLong", { limit: issue.limit, length: text.length, option: choiceName(issue) });
  };
  const missingTextName = (issue: PublicationIssue) => {
    const name = questionName(issue.fieldId);
    if (!name) return t(issue.path.startsWith("name") ? "name" : "submitLabel");
    const option = choiceName(issue);
    return option ? t("publication.missingChoice", { name, option }) : t(issue.path.includes(".help") ? "publication.missingHelp" : "publication.missingQuestion", { name });
  };
  // Up to three missing texts by name, and the rest counted.
  const missingList = (missing: readonly PublicationIssue[]) => t("publication.missingList", { count: missing.length,
    list: list.format([...missing.slice(0, 3).map(missingTextName), ...missing.length > 3 ? [t("publication.moreMissing", { count: missing.length - 3 })] : []]) });
  const publishedCultures = [...new Set(result?.channels.flatMap(channel => channel.cultures) ?? [])];
  const untranslated = result?.cultures.filter(culture => !culture.isOriginal && !culture.isComplete) ?? [];
  const removedCultures = result?.diff.baseVersionId ? result.diff.removedCultures : [];
  const addedCultures = result?.diff.baseVersionId ? result.diff.addedCultures : [];
  const missingIn = (culture: string) => untranslated.find(item => item.culture === culture)?.missing ?? [];
  // A translation is edited with the menu in its language: elsewhere only what is missing is listed.
  const complete = (culture: string) => {
    const first = missingIn(culture)[0];
    return first && culture === scope.culture && scope.permissions.includes("formtemplates.manage") ? <Button type="button" variant="link" size="inline" onClick={() => { locatingIssue.current = true; onCompleteTranslation(first); }}>{t("publication.completeCulture", { language: t("cultureNamesInText." + culture) })}</Button> : null;
  };
  const goTo = (issue: PublicationIssue) => issue.fieldId || issue.path.startsWith("name.") || issue.path.startsWith("draft.submitLabel.")
    ? <Button type="button" size="sm" variant="outline" onClick={() => { locatingIssue.current = true; onGoToIssue(issue); }}>{t(issue.fieldId ? "publication.goToQuestion" : "publication.goToText")}</Button> : null;
  const warningDetails = (warning: PublicationWarning) => {
    switch (warning.code) {
      case "Forms.Publication.OptionsPerRecipientHigh":
        if (warning.maximum === 0) return t("catalogQuestion.maximum.none");
        return t(warning.maximumLabel ? "publication.recipientMaximumForGroup" : "publication.recipientMaximum", { count: warning.maximum, limit: warning.limit, group: warning.maximumLabel });
      case "Forms.Publication.RecipientsWithoutData":
        return t("publication.recipientsMissingData", { count: warning.count });
      case "Forms.Publication.DependsOnAnswer": {
        // CW7: the list and the answers it depends on, by the names of the editor.
        const question = questionOf(warning.fieldId);
        const answers = (question?.source?.match ?? []).flatMap(match => "questionId" in match && match.questionId ? [questionName(match.questionId)] : []);
        return t("publication.dependsOnAnswer", { form: localizedValue(value.name, scope.culture, value.draft.culture), question: questionName(warning.fieldId),
          answers: list.format(answers.map(name => "«" + (name ?? "") + "»")) });
      }
    }
  };
  const currentNames = (ids: readonly string[]) => value.draft.fields.filter(q => q.fieldId && ids.includes(q.fieldId)).map(q => localizedValue(q.label, scope.culture, value.draft.culture)).join(", ");
  const summaryRows = (diff: FormPublicationCheck["diff"] | null) => <>
    {reactivation?.nextRecordNumber ? <SummaryRow label={t("publication.nextRecordRow")}>{reactivation.nextRecordNumber}</SummaryRow> : null}
    {savedAt ? <SummaryRow label={t("publication.draftRow")}>{t("publication.savedAtValue", { date: savedAt })}</SummaryRow> : null}
    <SummaryRow label={t("publication.questionsRow")}>{value.draft.fields.length}</SummaryRow>
    {/* The changes are against the published version, without naming it: a newer one is never labeled with a stale number. */}
    {diff?.baseVersionId && diff.added.length ? <SummaryRow label={t("publication.addedRow")}>{currentNames(diff.added)}</SummaryRow> : null}
    {diff?.baseVersionId && diff.changed.length ? <SummaryRow label={t("publication.changedRow")}>{currentNames(diff.changed)}</SummaryRow> : null}
    {diff?.baseVersionId && diff.removed.length ? <SummaryRow label={t("publication.removedRow")}>{t("publication.questions", { count: diff.removed.length })}</SummaryRow> : null}
  </>;
  const skeleton = (width: string) => <Skeleton className={cn("h-3", width)} />;
  const content = dirty ? null
    : checking ? <Surface title={t("publication.summary")} headingLevel={3}>
      <div role="status" aria-label={t("publication.checking")}>
        <dl aria-hidden="true" className={rows}>
          {savedAt ? <SummaryRow label={t("publication.draftRow")}>{skeleton("w-40")}</SummaryRow> : null}
          <SummaryRow label={t("publication.questionsRow")}>{skeleton("w-8")}</SummaryRow>
          {!monolingual ? <SummaryRow label={t("publication.languagesRow")}>{skeleton("w-52")}</SummaryRow> : null}
          {!prefixLocked ? <SummaryRow label={t("publication.prefixRow")}>{skeleton("w-36")}</SummaryRow> : null}
        </dl>
      </div>
    </Surface>
    : check.error ? <EmptyState title={t(check.error instanceof ApiError && check.error.status === 403 ? "publication.noPermission" : "publication.pending")} action={check.error instanceof ApiError && check.error.status === 403 ? undefined : <DisabledReason reason={waitReason}><Button type="button" variant="outline" disabled={cooldown.isRunning} onClick={() => void check.check(id, body)}>{t("common:actions.retry")}</Button></DisabledReason>} />
    : result ? <div className="flex flex-col gap-4">
      {result.issues.length ? <Surface title={t("publication.problems")} headingLevel={3} help={t("publication.problemsHelp")}>
        <ul className={rows}>{result.issues.map((issue, index) => <Finding key={issue.path + ":" + index} tone="danger" title={issueName(issue)} action={goTo(issue)}><p className={muted}>{issueDetail(issue)}</p></Finding>)}</ul>
      </Surface> : null}
      {result.warnings.length || removedCultures.length ? <Surface title={t("publication.warnings")} headingLevel={3} help={t("publication.warningsHelp")}>
        <ul className={rows}>
          {/* A language that stops being published carries what it is missing, and completing it, like the one not published. */}
          {removedCultures.map(culture => {
            const missing = missingIn(culture), language = t("cultureNamesInText." + culture);
            return <Finding key={culture} tone="warning" title={t("cultures." + culture)} action={complete(culture)}>
              <WithHelp label={t("publication.removedHelpLabel", { language })}
                help={t("publication.cultureRemovedHint", { version: result.nextVersionNumber, language, original: t("cultureNamesInText." + value.draft.culture) }) + (missing.length ? " " + missingList(missing) : "")}>{t("publication.cultureRemoved")}</WithHelp>
            </Finding>;
          })}
          {result.warnings.map((warning, index) => <Finding key={warning.path + ":" + index} tone="warning" title={questionName(warning.fieldId)}>
            <WithHelp label={t("publication.warningHelpLabel")} help={warning.message}>{warningDetails(warning)}</WithHelp>
            {warning.code === "Forms.Publication.RecipientsWithoutData" && warning.people.length ? <p>{warning.people.join(", ")}</p> : null}
          </Finding>)}
        </ul>
      </Surface> : null}
      <Surface title={t("publication.summary")} headingLevel={3}>
        <dl className={rows}>
          {summaryRows(result.diff)}
          {publishedCultures.length && !monolingual ? <SummaryRow label={t("publication.languagesRow")}>
            <span>{list.format(publishedCultures.map((culture, index) => t((index ? "cultureNamesInText." : "cultures.") + culture)))}</span>
            {publishedCultures.length > 1 ? <InfoTip label={t("publication.languagesHelpLabel")} text={t("publication.severalLanguagesHint")} /> : null}
            {addedCultures.map(culture => <span key={culture} className={muted}>{t("publication.cultureAdded", { language: t("cultureNamesInText." + culture) })}</span>)}
            {untranslated.filter(item => !removedCultures.includes(item.culture)).map(({ culture, missing }) => {
              const language = t("cultureNamesInText." + culture);
              return <span key={culture} className="flex flex-wrap items-center gap-x-1">
                <span className={muted}>{t("publication.withoutCulture", { language, count: missing.length })}</span>
                <InfoTip label={t("publication.missingHelpLabel", { language })} text={missingList(missing)} />
                {complete(culture)}
              </span>;
            })}
          </SummaryRow> : null}
          {!prefixLocked ? <SummaryRow label={t("publication.prefixRow")}>
            <span>{value.prefix}</span>
            <span className={cn("flex items-center gap-x-1", muted)}><span>{t("publication.prefixFixed")}</span><InfoTip label={t("publication.prefixHelpLabel")} text={t("publication.fixedPrefix", { prefix: value.prefix })} /></span>
          </SummaryRow> : null}
        </dl>
      </Surface>
    </div> : null;
  // Why Publish is off is its reason: a problem, the expired check, a publication in progress or a channel not available.
  const publishReason = !result || accepting ? null : expired ? t("publication.expired") : result.issues.length ? t("publication.fixFirst", { count: result.issues.length })
    : result.acceptanceAvailability === "InProgress" ? t("publication.inProgress") : !result.canAccept ? t("publication.unavailable") : null;
  // No description: with unsaved changes the title says it all.
  return <Dialog open onOpenChange={onOpenChange}><DialogContent mobileFullscreen={!!reactivation} className={reactivation ? "flex flex-col sm:max-w-2xl" : "sm:max-w-2xl"} onCloseAutoFocus={onCloseAutoFocus} aria-describedby={undefined}>
    <DialogHeader><DialogTitle className="pr-6">{reactivation && !dirty ? t("lifecycle.reactivateTitle", { name: reactivation.name }) : t(dirty ? "publication.saveFirst" : check.result ? "publication.versionTitle" : "publication.title", { version: check.result?.nextVersionNumber })}</DialogTitle></DialogHeader>
    {reactivation ? <div className="min-h-0 flex-1 overflow-y-auto">{content}</div> : content}
    <DialogFooter className={reactivation ? "shrink-0" : undefined}>
      <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>
      {dirty ? canSave ? <Button type="button" onClick={onSave}>{t("save")}</Button> : null
        : checking ? <Button type="button" pending>{t("publication.checking")}</Button>
        : <>
          {expired ? <DisabledReason reason={check.busy ? null : waitReason} className="max-sm:*:flex-1"><Button type="button" variant="outline" disabled={check.busy || cooldown.isRunning} onClick={() => void runCheck(id, body)}>{t("publication.checkAgain")}</Button></DisabledReason> : null}
          <DisabledReason reason={publishReason} className="max-sm:*:flex-1"><Button type="button" disabled={accepting || !check.result?.canAccept || expired} onClick={() => { const clickedAt = Date.now(); if (check.result?.checkExpiresAtUtc && Date.parse(check.result.checkExpiresAtUtc) <= clickedAt) { setNow(clickedAt); return; } if (check.result && !expired) onAccept(body, check.result); }}>{t(reactivation ? "lifecycle.reactivateVersion" : check.result ? "publication.publishVersion" : "publication.publish", { version: check.result?.nextVersionNumber })}</Button></DisabledReason>
        </>}
    </DialogFooter>
  </DialogContent></Dialog>;
}
