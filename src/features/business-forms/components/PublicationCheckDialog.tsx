import { useEffect, useState } from "react";
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
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { localizedValue } from "../editorModel";
import { useFormPublicationCheck } from "../hooks/useFormPublicationCheck";
import type { FormReadScope } from "../hooks/useFormQueries";
import type { DraftEditorValue } from "../model";
import type { FormPublicationCheck } from "../api/response";

type PublicationIssue = FormPublicationCheck["issues"][number];
export function PublicationCheckDialog({ scope, id, revision, value, dirty, canSave, onAccept, accepting, onOpenChange, onSave, onConflict, onGoToIssue, savedAt, prefixLocked, baseVersionNumber }: {
  scope: FormReadScope; id: string; revision: number; value: DraftEditorValue; dirty: boolean; canSave: boolean; savedAt?: string; prefixLocked: boolean; baseVersionNumber?: number;
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
  const translationCounts = (["es", "en"] as const).map(culture => ({ culture, count: new Set(check.result?.issues.filter(issue => issue.culture === culture && issue.code.endsWith("MissingTranslation")).map(issue => [issue.fieldId, issue.choiceId, issue.path].join(":"))).size }));
  const currentNames = (ids: readonly string[]) => value.draft.fields.filter(q => q.fieldId && ids.includes(q.fieldId)).map(q => localizedValue(q.label, scope.culture, value.draft.culture)).join(", ");
  return <Dialog open onOpenChange={onOpenChange}><DialogContent className="sm:max-w-2xl" onCloseAutoFocus={restoreFocus}>
    <DialogHeader><DialogTitle>{t(dirty ? "publication.saveFirst" : check.result ? "publication.versionTitle" : "publication.title", { version: check.result?.nextVersionNumber })}</DialogTitle><DialogDescription>{t(dirty ? "publication.unsaved" : "publication.description")}</DialogDescription></DialogHeader>
    {dirty ? <p className="text-sm">{t("publication.savedOnly")}</p> : check.busy || !check.result && !check.error ? <div role="status" className="flex items-center gap-2"><Spinner /><p className="text-sm">{t("publication.checking")}</p></div>
      : check.error ? <EmptyState title={t(check.error instanceof ApiError && check.error.status === 403 ? "publication.noPermission" : "publication.pending")} action={check.error instanceof ApiError && check.error.status === 403 ? undefined : <Button type="button" variant="outline" disabled={cooldown.isRunning} onClick={() => void check.check(id, body)}>{t("common:actions.retry")}</Button>} />
      : check.result ? <div className="flex flex-col gap-4">
        <Surface title={t(check.result.diff.baseVersionId && baseVersionNumber ? "publication.diffTitle" : "publication.includes", { version: baseVersionNumber })} padded>{check.result.diff.baseVersionId ? <><p className="text-sm">{t("publication.diffAdded", { names: currentNames(check.result.diff.added) || "—" })}</p><p className="text-sm">{t("publication.diffChanged", { names: currentNames(check.result.diff.changed) || "—" })}</p><p className="text-sm">{t("publication.diffRemoved", { count: check.result.diff.removed.length })}</p></> : null}<p className="text-sm">{t("publication.questions", { count: value.draft.fields.length })}</p><p className="text-sm text-[var(--color-content-muted)]">{value.draft.fields.map(q => localizedValue(q.label, scope.culture, value.draft.culture)).join(", ")}</p><p className="text-sm">{t("publication.bilingual")}</p></Surface>
        {translationCounts.filter(item => item.count > 0).map(item => <Banner key={item.culture} tone="warning">{t("publication.missingTexts", { count: item.count, language: t("cultureNamesInText." + item.culture) })}</Banner>)}
        {check.result.issues.length ? <ul className="flex flex-col gap-3">{check.result.issues.map((issue, index) => <li key={issue.path + ":" + index}><Surface padded><p className="text-sm font-medium">{issueName(issue)}</p><p className="text-sm">{issue.message}</p>{issue.fieldId || issue.path.startsWith("name.") || issue.path.startsWith("draft.submitLabel.") ? <div><Button type="button" size="sm" variant="outline" onClick={() => onGoToIssue(issue)}>{t(issue.fieldId ? "publication.goToQuestion" : "publication.goToText")}</Button></div> : null}</Surface></li>)}</ul>
          : <Surface title={t("publication.fixed")} padded><p className="text-sm">{t("publication.fixedQuestions")}</p>{!prefixLocked ? <p className="text-sm">{t("publication.fixedPrefix", { prefix: value.prefix })}</p> : null}<p className="text-sm text-[var(--color-content-muted)]">{t("publication.acceptedNotPublished")}</p></Surface>}
        {expired ? <p role="status" className="text-sm">{t("publication.expired")}</p> : !check.result.canAccept ? <p className="text-sm text-[var(--color-content-muted)]">{t(check.result.acceptanceAvailability === "InProgress" ? "publication.inProgress" : "publication.unavailable")}</p> : <Surface title={t("publication.whatHappens")} padded><ol className="list-decimal space-y-1 pl-5 text-sm"><li>{t("publication.willAccept")}</li><li>{t("publication.willSend")}</li><li>{t("publication.willActivate")}</li></ol></Surface>}
      </div> : null}
    {cooldown.isRunning ? <p role="status" className="text-sm text-[var(--color-content-muted)]">{t("wait", { count: cooldown.seconds })}</p> : null}
    <DialogFooter>{savedAt && !dirty ? <p className="mr-auto text-xs text-[var(--color-content-muted)]">{t("publication.savedAt", { date: savedAt })}</p> : null}<Button type="button" variant="outline" onClick={() => onOpenChange(false)}>{t("common:actions.cancel")}</Button>{dirty ? canSave ? <Button type="button" onClick={onSave}>{t("save")}</Button> : null : <><Button type="button" disabled={accepting || !check.result?.canAccept || expired} onClick={() => { const clickedAt = Date.now(); if (check.result?.checkExpiresAtUtc && Date.parse(check.result.checkExpiresAtUtc) <= clickedAt) { setNow(clickedAt); return; } if (check.result && !expired) onAccept(body, check.result); }}>{t(check.result ? "publication.publishVersion" : "publication.publish", { version: check.result?.nextVersionNumber })}</Button>{expired ? <Button type="button" variant="outline" disabled={check.busy || cooldown.isRunning} onClick={() => void runCheck(id, body)}>{t("publication.checkAgain")}</Button> : null}</>}</DialogFooter>
  </DialogContent></Dialog>;
}
