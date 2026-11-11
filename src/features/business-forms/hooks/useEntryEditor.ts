import { useCallback, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback } from "@/shared/api/errorFeedback";
import { notify } from "@/shared/ui/notifications";
import { fetchFormIssuePreview, type FormEntry, type FormEntrySubmitted, type FormIssuePreview } from "../api/entries";
import {
  carryEntryDraft, entryDraftKey, entryItemsLoaded, entryProblemKeys, entryProblemQuestion, entryQuestionId, entrySignature, entryStartingOption, initialEntryDraft, toEntrySend,
  validateEntry, type EntryDraft, type EntryProblem,
} from "../entryForm";
import { useFormEntrySubmit } from "./useFormEntry";

export type EntryConflict = "version" | "deactivated" | "forbidden" | "missing";

/** The answers of a preview are those of the send, without files and without a request of their own. */
const previewSend = (entry: FormEntry, draft: EntryDraft) => toEntrySend(entry, draft, crypto.randomUUID());
/** IV1-A: the totals are asked again a moment after the loaded answers stop changing, never on each keystroke. */
const totalsDelay = 1200;
function useSettled<T>(value: T, delay: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => { const timer = window.setTimeout(() => setSettled(value), delay); return () => window.clearTimeout(timer); }, [value, delay]);
  return settled;
}

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
  // EM2-A: «Enviar» on a form that issues opens «¿La emito?» with what would be issued; «Emitir» sends it as always.
  const [issue, setIssue] = useState<{ preview: FormIssuePreview; signature: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
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
  // IV1-A: with a form that issues and nothing missing, the «Total» itemized by the issuer; the server recalculates on sending.
  const signature = entry?.issuePreview && draft && Object.keys(problems).length === 0 ? entrySignature(entry, draft) : null;
  const settled = useSettled(signature, totalsDelay);
  const totals = useQuery({
    queryKey: ["form-issue-preview", owner, formId, settled],
    queryFn: ({ signal }) => fetchFormIssuePreview(formId, previewSend(entry!, draft!), signal),
    enabled: !!settled && settled === signature && !!entry && !!draft, staleTime: Infinity, gcTime: 30_000, retry: false, meta: { errorOwner: "local" },
  });
  const dirty = !!draft && (options?.correcting ? !!initial && entryDraftKey(draft) !== entryDraftKey(initial)
    : Object.values(draft.values).some(value => value !== "") || Object.values(draft.files).some(files => files.length > 0)
    || Object.entries(draft.choices).some(([fieldId, chosen]) => chosen.length > 0 && entryStartingOption(entry?.questions.find(question => question.fieldId === fieldId))?.id !== chosen[0]?.id)
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
    const control = document.getElementById(entryQuestionId(key));
    // LD1-A: a list still waiting for its value chosen first is off, so the value's list takes the focus.
    const waiting = control instanceof HTMLInputElement && control.disabled ? document.getElementById(entryQuestionId(key) + "-group") : null;
    const target = waiting ?? control ?? container?.querySelector<HTMLElement>("input,textarea,button,[role=radio]");
    target?.focus();
  });

  /**
   * Sends when nothing is missing; otherwise marks every problem and focuses the first one. On a form that issues, the first
   * «Enviar» only asks what would be issued and opens «¿La emito?»; `confirmed` is «Emitir», which sends.
   */
  const send = async (confirmed = false): Promise<FormEntrySubmitted | null> => {
    if (!entry || !draft || sending || previewing || conflict) return null;
    setAttempted(true);
    const first = entryProblemKeys(entry, draft).find(key => problems[key]);
    if (first) { setReveal(value => value + 1); focus(first); return null; }
    try {
      if (entry.issuePreview && !confirmed) {
        const current = entrySignature(entry, draft);
        if (totals.data && settled === current) { setIssue({ preview: totals.data, signature: current }); return null; }
        setPreviewing(true);
        try {
          setIssue({ preview: await fetchFormIssuePreview(formId, previewSend(entry, draft)), signature: current });
          return null;
        } catch (error) {
          // A form that stopped issuing sends as any other.
          if (!(error instanceof ApiError && error.code === "Forms.Entry.NoIssuance")) throw error;
        } finally { setPreviewing(false); }
      }
      const result = await submit(entry, draft);
      setServerErrors({});
      setIssue(null);
      return result;
    } catch (error) {
      setIssue(null);
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
    setAttempted(false); setServerErrors({}); setConflict(null); setIssue(null);
  };
  /** «Volver» in «¿La emito?»: nothing is sent and the answers stay as they are. */
  const closeIssue = () => setIssue(null);
  /** «Volver a probar» when the issuer could not answer: asks again with the same answers. */
  const retryIssue = async () => {
    if (!entry || !draft || previewing) return;
    setPreviewing(true);
    try { setIssue({ preview: await fetchFormIssuePreview(formId, previewSend(entry, draft)), signature: entrySignature(entry, draft) }); }
    catch { notify({ id: `entries:send:${owner}:${formId}`, kind: "error", message: t("send.failed"), description: t("send.failedHint", { submit: entry.submitLabel }) }); }
    finally { setPreviewing(false); }
  };
  // The totals shown are those of what is loaded now: while it changes, the zone waits for the new ones.
  const issueTotals = signature && settled === signature && totals.data && !totals.data.failureCode ? totals.data : null;
  return { draft, change, errors, send, restart, focus, progress, sending, conflict, missing, dirty, reveal, blocked: !!missing || !!conflict,
    issue: issue?.preview ?? null, closeIssue, retryIssue, previewing, issueTotals, totalsPending: !!signature && !issueTotals && (settled !== signature || totals.isFetching) };
}
