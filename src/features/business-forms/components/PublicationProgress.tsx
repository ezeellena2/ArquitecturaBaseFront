
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { Button } from "@/shared/ui/button";
import { DisabledReason } from "@/shared/ui/DisabledReason";
import { Surface } from "@/shared/ui/Surface";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { FormPublicationProjection, FormPublicationCheck } from "../api/response";
import { uniquePublicationIssues } from "../publicationPresentation";
import type { useFormPublication } from "../hooks/useFormPublication";

export function PublicationProgress({ publication, feedbackId, onReplay, projection, onGoToIssue, canLocateIssue }: {
  publication: ReturnType<typeof useFormPublication>; feedbackId: string; onReplay: () => void; projection?: FormPublicationProjection;
  onGoToIssue?: (issue: FormPublicationCheck["issues"][number]) => void; canLocateIssue?: (issue: FormPublicationCheck["issues"][number]) => boolean;
}) {
  const { t, i18n } = useTranslation("forms");
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const state = publication.status?.state ?? publication.receipt?.state ?? publication.aggregate?.state ?? projection?.currentOperation?.state ?? (projection?.activeVersion ? "Published" : undefined);
  const announced = useRef(new Set<string>());
  const publishedCultures = publication.status?.state === "Published" ? publication.status.cultures : projection?.activeVersion?.cultures ?? [];
  const languages = publishedCultures.map(culture => t("cultureNamesInText." + culture)).join(t("publication.languageJoin"));
  // NI1-A and NI2-C (2026-11-03): a language is named only when it is not the menu's, also among the published ones.
  const menu = i18n.language.startsWith("en") ? "en" : "es";
  const namesLanguages = publishedCultures.some(culture => culture !== menu);
  const issues = uniquePublicationIssues(publication.status?.issues ?? []);
  const version = publication.status?.versionNumber ?? publication.receipt?.versionNumber ?? publication.aggregate?.versionNumber ?? projection?.currentOperation?.versionNumber ?? projection?.activeVersion?.versionNumber;
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);
  useEffect(() => {
    const status = publication.status;
    if (status?.state !== "Published" || !publication.startedHere || announced.current.has(status.operationId)) return;
    announced.current.add(status.operationId);
    notify({ id: feedbackId + ":published:" + status.operationId, kind: "success", message: t(namesLanguages ? "publication.publishedLanguages" : "publication.publishedVersion", { version: status.versionNumber, languages }) });
  }, [publication.status, publication.startedHere, feedbackId, languages, namesLanguages, t]);
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
  // The title and the steps say the state (inventory of legends, 2026-11-01): a paragraph stays only where the state asks
  // to do something (unconfirmed, rejected or in review), or as a datum, the published languages.
  const message = publication.phase === "Accepting" ? null : publication.phase === "Unconfirmed" ? "publication.unconfirmedHint"
    : publication.phase === "Rejected" ? "publication.rejectedHint" : state === "Uncertain" ? "publication.reviewHint" : null;
  const requiresReview = publication.status?.requiresReview ?? publication.aggregate?.requiresReview ?? projection?.currentOperation?.requiresReview;
  // Consulting and replaying act on the whole publication: they go in the header, with the wait of a 429 as their reason.
  // While it consults, also the periodic consultation, the button says so with its ring.
  const waitReason = publication.busy || !cooldown.isRunning ? null : t("wait", { count: cooldown.seconds });
  const actions = !forbidden && ["Accepted", "Unconfirmed"].includes(publication.phase) ? <>
    <DisabledReason reason={waitReason}><Button type="button" variant="outline" pending={publication.busy} disabled={cooldown.isRunning} onClick={() => void publication.consult()}>{t(publication.busy ? "publication.consulting" : "publication.consult")}</Button></DisabledReason>
    {publication.canReplay ? <DisabledReason reason={waitReason}><Button type="button" variant="outline" disabled={publication.busy || cooldown.isRunning} onClick={onReplay}>{t("publication.replay")}</Button></DisabledReason> : null}
  </> : null;
  const steps = publication.confirmed && state !== "Failed" ? <ol className="flex flex-col gap-1 text-sm">
    <li>{t("publication.stepAccepted")}</li>
    <li className="text-[var(--color-content-muted)]">{t(state === "Preparing" ? "publication.stepPreparing" : state === "Publishing" ? "publication.stepSent" : state === "ActivationPending" ? "publication.stepActivating" : state === "Published" ? "publication.stepReady" : "publication.stepPending")}</li>
  </ol> : null;
  return <Surface title={t(title, { version })} padded actions={actions}>
    <div className="flex flex-col gap-3">
      {publication.phase === "Accepting" ? <p role="status" className="sr-only">{t(title, { version })}</p> : null}
      {message ? <p role="status" className="text-sm">{t(message)}</p> : state === "Published" && namesLanguages ? <p className="text-sm">{t("publication.languages", { languages })}</p> : null}
      {/* While it goes on, the current step is what changes: it is announced. */}
      {steps && !message && state !== "Published" ? <div role="status">{steps}</div> : steps}
      {requiresReview && message !== "publication.reviewHint" ? <p className="text-sm">{t("publication.reviewHint")}</p> : null}
      {issues.length ? <ul className="flex flex-col gap-2 text-sm">{issues.map((issue,index) => <li key={index}><p>{issue.message}</p>{issue.culture && issue.culture !== menu ? <p className="text-xs text-[var(--color-content-muted)]">{t("common:language." + issue.culture)}</p> : null}{onGoToIssue && canLocateIssue?.(issue) ? <Button type="button" size="sm" variant="outline" onClick={() => onGoToIssue(issue)}>{t(issue.fieldId ? "publication.goToQuestion" : "publication.goToText")}</Button> : null}</li>)}</ul> : null}
      {projection?.activeVersion && state !== "Published" ? <p className="text-sm text-[var(--color-content-muted)]">{t("publication.previousActive", { version: projection.activeVersion.versionNumber })}</p> : null}
      {publication.error && publication.confirmed ? <p className="text-sm">{t("publication.statusFailed")}</p> : null}
    </div>
  </Surface>;
}
