import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { formatDateOnly } from "@/shared/lib/dateTime";
import { correctionBefore, correctionDraft } from "../entryForm";
import { useEntryEditor } from "./useEntryEditor";
import { useEntryCorrection, useFormEntryCorrectionSubmit } from "./useFormEntry";

const maxReason = 500;
/** Whether the correction could not be opened because the response is no longer this person's to change. */
export function correctionUnavailable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 403 || error.status === 404 || error.code === "Forms.Record.AmendUnavailable");
}
/** The id of the reason's control, so a send without it takes the focus there. */
export const correctionReasonId = (recordId: string) => "correction-reason-" + recordId;

/**
 * The owner of one correction (CW10-A), in the panel or on its page: the response as it was in the active version, what
 * changed («Antes: …»), the required reason and the send. It is dirty only once something differs from the response.
 */
export function useEntryCorrectionEditor(formId: string, recordId: string) {
  const { t, i18n } = useTranslation("formEntries");
  const { scope, query } = useEntryCorrection(formId, recordId);
  const correction = query.data;
  const initial = useMemo(() => correction ? correctionDraft(correction, i18n.language) : undefined, [correction, i18n.language]);
  const submission = useFormEntryCorrectionSubmit(formId, recordId);
  const [reason, setReason] = useState("");
  const [reasonAttempted, setReasonAttempted] = useState(false);
  // The send happens in this render's handler: it carries the reason in sight.
  const editor = useEntryEditor(formId, correction?.entry, scope.owner, initial, {
    correcting: true,
    submission: { submit: (entry, draft) => submission.submit(entry, draft, reason), progress: submission.progress, sending: submission.sending },
  });
  const trimmed = reason.trim();
  const reasonProblem = !trimmed ? t("correction.reasonRequired") : trimmed.length > maxReason ? t("correction.reasonTooLong") : null;
  const before = correction && initial && editor.draft ? correctionBefore(correction.entry, initial, editor.draft,
    { yes: t("sent.yes"), no: t("sent.no"), date: iso => formatDateOnly(iso, i18n.language, "numeric") ?? iso }) : {};
  /** Sends when the reason is there and nothing else is missing; otherwise marks and focuses the first problem. */
  const send = async () => {
    setReasonAttempted(true);
    if (reasonProblem) { window.requestAnimationFrame(() => document.getElementById(correctionReasonId(recordId))?.focus()); return null; }
    return editor.send();
  };
  return {
    scope, query, correction, editor, before, send, reason, setReason,
    reasonError: reasonAttempted ? reasonProblem : null,
    dirty: editor.dirty || trimmed !== "",
  };
}
