import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { savePrivateBlob } from "@/shared/hooks/usePrivateFormFile";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { changeReceivedDocumentForm, discardReceivedDocument, fetchReceivedDocument, fetchReceivedDocumentExtraction, fetchReceivedDocumentFile,
  fetchReceivedDocumentMenuCounts, fetchReceivedDocuments, passReceivedDocument, reopenReceivedDocument, searchReceivedDocumentOptions, type ReceivedDocument,
  type ReceivedDocumentDetail, type ReceivedDocumentsPage, type ReceivedDocumentsQuery } from "../api/receivedDocuments";
import { receivedDocumentAnswers, receivedDocumentAnswersKey, receivedDocumentCandidate, receivedDocumentDraft, receivedDocumentExtractionFailureKey,
  receivedDocumentName, receivedDocumentProblems, type ReceivedDocumentDraft, type ReceivedDocumentProblem } from "../receivedDocuments";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

/**
 * Who reads the inbox: «Ver documentos recibidos» opens it and «Revisar documentos» changes a document (the server's `canReview`
 * decides on each one). The owner of its readings is the user, the menu language and the permissions, as the sheet's; the menu's
 * counter (`app/FormOverviewShell`) builds the same owner.
 */
export function useReceivedDocumentScope() {
  const { data: user } = useCurrentUser();
  const { i18n } = useTranslation();
  const permissions = [...(user?.permissions ?? [])].sort();
  return {
    user, permissions,
    owner: [user?.id ?? "", i18n.language, permissions.join(",")].join(":"),
    allowed: permissions.includes("formdocuments.read"),
    readsResponses: permissions.includes("formrecords.read"),
    // «Armar formulario con la IA» (DOC6): seeing the inbox, reviewing documents and designing forms, the four its routes ask for.
    buildsForms: ["formdocuments.read", "formdocuments.review", "formtemplates.read", "formtemplates.manage"].every(permission => permissions.includes(permission)),
  };
}
export const receivedDocumentsKey = (owner: string) => ["form-received-documents", owner] as const;
export const receivedDocumentMenuCountsKey = (owner: string) => [...receivedDocumentsKey(owner), "counts"] as const;
export const receivedDocumentForbidden = (error: unknown) => error instanceof ApiError && (error.status === 403 || error.status === 401);

/** The menu's counter: the documents that wait for someone of the team (for review here and unclassified). */
export function useReceivedDocumentMenuCounts() {
  const scope = useReceivedDocumentScope();
  return useQuery({ queryKey: receivedDocumentMenuCountsKey(scope.owner), queryFn: ({ signal }) => fetchReceivedDocumentMenuCounts(signal), enabled: scope.allowed,
    gcTime: 0, retry: false, meta: { errorOwner: "local" } });
}

/**
 * A page of the inbox with the private filters: the previous page stays in sight, dimmed, while another one arrives, and the last
 * one of the same owner stays through a failure, like the sheet. Nothing is kept once nobody observes it.
 */
export function useReceivedDocumentList(query: ReceivedDocumentsQuery, enabled: boolean) {
  const scope = useReceivedDocumentScope();
  const root = receivedDocumentsKey(scope.owner);
  useUnobservedQueryCleanup(root);
  const [last, setLast] = useState<{ owner: string; data: ReceivedDocumentsPage } | null>(null);
  const list = useQuery({
    queryKey: [...root, "list", query], queryFn: ({ signal }) => fetchReceivedDocuments(query, signal), enabled: enabled && scope.allowed,
    gcTime: 0, retry: false, meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner ? keepPreviousData(previous) : undefined,
  });
  if (last && last.owner !== scope.owner) setLast(null);
  if (list.data && !list.isPlaceholderData && last?.data !== list.data) setLast({ owner: scope.owner, data: list.data });
  return { list, data: list.data ?? (last?.owner === scope.owner ? last.data : undefined), scope };
}

