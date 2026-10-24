import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { Banner } from "@/shared/ui/Banner";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/dialog";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { Surface } from "@/shared/ui/Surface";
import { AlertTriangleIcon, CheckIcon, InfoIcon } from "@/shared/ui/icons";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { localizedValue } from "../editorModel";
import { useFormPublicationCheck } from "../hooks/useFormPublicationCheck";
import type { FormReadScope } from "../hooks/useFormQueries";
import type { DraftEditorValue } from "../model";
import type { FormPublicationCheck } from "../api/response";

type PublicationIssue = FormPublicationCheck["issues"][number];
type PublicationWarning = FormPublicationCheck["warnings"][number];
export function PublicationCheckDialog({ scope, id, revision, value, dirty, canSave, onAccept, accepting, onOpenChange, onSave, onConflict, onGoToIssue, savedAt, prefixLocked, baseVersionId, baseVersionNumber, reactivation, onCloseAutoFocus: restoreExternalFocus }: {
  reactivation?: { name: string; nextRecordNumber: string | null };
  onCloseAutoFocus?: (event: Event) => void;
  scope: FormReadScope; id: string; revision: number; value: DraftEditorValue; dirty: boolean; canSave: boolean; savedAt?: string; prefixLocked: boolean; baseVersionId?: string; baseVersionNumber?: number;
  onAccept: (body: DraftEditorValue & { expectedRevision: number }, checked: FormPublicationCheck) => void; accepting: boolean;
  onOpenChange: (open: boolean) => void; onSave: () => void; onConflict: (error: unknown) => void; onGoToIssue: (issue: PublicationIssue) => void;
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
  const issueName = (issue: PublicationIssue) => {
    const question = value.draft.fields.find(q => q.fieldId === issue.fieldId);
    const name = question ? localizedValue(question.label, scope.culture, value.draft.culture)
      : issue.path.startsWith("name") ? t("name") : issue.path.startsWith("draft.submitLabel") ? t("submitLabel") : issue.channelId || issue.path === "channel" ? t("publication.channelIssue") : t("publication.formIssue");
    return issue.culture ? t("localizedChange", { name, language: t("cultures." + issue.culture) }) : name;
  };
  const publishedCultures = [...new Set(check.result?.channels.flatMap(channel => channel.cultures) ?? [])];
  const languages = publishedCultures.map(culture => t("cultureNamesInText." + culture)).join(t("publication.languageJoin"));
  const untranslated = check.result?.cultures.filter(culture => !culture.isOriginal && !culture.isComplete) ?? [];
  const removedCultures = check.result?.diff.baseVersionId ? check.result.diff.removedCultures : [];
  const reportedCultures = [...new Set([...untranslated.map(item => item.culture), ...removedCultures])];
  const canComplete = scope.permissions.includes("formtemplates.manage");
  const missingTextName = (issue: PublicationIssue) => {
    const question = value.draft.fields.find(field => field.fieldId === issue.fieldId);
    if (!question) return t(issue.path.startsWith("name") ? "name" : "submitLabel");
    const name = localizedValue(question.label, scope.culture, value.draft.culture);
    const option = (question.type === "choice" || question.type === "multiChoice") && !question.source ? question.options.find(choice => choice.choiceId === issue.choiceId) : undefined;
    return option ? t("publication.missingChoice", { name, option: localizedValue(option.label, scope.culture, value.draft.culture) })
      : t(issue.path.includes(".help") ? "publication.missingHelp" : "publication.missingQuestion", { name });
  };
  const warningDetails = (warning: PublicationWarning) => {
    switch (warning.code) {
      case "Forms.Publication.OptionsPerRecipientHigh":
        return <p className="text-[var(--color-content-muted)]">{t(warning.maximumLabel ? "publication.recipientMaximumForGroup" : "publication.recipientMaximum", { count: warning.maximum, limit: warning.limit, group: warning.maximumLabel })}</p>;
      case "Forms.Publication.RecipientsWithoutData":
        return <><p className="text-[var(--color-content-muted)]">{t("publication.recipientsMissingData", { count: warning.count })}</p>{warning.people.length ? <p>{warning.people.join(", ")}</p> : null}</>;
    }
  };
  const currentNames = (ids: readonly string[]) => value.draft.fields.filter(q => q.fieldId && ids.includes(q.fieldId)).map(q => localizedValue(q.label, scope.culture, value.draft.culture)).join(", ");
  const content = <>{dirty ? <p className="text-sm">{t("publication.savedOnly")}</p> : check.busy || !check.result && !check.error ? <div role="status" className="flex items-center gap-2"><Spinner /><p className="text-sm">{t("publication.checking")}</p></div>
      : check.error ? <EmptyState title={t(check.error instanceof ApiError && check.error.status === 403 ? "publication.noPermission" : "publication.pending")} action={check.error instanceof ApiError && check.error.status === 403 ? undefined : <Button type="button" variant="outline" disabled={cooldown.isRunning} onClick={() => void check.check(id, body)}>{t("common:actions.retry")}</Button>} />
      : check.result ? <div className="flex flex-col gap-4">
        {reactivation ? <Surface padded><p>{t("lifecycle.numberingContinues")}</p>{reactivation.nextRecordNumber ? <p>{t("lifecycle.nextRecord", { number: reactivation.nextRecordNumber })}</p> : null}<p>{t("lifecycle.reactivateEffect")}</p></Surface> : null}
        <Surface title={t(check.result.diff.baseVersionId ? check.result.diff.baseVersionId === baseVersionId && baseVersionNumber ? "publication.diffTitle" : "publication.diffTitleUnknown" : "publication.includes", { version: baseVersionNumber })} padded>{check.result.diff.baseVersionId ? <><p className="text-sm">{t("publication.diffAdded", { names: currentNames(check.result.diff.added) || "—" })}</p><p className="text-sm">{t("publication.diffChanged", { names: currentNames(check.result.diff.changed) || "—" })}</p><p className="text-sm">{t("publication.diffRemoved", { count: check.result.diff.removed.length })}</p></> : null}<p className="text-sm">{t("publication.questions", { count: value.draft.fields.length })}</p><p className="text-sm text-[var(--color-content-muted)]">{value.draft.fields.map(q => localizedValue(q.label, scope.culture, value.draft.culture)).join(", ")}</p><div className="flex flex-col gap-1">{publishedCultures.length ? <><p className="text-sm font-medium">{t("publication.languages", { languages })}</p><p className="text-sm text-[var(--color-content-muted)]">{t(publishedCultures.length === 1 ? "publication.oneLanguageHint" : "publication.severalLanguagesHint", { language: t("cultureNamesInText." + publishedCultures[0]!) })}</p></> : null}</div></Surface>
        {check.result.diff.baseVersionId ? check.result.diff.addedCultures.map(culture => <p key={culture} className="text-sm"><strong>{t("publication.cultureAdded", { language: t("cultureNamesInText." + culture) })}</strong> {t("publication.cultureAddedHint", { language: t("cultureNamesInText." + culture) })}</p>) : null}
        {reportedCultures.map(culture => {
          const removed = removedCultures.includes(culture);
          const missing = untranslated.find(item => item.culture === culture)?.missing ?? [];
          const firstMissing = missing[0];
          const language = t("cultureNamesInText." + culture);
          // A translation is edited with the menu in its language: elsewhere the notice only lists what is missing.
          return <Banner key={culture} tone={removed ? "warning" : "info"} action={canComplete && firstMissing && culture === scope.culture ? <Button type="button" variant="link" size="inline" onClick={() => { locatingIssue.current = true; onGoToIssue(firstMissing); }}>{t("publication.completeCulture", { language })}</Button> : undefined}>
            <span className="flex flex-col gap-2">
              <span><strong>{t(removed ? "publication.cultureRemoved" : "publication.cultureNotPublished", { language })}</strong> {removed ? t("publication.cultureRemovedHint", { version: check.result!.nextVersionNumber, language, original: t("cultureNamesInText." + value.draft.culture) }) : t("publication.optionalMissing", { count: missing.length })}</span>
              {removed && missing.length ? <span>{t("publication.optionalMissing", { count: missing.length })}</span> : null}
              {missing.length ? <span role="list">{missing.slice(0, 3).map(issue => <span role="listitem" className="block" key={[issue.path, issue.fieldId, issue.choiceId].join(":")}>{missingTextName(issue)}</span>)}</span> : null}
              {missing.length > 3 ? <span>{t("publication.moreMissing", { count: missing.length - 3 })}</span> : null}
            </span>
          </Banner>;
        })}

        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("publication.blockingIssues")}</h3>
          {check.result.issues.length ? <ul className="flex flex-col gap-3">{check.result.issues.map((issue, index) => <li key={issue.path + ":" + index}><Surface padded><p className="text-sm font-medium">{issueName(issue)}</p><p className="text-sm">{issue.message}</p>{issue.fieldId || issue.path.startsWith("name.") || issue.path.startsWith("draft.submitLabel.") ? <div><Button type="button" size="sm" variant="outline" onClick={() => { locatingIssue.current = true; onGoToIssue(issue); }}>{t(issue.fieldId ? "publication.goToQuestion" : "publication.goToText")}</Button></div> : null}</Surface></li>)}</ul>
          : <p className="flex items-center gap-2 text-sm text-[var(--color-success-700)]"><CheckIcon aria-hidden="true" className="size-4 shrink-0" />{t("publication.noDiagnostics")}</p>}
        </div>
        <div className="flex flex-col gap-3">
          <h3 className="text-sm font-medium">{t("publication.nonBlockingWarnings")}</h3>
          {check.result.warnings.length ? <ul className="flex flex-col gap-3">{check.result.warnings.map((warning, index) => {
            const question = value.draft.fields.find(field => field.fieldId === warning.fieldId);
            const Icon = warning.code === "Forms.Publication.RecipientsWithoutData" ? AlertTriangleIcon : InfoIcon;
            return <li key={warning.path + ":" + index} className="flex items-start gap-2">
              <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[var(--color-warning-700)]" />
              <div className="flex min-w-0 flex-col gap-1 text-sm">
                {question ? <p className="font-medium">{localizedValue(question.label, scope.culture, value.draft.culture)}</p> : null}
                <p>{warning.message}</p>
                {warningDetails(warning)}
              </div>
            </li>;
          })}</ul> : <p className="flex items-center gap-2 text-sm text-[var(--color-success-700)]"><CheckIcon aria-hidden="true" className="size-4 shrink-0" />{t("publication.noDiagnostics")}</p>}
        </div>
        {!check.result.issues.length ? <Surface title={t("publication.fixed")} padded><p className="text-sm">{t("publication.fixedQuestions")}</p>{!prefixLocked ? <p className="text-sm">{t("publication.fixedPrefix", { prefix: value.prefix })}</p> : null}<p className="text-sm text-[var(--color-content-muted)]">{t("publication.acceptedNotPublished")}</p></Surface> : null}
        {expired ? <p role="status" className="text-sm">{t("publication.expired")}</p> : !check.result.canAccept ? <p className="text-sm text-[var(--color-content-muted)]">{t(check.result.acceptanceAvailability === "InProgress" ? "publication.inProgress" : "publication.unavailable")}</p> : <Surface title={t("publication.whatHappens")} padded><ol className="list-decimal space-y-1 pl-5 text-sm"><li>{t("publication.willAccept")}</li><li>{publishedCultures.length ? t("publication.willSendCultures", { languages }) : t("publication.willSend")}</li><li>{t("publication.willActivate")}</li></ol></Surface>}
      </div> : null}
    {cooldown.isRunning ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait", { count: cooldown.seconds })}</p> : null}
  </>;
  return <Dialog open onOpenChange={onOpenChange}><DialogContent mobileFullscreen={!!reactivation} className={reactivation ? "flex flex-col sm:max-w-2xl" : "sm:max-w-2xl"} onCloseAutoFocus={onCloseAutoFocus}>
    <DialogHeader><DialogTitle className="pr-6">{reactivation && !dirty ? t("lifecycle.reactivateTitle", { name: reactivation.name }) : t(dirty ? "publication.saveFirst" : check.result ? "publication.versionTitle" : "publication.title", { version: check.result?.nextVersionNumber })}</DialogTitle><DialogDescription>{t(dirty ? "publication.unsaved" : reactivation ? "lifecycle.reactivateDescription" : "publication.description")}</DialogDescription></DialogHeader>
    {reactivation ? <div className="min-h-0 flex-1 overflow-y-auto">{content}</div> : content}
    <DialogFooter className={reactivation ? "shrink-0" : undefined}>{savedAt && !dirty ? <p className="mr-auto text-xs text-[var(--color-content-muted)]">{t("publication.savedAt", { date: savedAt })}</p> : null}<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>{dirty ? canSave ? <Button type="button" onClick={onSave}>{t("save")}</Button> : null : <><Button type="button" disabled={accepting || !check.result?.canAccept || expired} onClick={() => { const clickedAt = Date.now(); if (check.result?.checkExpiresAtUtc && Date.parse(check.result.checkExpiresAtUtc) <= clickedAt) { setNow(clickedAt); return; } if (check.result && !expired) onAccept(body, check.result); }}>{t(reactivation ? "lifecycle.reactivateVersion" : check.result ? "publication.publishVersion" : "publication.publish", { version: check.result?.nextVersionNumber })}</Button>{expired ? <Button type="button" variant="outline" disabled={check.busy || cooldown.isRunning} onClick={() => void runCheck(id, body)}>{t("publication.checkAgain")}</Button> : null}</>}</DialogFooter>
  </DialogContent></Dialog>;
}
