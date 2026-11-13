import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/shared/api/ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "@/shared/api/errorFeedback";
import { useCountdown } from "@/shared/hooks/useCountdown";
import { dismissNotification, notify } from "@/shared/ui/notifications";
import { createDocumentFormDraft, fetchDocumentFormProposal, requestDocumentFormProposal, type DocumentFormDraftBody, type DocumentFormProposal } from "../api/documentFormProposals";
import { documentFormServerProblems } from "../documentFormProposal";
import { receivedDocumentMenuCountsKey, receivedDocumentsKey, useReceivedDocumentScope } from "./useReceivedDocuments";
import { useUnobservedQueryCleanup } from "./useUnobservedQueryCleanup";

export type DocumentFormAsk = { readonly documentId: string } | { readonly topicId: string };
export type DocumentFormCreation = { readonly kind: "created"; readonly definitionId: string } | { readonly kind: "problems"; readonly fields: Readonly<Record<string, string>> }
  | { readonly kind: "failed" };

const wait = (error: unknown) => Math.min(86400, Math.max(1, error instanceof ApiError ? error.retryAfterSeconds ?? 60 : 60));

/**
 * The owner of a request of «Armar formulario con la IA» (DOC6, decision 17). While what it asks for (`ask`: one unclassified document
 * or a topic) is in the address it asks for it once, under the request's UUID: asking again (a reload, «Reintentar» after a network
 * down) gets the same request, and once the server keeps it `onAsked` takes the ask out of the address. Then it reads it every two
 * seconds while the assistant builds it, like a dictation: leaving stops reading and coming back reads it again. «Crear borrador»
 * sends the form as edited, also under the request (the same request again gets the draft it created), and answers the problems of
 * the page's fields by their paths; the rest goes to the common notice. Nothing goes through the MutationCache nor retries by itself;
 * a 403 takes the page away and a 429 waits what the server asked.
 */