/**
 * A document of the inbox, read every time it opens: while another one arrives the previous one stays in sight, busy. A change of
 * form that runs is followed by the review (`useReceivedDocumentReview.resume`), which reads it again when it ends.
 */
export function useReceivedDocumentDetail(id: string | undefined) {
  const scope = useReceivedDocumentScope();
  const root = receivedDocumentsKey(scope.owner);
  useUnobservedQueryCleanup(root);
  return useQuery({
    queryKey: [...root, "detail", id], queryFn: ({ signal }) => fetchReceivedDocument(id!, signal), enabled: !!id && scope.allowed,
    gcTime: 0, staleTime: 0, retry: false, meta: { errorOwner: "local" },
    placeholderData: (previous, previousQuery) => previousQuery?.queryKey[1] === scope.owner ? keepPreviousData(previous) : undefined,
  });
}

/** The document's file, read once while it is open: a copy never changes, and its bytes are not kept once nobody shows them. */
export function useReceivedDocumentFile(id: string | undefined) {
  const scope = useReceivedDocumentScope();
  return useQuery({
    queryKey: [...receivedDocumentsKey(scope.owner), "file", id], queryFn: ({ signal }) => fetchReceivedDocumentFile(id!, signal), enabled: !!id && scope.allowed,
    gcTime: 0, staleTime: Infinity, retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, meta: { errorOwner: "local" },
  });
}

/**
 * «Descargar la planilla» of a row (VC1-A): the spreadsheet is asked for only when the person asks, never to show the row, and saved with
 * its name. A 429 waits its time as the reason of the button and a 403 takes the inbox away; any failure says so in the notice. Leaving
 * the row abandons it: its owner mounts once per row.
 */
export function useReceivedDocumentDownload(documentId: string, name: string, onDenied: () => void) {
  const { t } = useTranslation("formDocuments");
  const [pending, setPending] = useState(false);
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const running = useRef<AbortController | null>(null);
  useEffect(() => () => running.current?.abort(), []);
  const start = useCallback(async () => {
    if (running.current) return;
    const controller = new AbortController();
    running.current = controller;
    setPending(true);
    try {
      savePrivateBlob(await fetchReceivedDocumentFile(documentId, controller.signal), name);
    } catch (error) {
      if (controller.signal.aborted) return;
      if (receivedDocumentForbidden(error)) { onDenied(); return; }
      if (error instanceof ApiError && error.status === 429) restart(Math.min(86400, Math.max(1, error.retryAfterSeconds ?? 60)));
      notify({ id: "form-documents:download:" + documentId, kind: "error", message: t("row.downloadFailed"), description: readErrorMessage(error, t) });
    } finally {
      running.current = null;
      if (!controller.signal.aborted) setPending(false);
    }
  }, [documentId, name, onDenied, restart, t]);
  return { start, pending, wait: cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null };
}

/**
 * The options of a choice the server does not list (too many for its sender), searched by their text while its list is open: fifty at
 * most, with the previous ones in sight while others arrive, read by whoever reviews and never kept once nobody shows them.
 */
export function useReceivedDocumentOptions(documentId: string, fieldId: string, search: string, enabled: boolean) {
  const scope = useReceivedDocumentScope();
  return useQuery({
    queryKey: [...receivedDocumentsKey(scope.owner), "options", documentId, fieldId, search],
    queryFn: ({ signal }) => searchReceivedDocumentOptions(documentId, { fieldId, search }, signal), enabled: enabled && scope.allowed,
    gcTime: 0, retry: false, meta: { errorOwner: "local" }, placeholderData: keepPreviousData,
  });
}

/** The wait a 429 asked for on a reading, as the reason of its disabled «Reintentar» (`DisabledReason`); null when nothing waits. */
export function useReceivedDocumentReadWait(error: unknown) {
  const { t } = useTranslation("formDocuments");
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  useEffect(() => {
    if (error instanceof ApiError && error.status === 429) restart(Math.min(86400, Math.max(1, error.retryAfterSeconds ?? 60)));
  }, [error, restart]);
  return cooldown.isRunning ? t("wait", { count: cooldown.seconds }) : null;
}

