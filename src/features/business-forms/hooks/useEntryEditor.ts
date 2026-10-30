import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import type { FormEntry, FormEntrySubmitted } from "../api/entries";
import { carryEntryDraft, entryQuestionId, initialEntryDraft, validateEntry, type EntryDraft, type EntryProblem } from "../entryForm";
import { useFormEntrySubmit } from "./useFormEntry";

export type EntryConflict = "version" | "deactivated" | "forbidden" | "missing";

/**
 * The owner of one response being loaded (page or panel): its draft, the problems shown after the first try and then
 * live, the server's per-question errors and the conflicts that stop the send. Nothing leaves this owner.
 */
export function useEntryEditor(formId: string, entry: FormEntry | undefined, owner: string, initial?: EntryDraft) {
  const { t } = useTranslation("formEntries");
  const [state, setState] = useState<{ entry: FormEntry; draft: EntryDraft } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<EntryConflict | null>(null);
  const [reveal, setReveal] = useState(0);
  const { submit, progress, sending } = useFormEntrySubmit(formId);
  // A new reading of the entry (another version after «Pasar a la versión nueva») keeps the answers that still apply.
  if (entry && state?.entry !== entry) {
    setState({ entry, draft: state ? carryEntryDraft(state.entry, state.draft, entry) : initial ?? initialEntryDraft(entry) });
    if (state) { setConflict(null); setServerErrors({}); }
  }
  const draft = state && state.entry === entry ? state.draft : null;
  const problems = entry && draft ? validateEntry(entry, draft) : {};
  const problemMessage = useCallback((problem: EntryProblem, fieldId: string): string => {
    const question = entry?.questions.find(item => item.fieldId === fieldId);
    const count = problem === "chooseAtLeast" ? question?.selection?.minSelected : problem === "chooseAtMost" ? question?.selection?.maxSelected
      : problem === "maxLength" ? question?.maxLength : problem === "filesAtLeast" ? question?.files?.minFiles : problem === "filesAtMost" ? question?.files?.maxFiles : undefined;
    return t("problems." + problem, { count: count ?? 0 });
  }, [entry, t]);
  const errors: Record<string, string> = {};
  if (attempted) for (const [fieldId, problem] of Object.entries(problems)) errors[fieldId] = problemMessage(problem, fieldId);
  Object.assign(errors, serverErrors);
  const missing = entry?.questions.find(question => question.catalog?.issue === "Forms.Record.RecipientDataMissing");
  const dirty = !!draft && (Object.values(draft.values).some(value => value !== "") || Object.values(draft.files).some(files => files.length > 0)
    || Object.entries(draft.choices).some(([fieldId, chosen]) => chosen.length > 0 && entry?.questions.find(question => question.fieldId === fieldId)?.catalog?.onlyOption?.id !== chosen[0]?.id));

  const change = (next: EntryDraft) => {
    if (!entry) return;
    // A changed answer is a new send: the server's error on that question no longer applies.
    setServerErrors(current => Object.fromEntries(Object.entries(current).filter(([fieldId]) =>
      JSON.stringify(next.values[fieldId]) === JSON.stringify(draft?.values[fieldId]) && next.choices[fieldId] === draft?.choices[fieldId] && next.files[fieldId] === draft?.files[fieldId])));
    setState({ entry, draft: next });
  };
  const focus = (fieldId: string) => window.requestAnimationFrame(() => {
    const container = document.querySelector<HTMLElement>(`[data-entry-question="${fieldId}"]`);
    const target = document.getElementById(entryQuestionId(fieldId)) ?? container?.querySelector<HTMLElement>("input,textarea,button,[role=radio]");
    target?.focus();
  });

  /** Sends when nothing is missing; otherwise marks every problem and focuses the first one. */
  const send = async (): Promise<FormEntrySubmitted | null> => {
    if (!entry || !draft || sending || conflict) return null;
    setAttempted(true);
    const first = entry.questions.find(question => problems[question.fieldId]);
    if (first) { setReveal(value => value + 1); focus(first.fieldId); return null; }
    try {
      const result = await submit(entry, draft);
      setServerErrors({});
      return result;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      if (error.code === "Forms.Entry.VersionChanged") setConflict("version");
      else if (error.code === "Forms.Entry.Unavailable") setConflict("deactivated");
      else if (error.status === 403) setConflict("forbidden");
      else if (error.status === 404) setConflict("missing");
      else if (error.status === 400 && error.errors) {
        const fields: Record<string, string> = {};
        for (const [path, messages] of Object.entries(error.errors)) {
          if (!path.startsWith("answers.")) continue;
          const fieldId = path.slice("answers.".length);
          const chosen = draft.choices[fieldId]?.[0];
          fields[fieldId] = error.code === "Forms.Record.CatalogItemInactive" && chosen ? t("catalog.unavailable", { title: chosen.title }) : messages[0] ?? "";
        }
        setServerErrors(fields);
        setReveal(value => value + 1);
        const question = entry.questions.find(item => fields[item.fieldId]);
        if (question) {
          notify({ id: `entries:send:${owner}:${formId}`, kind: "error", message: t("send.notSaved"), description: t("send.review", { label: question.label }) });
          focus(question.fieldId);
        } else notify({ id: `entries:send:${owner}:${formId}`, kind: "error", message: t("send.notSaved"), description: error.detail ?? undefined });
      } else {
        const feedback = errorFeedback(error);
        notify({ id: `entries:send:${owner}:${formId}`, kind: "error", message: t("send.failed"),
          description: feedback.network || error.status >= 500 || error.status === 429 ? t("send.failedHint", { submit: entry.submitLabel }) : error.detail ?? undefined });
      }
      return null;
    }
  };
  /** «Cargar otra» or, in the panel, the next response: everything starts again from the given draft. */
  const restart = (next?: EntryDraft) => {
    if (!entry) return;
    setState({ entry, draft: next ?? initialEntryDraft(entry) });
    setAttempted(false); setServerErrors({}); setConflict(null);
  };
  return { draft, change, errors, send, restart, progress, sending, conflict, missing, dirty, reveal, blocked: !!missing || !!conflict };
}
