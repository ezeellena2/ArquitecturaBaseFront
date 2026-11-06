import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import type { FormPublicationProjection } from "../api/response";
import { uniquePublicationIssues } from "../publicationPresentation";
import type { useFormPublication } from "./useFormPublication";

type Publication = ReturnType<typeof useFormPublication>;
export type PublicationProgressState = ReturnType<typeof usePublicationProgress>;

// EP1-A (2026-11-06): the state of a publication is the label of the editor's header, and nothing under it repeats it. This hook
// owns what is left around that label: the result notices, the wait of a 429 (or the pause after an unconfirmed 404), why
// «Publicar en WhatsApp» is off, and whether consulting is the way forward: an unconfirmed acceptance, a publication that needs
// review or a failed consultation, when the automatic one stops.
export function usePublicationProgress(publication: Publication, feedbackId: string, projection?: FormPublicationProjection) {
  const { t, i18n } = useTranslation("forms");
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const state = publication.status?.state ?? publication.receipt?.state ?? publication.aggregate?.state ?? projection?.currentOperation?.state ?? (projection?.activeVersion ? "Published" : undefined);
  const version = publication.status?.versionNumber ?? publication.receipt?.versionNumber ?? publication.aggregate?.versionNumber ?? projection?.currentOperation?.versionNumber ?? projection?.activeVersion?.versionNumber;
  const announced = useRef(new Set<string>());
  // NI1-A and NI2-C (2026-11-03): a language is named only when it is not the menu's, also among the published ones.
  const menu = i18n.language.startsWith("en") ? "en" : "es";
  useEffect(() => () => dismissNotification(feedbackId), [feedbackId]);
  // The result of a publication started here is a notice, once: published, with its languages when one is not the menu's, or not.
  useEffect(() => {
    const status = publication.status;
    if (!status || !["Published", "Failed"].includes(status.state) || !publication.startedHere) return;
    const key = status.operationId + ":" + status.state;
    if (announced.current.has(key)) return;
    announced.current.add(key);
    if (status.state === "Failed") { notify({ id: feedbackId + ":failed:" + status.operationId, kind: "error", message: t("publication.failedVersion", { version: status.versionNumber }) }); return; }
    const languages = status.cultures.map(culture => t("cultureNamesInText." + culture)).join(t("publication.languageJoin"));
    notify({ id: feedbackId + ":published:" + status.operationId, kind: "success",
      message: t(status.cultures.some(culture => culture !== menu) ? "publication.publishedLanguages" : "publication.publishedVersion", { version: status.versionNumber, languages }) });
  }, [publication.status, publication.startedHere, feedbackId, menu, t]);
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
  const forbidden = publication.error instanceof ApiError && publication.error.status === 403;
  const requiresReview = publication.status?.requiresReview ?? publication.aggregate?.requiresReview ?? projection?.currentOperation?.requiresReview ?? false;
  const unconfirmed = publication.phase === "Unconfirmed";
  const needsConsulting = !forbidden && (unconfirmed || publication.phase === "Accepted" && (state === "Uncertain" || !!publication.error));
  // Consulting clears the error that asked for it: the button stays in sight, with its ring, until the answer arrives. Repeating the
  // same attempt is not consulting: while it is accepted again, the button goes.
  const [consultShown, setConsultShown] = useState(false);
  const canConsult = needsConsulting || consultShown && publication.busy && publication.phase !== "Accepting";
  if (canConsult !== consultShown) setConsultShown(canConsult);
  // A finished publication confirmed on opening (its state known, its answer still coming) keeps Publish off without a reason.
  const confirming = publication.phase === "Accepted" && !publication.status && (state === "Published" || state === "Failed");
  // Why «Publicar en WhatsApp» is off while a publication goes on, as its reason; the editor's own reasons stay silent, as before.
  const publishReason = forbidden ? t("publication.noPermission") : unconfirmed ? t("publication.unconfirmedHint")
    : state === "Uncertain" || requiresReview ? t("publication.reviewHint") : confirming ? null : t("publication.inProgress");
  return {
    state, version, canConsult, publishReason,
    cooling: cooldown.isRunning,
    // The wait of a 429 is the reason of consulting and replaying, never a text under them.
    waitReason: publication.busy || !cooldown.isRunning ? null : t("wait", { count: cooldown.seconds }),
    issues: state === "Failed" ? uniquePublicationIssues(publication.status?.issues ?? []) : [],
  };
}