const wait = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, milliseconds);
  signal.addEventListener("abort", () => { clearTimeout(timer); reject(new DOMException("Aborted", "AbortError")); }, { once: true });
});
export type ReceivedDocumentWork = "pass" | "discard" | "reopen" | "form";
export interface ReceivedDocumentWorking { work: ReceivedDocumentWork; form?: string }

/**
 * The owner of the documents' review (DOC5-A, decision 15): the data as the reviewer corrects them, in memory only; the problems after
 * the first attempt and the server's by question; the request of «Pasar al formulario», which repeats its UUID while the same answers
 * are sent again; discarding and reopening with the revision seen; and the change of form, which is read like a dictation until it
 * ends. What runs belongs to its document: another one can be reviewed meanwhile, and what ends after the panel closed still says
 * how it went and reads the inbox again. Nothing goes through the MutationCache nor retries by itself. A 409 reads the document again
 * and says why; a write without an answer (a network down or a 5xx) says it is uncertain and reads it again; a 403 takes the inbox
 * away; a 429 turns the actions off for the time the server asked.
 */
export function useReceivedDocumentReview(detail: ReceivedDocumentDetail | undefined, { onDenied }: { onDenied: () => void }) {
  const { t, i18n } = useTranslation("formDocuments");
  const client = useQueryClient();
  const scope = useReceivedDocumentScope();
  const root = useMemo(() => receivedDocumentsKey(scope.owner), [scope.owner]);
  const candidate = detail ? receivedDocumentCandidate(detail) : null;
  const base = detail ? `${detail.document.id}:${detail.document.revision}:${candidate?.versionId ?? ""}` : "";
  const [draft, setDraft] = useState<{ base: string; values: ReceivedDocumentDraft; attempted: boolean; server: Record<string, string> }>({ base: "", values: {}, attempted: false, server: {} });
  if (draft.base !== base) setDraft({ base, values: receivedDocumentDraft(candidate, i18n.language), attempted: false, server: {} });
  // What runs, by document: the state draws it and the set answers at once, also to a notice's action rendered earlier.
  const [working, setWorking] = useState<Readonly<Record<string, ReceivedDocumentWorking>>>({});
  const busy = useRef(new Set<string>());
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const pass = useRef<{ base: string; key: string; requestId: string } | null>(null);
  const live = useRef(true);
  const polls = useRef(new Map<string, AbortController>());
  // A change of form that ended (completed, failed, or no longer there) is never followed again, even if a late reading still names it.
  // One whose reading failed (a network down, a 5xx, a 429, a permission) stops: the document says so, keeps its actions and offers
  // «Reintentar»; it is not resumed by itself.
  const settled = useRef(new Set<string>());
  const [stalled, setStalled] = useState<Readonly<Record<string, { requestId: string; form: string }>>>({});
  const halted = useRef(new Set<string>());
  // A notice per document, so two results do not replace each other. Closing the panel takes away what it said that was not a
  // result; a result it said, or one that arrives after it closed, stays.
  const shown = useRef(new Set<string>());
  const say = useCallback((id: string, message: Omit<Parameters<typeof notify>[0], "id">) => {
    const key = `form-documents:${scope.owner}:${id}`;
    if (live.current && message.kind !== "success") shown.current.add(key); else shown.current.delete(key);
    notify({ id: key, ...message });
  }, [scope.owner]);
  const hush = useCallback((id: string) => dismissNotification(`form-documents:${scope.owner}:${id}`), [scope.owner]);
  useLayoutEffect(() => {
    live.current = true;
    const running = polls.current, notices = shown.current;
    return () => {
      live.current = false;
      for (const controller of running.values()) controller.abort();
      running.clear();
      for (const key of notices) dismissNotification(key);
      notices.clear();
    };
  }, [scope.owner]);
  const start = (id: string, work: ReceivedDocumentWorking) => { busy.current.add(id); setWorking(current => ({ ...current, [id]: work })); };
  const finish = useCallback((id: string, work?: ReceivedDocumentWork) => {
    busy.current.delete(id);
    if (live.current) setWorking(current => { if (!current[id] || work && current[id].work !== work) return current; const { [id]: _, ...rest } = current; return rest; });
  }, []);
  const readAgain = useCallback(async (id: string) => {
    await Promise.all([client.invalidateQueries({ queryKey: [...root, "detail", id] }), client.invalidateQueries({ queryKey: [...root, "list"] }),
      client.invalidateQueries({ queryKey: receivedDocumentMenuCountsKey(scope.owner) })]);
  }, [client, root, scope.owner]);

  // A failed request: a conflict reads the document again and says why (the server's text, also `AwaitingSender` while its person can
  // still complete it), a write without an answer says so and reads it again, the permission takes the inbox away, a 429 waits, and
  // anything else says what happened. Changing the form also answers 403 when the engine refuses: it says so and reads the document
  // again, whose reading decides the access.
  const fail = useCallback(async (id: string, error: unknown, failed: string, { engine = false, writing = false } = {}) => {
    const feedback = errorFeedback(error, { writing });
    if (feedback.kind === "cancelled" || feedback.kind === "session") return;
    if (feedback.kind === "forbidden" && engine) { say(id, { kind: "error", message: failed, description: feedback.detail ?? undefined }); await readAgain(id); return; }
    if (feedback.kind === "forbidden") { onDenied(); return; }
    // A 429 (also the AI's quota or capacity when the form changes) says the server's text, when it has one, and when to try again.
    if (feedback.kind === "wait") {
      const seconds = Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60));
      restart(seconds);
      say(id, { kind: "error", message: feedback.detail ?? t("wait", { count: seconds }), description: feedback.detail ? t("wait", { count: seconds }) : undefined });
      return;
    }
    if (feedback.kind === "uncertain") { say(id, { kind: "warning", message: operationalErrorMessage(error, t) }); await readAgain(id); return; }
    if (error instanceof ApiError && (error.status === 409 || error.status === 404)) {
      say(id, { kind: "warning", message: error.detail ?? failed });
      await readAgain(id);
      return;
    }
    say(id, { kind: "error", message: failed, description: readErrorMessage(error, t) });
  }, [onDenied, readAgain, restart, say, t]);

  const review = async (work: "discard" | "reopen") => {
    if (!detail || busy.current.has(detail.document.id) || cooldown.isRunning) return;
    const document = detail.document;
    start(document.id, { work });
    hush(document.id);
    try {
      const changed = await (work === "discard" ? discardReceivedDocument : reopenReceivedDocument)(document.id, document.revision);
      if (live.current) client.setQueryData([...root, "detail", document.id], changed);
      say(document.id, { kind: "success", message: t(work === "discard" ? "discard.done" : "reopen.done", { name: receivedDocumentName(document, (key, values) => t(key, values)) }) });
      await Promise.all([client.invalidateQueries({ queryKey: [...root, "list"] }), client.invalidateQueries({ queryKey: receivedDocumentMenuCountsKey(scope.owner) })]);
    } catch (error) {
      await fail(document.id, error, t(work === "discard" ? "discard.failed" : "reopen.failed"), { writing: true });
    } finally {
      finish(document.id, work);
    }
  };

  // The change of form is read every two seconds until it ends, as a dictation, whoever asked for it (the server reads it with the
  // asker's context, and only for whoever reviews); leaving the inbox stops reading it, and opening the document again resumes it while
  // it runs (`resume`). When it ends (completed, failed or no longer there, as when someone else's reading ended it first) the document
  // drops it and is read again. When its reading fails, it stops until «Reintentar» (`again`), after the wait of a 429.
  const follow = useCallback(async (id: string, requestId: string, form: string, again = false) => {
    const key = requestId.toLowerCase();
    if (polls.current.has(key) || settled.current.has(key) || !again && halted.current.has(key) || !live.current) return;
    const controller = new AbortController();
    polls.current.set(key, controller);
    halted.current.delete(key);
    setStalled(current => { if (!current[id]) return current; const { [id]: _, ...rest } = current; return rest; });
    busy.current.add(id);
    setWorking(current => ({ ...current, [id]: { work: "form", form } }));
    let ended = false;
    try {
      for (;;) {
        await wait(2000, controller.signal);
        const status = await fetchReceivedDocumentExtraction(id, requestId, controller.signal);
        if (status.state === "pending") continue;
        if (status.state === "failed") say(id, { kind: "warning", message: t(receivedDocumentExtractionFailureKey(status.failureCode), { form }) });
        ended = true;
        break;
      }
    } catch (error) {
      if (!controller.signal.aborted && error instanceof ApiError && error.status === 404) {
        ended = true;
        if (error.code !== "Forms.ReceivedDocument.ExtractionNotFound") say(id, { kind: "warning", message: error.detail ?? t("extraction.failed", { form }) });
      } else if (!controller.signal.aborted) {
        const feedback = errorFeedback(error);
        if (feedback.kind === "wait") restart(Math.min(86400, Math.max(1, feedback.retryAfterSeconds ?? 60)));
        // Whether it can still be reviewed is decided by the document, read again.
        if (feedback.kind === "forbidden") void readAgain(id);
      }
    } finally {
      polls.current.delete(key);
      if (!controller.signal.aborted) {
        finish(id, "form");
        if (ended) {
          settled.current.add(key);
          client.setQueryData<ReceivedDocumentDetail>([...root, "detail", id], current =>
            current?.extraction?.requestId.toLowerCase() === key ? { ...current, extraction: null } : current);
          await readAgain(id);
        } else if (live.current) {
          halted.current.add(key);
          setStalled(current => ({ ...current, [id]: { requestId: key, form } }));
        }
      }
    }
  }, [client, finish, readAgain, restart, root, say, t]);
  const resume = useCallback((id: string, requestId: string, form: string) => { void follow(id, requestId, form); }, [follow]);

  // The form is changed on the document as it was seen; a notice's action keeps its own (`Volver a leer para «X»`).
  const changeFormOf = async (document: ReceivedDocument, definitionId: string, form: string) => {
    if (busy.current.has(document.id) || cooldown.isRunning) return;
    const requestId = crypto.randomUUID();
    start(document.id, { work: "form", form });
    hush(document.id);
    try {
      await changeReceivedDocumentForm(document.id, { requestId, definitionId, expectedRevision: document.revision });
      finish(document.id, "form");
      void follow(document.id, requestId, form);
    } catch (error) {
      finish(document.id, "form");
      await fail(document.id, error, t("extraction.failed", { form }), { engine: true, writing: true });
    }
  };

  // A conflict answered outside a write (the options of a choice of a document that is no longer proposed or unclassified): the server's
  // text, and the document read again.
  const documentId = detail?.document.id;
  const conflict = useCallback((error: unknown) => {
    if (!documentId || !(error instanceof ApiError) || error.status !== 409) return;
    say(documentId, { kind: "warning", message: error.detail ?? t("options.failed") });
    void readAgain(documentId);
  }, [documentId, readAgain, say, t]);

  const problems = candidate ? receivedDocumentProblems(candidate, draft.values) : {};
  const submit = async (confirmRepeated = false): Promise<string | null> => {
    if (!detail || !candidate || busy.current.has(detail.document.id) || cooldown.isRunning) return null;
    const first = candidate.values.find(value => problems[value.fieldId]);
    if (first) { setDraft(current => ({ ...current, attempted: true })); return first.fieldId; }
    const document = detail.document;
    const answers = receivedDocumentAnswers(candidate, draft.values);
    const key = receivedDocumentAnswersKey(answers);
    // The same answers again repeat the request, so a pass whose answer was lost returns its first number.
    if (pass.current?.base !== base || pass.current.key !== key) pass.current = { base, key, requestId: crypto.randomUUID() };
    const request = pass.current, asked = base;
    start(document.id, { work: "pass" });
    hush(document.id);
    try {
      const record = await passReceivedDocument(document.id, { requestId: request.requestId, versionId: candidate.versionId, expectedRevision: document.revision, answers,
        ...(confirmRepeated ? { confirmRepeated: true } : {}) });
      if (pass.current === request) pass.current = null;
      say(document.id, { kind: "success", message: t("pass.done", { number: record.number }) });
      await readAgain(document.id);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.errors) {
        const server = Object.fromEntries(Object.entries(error.errors).filter(([path]) => path.startsWith("answers.")).map(([path, messages]) => [path.slice("answers.".length), messages[0] ?? ""]));
        const marked = candidate.values.find(value => server[value.fieldId]);
        if (live.current) setDraft(current => current.base === asked ? { ...current, attempted: true, server } : current);
        say(document.id, { kind: "error", message: t("pass.notSaved"), description: marked ? t("pass.review", { label: marked.label }) : error.detail ?? undefined });
        return marked?.fieldId ?? null;
      }
      // F13: it repeats a saved response: the reviewer is told which one and passes it anyway from the notice (a request of its own: the
      // server answers a rejection again to the same one), or reviews it first.
      if (error instanceof ApiError && error.status === 409 && error.code === "Forms.ReceivedDocument.Repeated") {
        const number = typeof error.problem.recordNumber === "string" ? error.problem.recordNumber : null;
        say(document.id, { kind: "warning", message: number ? t("pass.repeatedOf", { number }) : t("pass.repeated"),
          action: { label: t("pass.anyway"), onClick: () => { pass.current = null; void submit(true); } } });
        return null;
      }
      // Its form was published again after it was read: its data are read again for it, from the notice.
      const own = document.form;
      if (error instanceof ApiError && error.status === 409 && error.code === "Forms.Entry.VersionChanged" && own) {
        say(document.id, { kind: "warning", message: t("form.versionChanged", { form: own.name }),
          action: { label: t("form.readAgain", { form: own.name }), onClick: () => { void changeFormOf(document, own.definitionId, own.name); } } });
        await readAgain(document.id);
        return null;
      }
      await fail(document.id, error, t("pass.failed"), { writing: true });
    } finally {
      finish(document.id, "pass");
    }
    return null;
  };

  return {
    candidate,
    values: draft.values,
    problems: draft.attempted ? problems : {} as Record<string, ReceivedDocumentProblem>,
    serverErrors: draft.server,
    change: (fieldId: string, value: string) => setDraft(current => ({ ...current, values: { ...current.values, [fieldId]: value },
      server: Object.fromEntries(Object.entries(current.server).filter(([key]) => key !== fieldId)) })),
    working: detail ? working[detail.document.id] ?? null : null,
    // A change of form that runs is read where it was left, whoever asked for it (the history says who).
    resume,
    conflict,
    // The change of form this document stopped reading because its reading failed, and how to read it again.
    stalled: detail ? stalled[detail.document.id] ?? null : null,
    retry: () => {
      const item = detail ? stalled[detail.document.id] : undefined;
      if (detail && item && !cooldown.isRunning) void follow(detail.document.id, item.requestId, item.form, true);
    },
    cooldown,
    discard: () => review("discard"),
    reopen: () => review("reopen"),
    changeForm: (definitionId: string, form: string) => detail ? changeFormOf(detail.document, definitionId, form) : Promise.resolve(),
    submit,
  };
}
