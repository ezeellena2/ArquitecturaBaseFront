import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import type { FormEntry, FormEntrySubmitted } from "../api/entries";
import {
  carryEntryDraft, entryDraftKey, entryItemsLoaded, entryProblemKeys, entryProblemQuestion, entryQuestionId, initialEntryDraft, validateEntry,
  type EntryDraft, type EntryProblem,
} from "../entryForm";
import { useFormEntrySubmit } from "./useFormEntry";

export type EntryConflict = "version" | "deactivated" | "forbidden" | "missing";

/** How a correction sends (CW10-A), with its own progress; without it the editor sends a new response. */
export interface EntrySubmission { submit: (entry: FormEntry, draft: EntryDraft) => Promise<FormEntrySubmitted>; progress: number | null; sending: boolean }

/**
 * The owner of one response being loaded (page or panel): its draft, the problems shown after the first try and then
 * live, the server's per-question errors and the conflicts that stop the send. Nothing leaves this owner. A correction
 * starts from the response as it was (`initial`) and is dirty only once something differs from it.
 */
export function useEntryEditor(formId: string, entry: FormEntry | undefined, owner: string, initial?: EntryDraft,
  options?: { submission?: EntrySubmission; correcting?: boolean }) {
  const { t } = useTranslation(["formEntries", "common"]);
  const [state, setState] = useState<{ entry: FormEntry; draft: EntryDraft } | null>(null);
  const [attempted, setAttempted] = useState(false);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [conflict, setConflict] = useState<EntryConflict | null>(null);
  const [reveal, setReveal] = useState(0);
  const own = useFormEntrySubmit(formId);
  const { submit, progress, sending } = options?.submission ?? own;
  // A new reading of the entry (another version after «Pasar a la versión nueva») keeps the answers that still apply.
  if (entry && state?.entry !== entry) {
    setState({ entry, draft: state ? carryEntryDraft(state.entry, state.draft, entry) : initial ?? initialEntryDraft(entry) });
    if (state) { setConflict(null); setServerErrors({}); }
  }
  const draft = state && state.entry === entry ? state.draft : null;
  const problems = entry && draft ? validateEntry(entry, draft) : {};
  // A problem of an item names the question of the block; one of the block, how many items it takes.
  const problemMessage = useCallback((problem: EntryProblem, key: string): string => {
    const question = entry ? entryProblemQuestion(entry, key)?.question : undefined;
    const count = problem === "chooseAtLeast" ? question?.selection?.minSelected : problem === "chooseAtMost" ? question?.selection?.maxSelected
      : problem === "maxLength" ? question?.maxLength : problem === "filesAtLeast" ? question?.files?.minFiles : problem === "filesAtMost" ? question?.files?.maxFiles
      : problem === "rowsAtLeast" ? question?.rows?.minRows : problem === "rowsAtMost" ? question?.rows?.maxRows : undefined;
    return t("problems." + problem, { count: count ?? 0 });
  }, [entry, t]);
  const errors: Record<string, string> = {};
  if (attempted) for (const [fieldId, problem] of Object.entries(problems)) errors[fieldId] = problemMessage(problem, fieldId);
  Object.assign(errors, serverErrors);
  const missing = entry?.questions.find(question => question.catalog?.issue === "Forms.Record.RecipientDataMissing");
  const dirty = !!draft && (options?.correcting ? !!initial && entryDraftKey(draft) !== entryDraftKey(initial)
    : Object.values(draft.values).some(value => value !== "") || Object.values(draft.files).some(files => files.length > 0)
    || Object.entries(draft.choices).some(([fieldId, chosen]) => chosen.length > 0 && entry?.questions.find(question => question.fieldId === fieldId)?.catalog?.onlyOption?.id !== chosen[0]?.id)
    || !!entry && entryItemsLoaded(entry, draft));

  const change = (next: EntryDraft) => {
    if (!entry) return;
    // A changed answer is a new send: the server's error on that question no longer applies. In the block, an error stays while
    // its item keeps its place and that answer; the block's own, while it keeps as many items.
    setServerErrors(current => Object.fromEntries(Object.entries(current).filter(([key]) => {
      const [blockId, row, fieldId] = key.split(".");
      if (fieldId !== undefined) {
        const before = draft?.rows?.[blockId]?.[Number(row)], after = next.rows?.[blockId]?.[Number(row)];
        return !!before && before.key === after?.key && before.values[fieldId] === after.values[fieldId] && before.choices[fieldId] === after.choices[fieldId];
      }
      if (next.rows?.[key] || draft?.rows?.[key]) return next.rows?.[key]?.length === draft?.rows?.[key]?.length;
      return JSON.stringify(next.values[key]) === JSON.stringify(draft?.values[key]) && next.choices[key] === draft?.choices[key] && next.files[key] === draft?.files[key];
    })));
    setState({ entry, draft: next });
  };
  // The key of a problem: a question, the block (its «Agregar ítem») or a question of an item (`entryItemPath`).
  const focus = (key: string) => window.requestAnimationFrame(() => {
    const container = document.querySelector<HTMLElement>(`[data-entry-question="${key}"]`);
    const target = document.getElementById(entryQuestionId(key)) ?? container?.querySelector<HTMLElement>("input,textarea,button,[role=radio]");
    target?.focus();
  });

  /** Sends when nothing is missing; otherwise marks every problem and focuses the first one. */
  const send = async (): Promise<FormEntrySubmitted | null> => {
    if (!entry || !draft || sending || conflict) return null;
    setAttempted(true);
    const first = entryProblemKeys(entry, draft).find(key => problems[key]);
    if (first) { setReveal(value => value + 1); focus(first); return null; }
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
        // The path of an item («answers.<block>.<n>.<question>») is the key of its problem, as the form counts them.
        const fields: Record<string, string> = {};
        for (const [path, messages] of Object.entries(error.errors)) {
          if (!path.startsWith("answers.")) continue;
          const key = path.slice("answers.".length), [blockId, row, fieldId] = key.split(".");
          const chosen = (fieldId === undefined ? draft.choices[key] : draft.rows?.[blockId]?.[Number(row)]?.choices[fieldId])?.[0];
          fields[key] = error.code === "Forms.Record.CatalogItemInactive" && chosen ? t("catalog.unavailable", { title: chosen.title }) : messages[0] ?? "";
        }
        setServerErrors(fields);
        setReveal(value => value + 1);
        const first = entryProblemKeys(entry, draft).find(key => fields[key]);
        const target = first ? entryProblemQuestion(entry, first) : null;
        if (first && target) {
          const label = target.group
            ? `${target.group.label} · ${t("common:itemTable.cell", { number: (target.row ?? 0) + 1, label: target.question.label })}` : target.question.label;
          notify({ id: `entries:send:${owner}:${formId}`, kind: "error", message: t("send.notSaved"), description: t("send.review", { label }) });
          focus(first);
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
  return { draft, change, errors, send, restart, focus, progress, sending, conflict, missing, dirty, reveal, blocked: !!missing || !!conflict };
}
