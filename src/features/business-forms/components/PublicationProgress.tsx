
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { FormPublicationProjection, FormPublicationCheck } from "../api/response";
import { uniquePublicationIssues } from "../publicationPresentation";
import type { useFormPublication } from "../hooks/useFormPublication";

export function PublicationProgress({ publication, feedbackId, onReplay, projection, onGoToIssue, canLocateIssue }: {
  publication: ReturnType<typeof useFormPublication>; feedbackId: string; onReplay: () => void; projection?: FormPublicationProjection;
  onGoToIssue?: (issue: FormPublicationCheck["issues"][number]) => void; canLocateIssue?: (issue: FormPublicationCheck["issues"][number]) => boolean;
}) {
  const { t } = useTranslation("forms");
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const state = publication.status?.state ?? publication.receipt?.state ?? publication.aggregate?.state ?? projection?.currentOperation?.state ?? (projection?.activeVersion ? "Published" : undefined);
  const issues = uniquePublicationIssues(publication.status?.issues ?? []);
  const version = publication.status?.versionNumber ?? publication.receipt?.versionNumber ?? publication.aggregate?.versionNumber ?? projection?.currentOperation?.versionNumber ?? projection?.activeVersion?.versionNumber;
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);
  useEffect(() => {
    if (publication.error instanceof ApiError && ["Forms.Draft.RevisionConflict", "Forms.Publication.DraftMustBeSaved"].includes(publication.error.code ?? "")) return;
    if (!publication.error) { dismissNotification(feedbackId); return; }
    const feedback = errorFeedback(publication.error, { writing: publication.phase === "Unconfirmed" });
    if (["cancelled", "session", "forbidden"].includes(feedback.kind)) return;
    if (publication.phase === "Unconfirmed" && publication.error instanceof ApiError && publication.error.status === 404) restart(5);
    if (feedback.kind === "wait") restart(Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60)));
    notify({ id: feedbackId, kind: feedback.kind === "wait" ? "warning" : "error",
      message: publication.phase === "Unconfirmed" ? operationalErrorMessage(publication.error, t)
        : feedback.detail ?? t("publication.statusFailed"),
      description: feedback.traceId && publication.phase !== "Unconfirmed" ? t("common:errors.traceId", { traceId: feedback.traceId }) : undefined });
  }, [publication.error, publication.phase, feedbackId, restart, t]);
  if (publication.phase === "Idle" && !state) return null;
  const forbidden = publication.error instanceof ApiError && publication.error.status === 403;
  const title = forbidden ? "publication.noPermission" : publication.phase === "Accepting" ? "publication.accepting"
    : publication.phase === "Unconfirmed" ? "publication.unconfirmed" : publication.phase === "Rejected" ? "publication.rejected"
    : state === "Published" ? "publication.published" : state === "Failed" ? "publication.failed"
    : state === "Uncertain" ? "publication.unconfirmed" : "publication.publishing";
  const hint = publication.phase === "Accepting" ? "publication.acceptingHint"
    : publication.phase === "Unconfirmed" ? "publication.unconfirmedHint" : publication.phase === "Rejected" ? "publication.rejectedHint"
    : state === "Published" ? "publication.publishedHint" : state === "Failed" ? "publication.failedHint"
    : state === "Uncertain" ? "publication.reviewHint" : "publication.progressHint";
  const requiresReview = publication.status?.requiresReview ?? publication.aggregate?.requiresReview ?? projection?.currentOperation?.requiresReview;
  return <Surface title={t(title, { version })} padded>
    <div className="flex flex-col gap-3">
      <p role="status" className="text-sm">{t(hint, { version })}</p>
      {publication.confirmed && state !== "Failed" ? <ol className="flex flex-col gap-1 text-sm">
        <li>{t("publication.stepAccepted")}</li>
        <li className="text-[var(--color-content-muted)]">{t(state === "Preparing" ? "publication.stepPreparing" : state === "Publishing" ? "publication.stepSent" : state === "ActivationPending" ? "publication.stepActivating" : state === "Published" ? "publication.stepReady" : "publication.stepPending")}</li>
      </ol> : null}
      {requiresReview && hint !== "publication.reviewHint" ? <p className="text-sm">{t("publication.reviewHint")}</p> : null}
      {issues.length ? <ul className="flex flex-col gap-2 text-sm">{issues.map((issue,index) => <li key={index}><p>{issue.message}</p>{issue.culture ? <p className="text-xs text-[var(--color-content-muted)]">{t("common:language." + issue.culture)}</p> : null}{onGoToIssue && canLocateIssue?.(issue) ? <Button type="button" size="sm" variant="outline" onClick={() => onGoToIssue(issue)}>{t(issue.fieldId ? "publication.goToQuestion" : "publication.goToText")}</Button> : null}</li>)}</ul> : null}
      {projection?.activeVersion && state !== "Published" ? <p className="text-sm text-[var(--color-content-muted)]">{t("publication.previousActive", { version: projection.activeVersion.versionNumber })}</p> : null}
      {publication.error && publication.confirmed ? <p className="text-sm">{t("publication.statusFailed")}</p> : null}
      {!forbidden && ["Accepted", "Unconfirmed"].includes(publication.phase) ? <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={publication.busy || cooldown.isRunning} onClick={() => void publication.consult()}>{t("publication.consult")}</Button>
        {publication.canReplay ? <Button type="button" variant="outline" disabled={publication.busy || cooldown.isRunning} onClick={onReplay}>{t("publication.replay")}</Button> : null}
      </div> : null}
      {cooldown.isRunning ? <p role="status" className="text-sm">{t("wait", { count: cooldown.seconds })}</p> : null}
    </div>
  </Surface>;
}