export function useDocumentFormProposal(requestId: string, ask: DocumentFormAsk | null, { onAsked, onDenied }: { onAsked: () => void; onDenied: () => void }) {
  const { t } = useTranslation(["formDocuments", "common"]);
  const client = useQueryClient();
  const scope = useReceivedDocumentScope();
  const root = receivedDocumentsKey(scope.owner);
  useUnobservedQueryCleanup(root);
  const key = [...root, "form-proposal", requestId] as const;
  const cooldown = useCountdown(0);
  const { restart } = cooldown;
  const live = useRef(true);
  const feedbackId = `form-documents:proposal:${scope.owner}:${requestId}`;
  useLayoutEffect(() => {
    live.current = true;
    return () => { live.current = false; dismissNotification(feedbackId); };
  }, [feedbackId]);

  // The page's callbacks, current without asking again when they change.
  const callbacks = useRef({ onAsked, onDenied });
  useLayoutEffect(() => { callbacks.current = { onAsked, onDenied }; }, [onAsked, onDenied]);

  // Asking: once per request and ask, also through the double mount of StrictMode (a request already asked is not asked again until
  // «Reintentar»); what arrives after leaving is kept in the cache and not drawn.
  const askKey = ask ? requestId + ":" + ("documentId" in ask ? "d:" + ask.documentId : "t:" + ask.topicId) : null;
  const [asking, setAsking] = useState<{ key: string; state: "pending" | "done" | "failed"; error: unknown } | null>(null);
  const askNow = useCallback(async (target: DocumentFormAsk, targetKey: string) => {
    setAsking({ key: targetKey, state: "pending", error: null });
    try {
      const asked = await requestDocumentFormProposal({ requestId, ...target });
      client.setQueryData([...receivedDocumentsKey(scope.owner), "form-proposal", requestId], asked);
      if (!live.current) return;
      setAsking({ key: targetKey, state: "done", error: null });
      callbacks.current.onAsked();
    } catch (error) {
      const feedback = errorFeedback(error);
      if (!live.current || feedback.kind === "cancelled") return;
      if (feedback.kind === "forbidden" || feedback.kind === "session") { callbacks.current.onDenied(); return; }
      if (feedback.kind === "wait") restart(wait(error));
      setAsking({ key: targetKey, state: "failed", error });
    }
  }, [client, requestId, restart, scope.owner]);
  const started = useRef<string | null>(null);
  useEffect(() => {
    if (!ask || !askKey || asking?.key === askKey || started.current === askKey) return;
    started.current = askKey;
    void askNow(ask, askKey);
  }, [ask, askKey, asking?.key, askNow]);

  // Reading: every two seconds while the assistant builds it; a failed reading stops until «Reintentar».
  const read = useQuery({
    queryKey: key, queryFn: ({ signal }) => fetchDocumentFormProposal(requestId, signal), enabled: !ask && scope.allowed && scope.buildsForms,
    gcTime: 0, staleTime: 0, retry: false, refetchOnWindowFocus: false, meta: { errorOwner: "local" },
    refetchInterval: query => query.state.data?.state === "pending" && query.state.status !== "error" ? 2000 : false,
  });
  const readError = read.error;
  useEffect(() => {
    if (!readError) return;
    const feedback = errorFeedback(readError);
    if (feedback.kind === "forbidden" || feedback.kind === "session") callbacks.current.onDenied();
    else if (feedback.kind === "wait") restart(wait(readError));
  }, [readError, restart]);

  // «Crear borrador».
  const [creating, setCreating] = useState(false);
  const busy = useRef(false);
  const create = async (body: DocumentFormDraftBody, name: string): Promise<DocumentFormCreation> => {
    if (busy.current || cooldown.isRunning) return { kind: "failed" };
    busy.current = true;
    setCreating(true);
    dismissNotification(feedbackId);
    try {
      const draft = await createDocumentFormDraft(body);
      client.setQueryData<DocumentFormProposal>(key, current => current ? { ...current, definitionId: draft.definitionId } : current);
      notify({ id: feedbackId + ":created", kind: "success", message: t("formProposal.created", { name }) });
      // Its group is no longer offered in the inbox.
      void client.invalidateQueries({ queryKey: [...root, "list"] });
      void client.invalidateQueries({ queryKey: receivedDocumentMenuCountsKey(scope.owner) });
      return { kind: "created", definitionId: draft.definitionId };
    } catch (error) {
      const feedback = errorFeedback(error, { writing: true });
      if (feedback.kind === "cancelled" || feedback.kind === "session") return { kind: "failed" };
      if (feedback.kind === "forbidden") { callbacks.current.onDenied(); return { kind: "failed" }; }
      // A 429 says the server's text, when it has one, and when it can be tried again.
      if (feedback.kind === "wait") {
        const seconds = wait(error);
        restart(seconds);
        notify({ id: feedbackId, kind: "error", message: feedback.detail ?? t("wait", { count: seconds }), description: feedback.detail ? t("wait", { count: seconds }) : undefined });
        return { kind: "failed" };
      }
      if (error instanceof ApiError && error.status === 400 && error.errors) {
        const problems = documentFormServerProblems(error.errors);
        if (problems.others.length || Object.keys(problems.fields).length === 0)
          notify({ id: feedbackId, kind: "error", message: t("formProposal.notCreated"), description: problems.others.join(" ") || error.detail || undefined });
        return Object.keys(problems.fields).length ? { kind: "problems", fields: problems.fields } : { kind: "failed" };
      }
      // A request or a proposal that is no longer there, or that changed: the server's text, and the request read again.
      if (error instanceof ApiError && (error.status === 404 || error.status === 409)) {
        notify({ id: feedbackId, kind: "warning", message: error.detail ?? t("formProposal.notCreated") });
        void client.invalidateQueries({ queryKey: key });
        return { kind: "failed" };
      }
      notify({ id: feedbackId, kind: feedback.kind === "uncertain" ? "warning" : "error",
        message: feedback.kind === "uncertain" ? operationalErrorMessage(error, t) : t("formProposal.notCreated"),
        description: feedback.kind === "uncertain" ? undefined : readErrorMessage(error, t) });
      // Without a clear answer (the network or a 5xx) the draft may exist: the request read again says so, and the page opens it
      // instead of sending edits the server would ignore and naming them as created.
      if (feedback.kind === "uncertain") void client.invalidateQueries({ queryKey: key });
      return { kind: "failed" };
    } finally {
      busy.current = false;
      if (live.current) setCreating(false);
    }
  };

  const askFailed = !!askKey && asking?.key === askKey && asking.state === "failed";
  return {
    /** The request as the server keeps it, or undefined while it is asked for or read the first time. */
    proposal: read.data,
    asking: !!askKey && !askFailed,
    askError: askFailed ? asking.error : null,
    retryAsk: () => { if (ask && askKey && askFailed && !cooldown.isRunning) void askNow(ask, askKey); },
    reading: !ask && read.isPending,
    readError,
    retryRead: () => { if (!cooldown.isRunning) void read.refetch(); },
    create,
    creating,
    cooldown,
  };
}
