import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useLocation, useSearchParams, Link } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { useCurrentUser, currentUserQueryKey } from "@/auth/useCurrentUser";
import { AccountRecoveryNotice } from "@/auth/components/AccountRecoveryNotice";
import { ApiError } from "@/shared/api/ApiError";
import { readAssistantDraft } from "@/shared/hooks/assistantDraftState";
import { AssistantProposalContext } from "@/shared/hooks/assistantProposalContext";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatTimeInZone } from "@/shared/lib/dateTime";
import { formatFileSize } from "@/shared/lib/fileSize";
import { formatPercent } from "@/shared/lib/numberFormat";
import { Page } from "@/shared/ui/Page";
import { Button } from "@/shared/ui/button";
import { Spinner } from "@/shared/ui/Spinner";
import { EmptyState } from "@/shared/ui/EmptyState";
import { ForbiddenPage } from "@/shared/ui/ForbiddenPage";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/ui/dialog";
import { AssistantThread } from "@/shared/ui/assistant/AssistantThread";
import { AssistantMessage } from "@/shared/ui/assistant/AssistantMessage";
import { AssistantComposer } from "@/shared/ui/assistant/AssistantComposer";
import { AssistantRecorder } from "@/shared/ui/assistant/AssistantRecorder";
import { AssistantAttach, AssistantFile } from "@/shared/ui/assistant/AssistantAttachment";
import { useAudioRecorder } from "@/shared/hooks/useAudioRecorder";
import { AssistantSuggestions } from "@/shared/ui/assistant/AssistantSuggestions";
import { notify } from "@/shared/ui/notifications";
import {
  assistantApi,
  type AssistantAccepted,
  type AssistantState,
  type AssistantTurn,
  type AssistantTurnAttachment,
} from "../api/assistant";
import {
  acceptedFileKinds,
  assistantKey,
  attachmentAccept,
  attachmentKinds,
  attachmentProblem,
  canAttach,
  fileExtension,
  fileKind,
  isActiveTurn,
  proposalNeighbors,
  readsFirst,
  roundUpToTenthOfMegabyte,
  type AttachmentKinds,
  type AttachmentProblem,
} from "../assistant/model";
import { useAssistantConversation } from "../hooks/useAssistantConversation";
import { useAssistantTurnActions } from "../hooks/useAssistantTurnActions";
import { useAssistantDictation } from "../hooks/useAssistantDictation";
import { useAssistantDocument } from "../hooks/useAssistantDocument";
import { AssistantTurnAudio } from "../components/assistant/AssistantTurnAudio";
import { AssistantRuntimeProvider } from "../components/assistant/AssistantRuntimeProvider";
import { AssistantWelcome } from "../components/assistant/AssistantWelcome";
import { AssistantSources } from "../components/assistant/AssistantSources";
import { AssistantOperationState } from "../components/assistant/AssistantOperationState";
import { AssistantConversationPanel } from "../components/assistant/AssistantConversationPanel";
import { AssistantWorkspace } from "@/shared/ui/assistant/AssistantWorkspace";
import { useAssistantConversationList } from "../hooks/useAssistantConversationList";
const audioMaximumBytes = 1_000_000;
const elapsed = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
const announcedStates: readonly AssistantState[] = [
  "failed",
  "uncertain",
  "expired",
];
type Translate = (key: string, options?: Record<string, unknown>) => string;
/// What describes a file in the composer (its kind and size) or in a message (also the rows of a spreadsheet or the pages of a PDF;
/// a photo is one page, not counted), in the menu language: «Excel · 86 filas · 24 KB», «PDF · 2 páginas · 412 KB», «Foto · 1,2 MB»,
/// «Word · 24 KB». A kind Home does not take says its extension.
function describeFile(t: Translate, language: string, file: { kind: string; size: number; rows?: number; pages?: number }) {
  const kind = fileKind(file.kind);
  const count = file.rows !== undefined ? t("attachment.rows", { count: file.rows, rows: file.rows })
    : kind === "pdf" && file.pages !== undefined ? t("attachment.pages", { count: file.pages }) : null;
  return [kind ? t(`attachment.kind.${kind}`) : file.kind.toUpperCase(), count, formatFileSize(file.size, language)].filter(Boolean).join(" · ");
}
/// Why a file the browser can see does not serve: an old Word or one with macros says to save it as a PDF only when the clip takes
/// one, another type names what the clip takes for this person, and one over the limit says its weight rounded up.
function problemText(t: Translate, language: string, problem: AttachmentProblem, kinds: AttachmentKinds, size: number) {
  if (problem === "type") {
    const types = acceptedFileKinds(kinds).map((kind) => t(`attachment.types.${kind}`));
    return t("attachment.type", { types: new Intl.ListFormat(language, { type: "disjunction" }).format(types) });
  }
  if (problem === "legacyWord") return t(kinds.reading ? "attachment.legacyWordPdf" : "attachment.legacyWord");
  if (problem === "macrosWord") return t(kinds.reading ? "attachment.macrosWordPdf" : "attachment.macrosWord");
  return t(`attachment.${problem}`, { size: formatFileSize(roundUpToTenthOfMegabyte(size), language) });
}
function TurnFile({ attachment }: { attachment: AssistantTurnAttachment }) {
  const { t, i18n } = useTranslation("assistant");
  return <AssistantFile name={attachment.name} description={describeFile(t, i18n.language, attachment)} />;
}
const MessageContext = createContext<{
  turns: readonly AssistantTurn[];
  permissions: readonly string[];
  timeZone: string;
}>({ turns: [], permissions: [], timeZone: "UTC" });
function ConfirmedMessage() {
  const { t, i18n } = useTranslation("assistant");
  const value = useContext(MessageContext);
  const proposals = useContext(AssistantProposalContext);
  const message = useAuiState((state) => state.message);
  const requestId = message.metadata.custom.requestId;
  const turn = value.turns.find((item) => item.requestId === requestId);
  if (!turn) return null;
  const role = message.role === "user" ? "user" : "assistant";
  const proposal =
    role === "assistant" && turn.proposal && proposals?.accepts(turn.proposal)
      ? { ...proposalNeighbors(value.turns, turn, proposals.replacementGroup), Card: proposals.Card }
      : null;
  return (
    <AssistantMessage
      role={role}
      label={t(role === "user" ? "you" : "assistant")}
      timestamp={turn.submittedAtUtc}
      timeLabel={formatTimeInZone(
        turn.submittedAtUtc,
        i18n.language,
        value.timeZone,
      )}
      copyLabel={role === "assistant" ? t("copy") : undefined}
      media={role === "user" && (turn.attachment || turn.audio) ? <>
        {turn.attachment ? <TurnFile attachment={turn.attachment} /> : null}
        {turn.audio ? <AssistantTurnAudio requestId={turn.audio.requestId} transcript={turn.audio.transcript} /> : null}
      </> : undefined}
    >
      {proposal && turn.proposal ? (
        <proposal.Card
          requestId={turn.requestId}
          proposal={turn.proposal}
          previous={proposal.previous}
          replaced={proposal.replaced}
        />
      ) : null}
      {role === "assistant" ? (
        <AssistantSources
          evidences={turn.evidences}
          permissions={value.permissions}
          timeZone={value.timeZone}
        />
      ) : null}
    </AssistantMessage>
  );
}
export function AiAssistantPage() {
  const { t, i18n } = useTranslation(["assistant", "common"]);
  const { data: user } = useCurrentUser();
  const proposals = useContext(AssistantProposalContext);
  const client = useQueryClient();
  const [params] = useSearchParams();
  const update = useQueryUpdate();
  const conversationId = params.get("conversacion") ?? undefined;
  const userId = user?.id ?? "";
  const permissionsVersion = [...(user?.permissions ?? [])].sort().join("|");
  // A request begun on another screen («Armar con la IA») opens a new conversation with it in the composer, unsent.
  const location = useLocation();
  const [draft, setDraft] = useState(() => (conversationId ? "" : readAssistantDraft(location.state) ?? ""));
  const [localError, setLocalError] = useState<string>();
  // Stage 2 and 3: one file per message, with what the browser saw that does not serve; the clip and a suggestion open the picker.
  const [attachment, setAttachment] = useState<{ file: File; problem?: AttachmentProblem }>();
  const fileInput = useRef<HTMLInputElement>(null);
  const clip = useRef<HTMLButtonElement>(null);
  const removeButton = useRef<HTMLButtonElement>(null);
  const [accepted, setAccepted] = useState<AssistantAccepted>();
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const list = useAssistantConversationList(userId, i18n.language, permissionsVersion);
  const [nextConversation, setNextConversation] = useState<
    string | null | undefined
  >();
  const [deleteId, setDeleteId] = useState<string>();
  const [repeat, setRepeat] = useState<AssistantTurn>();
  const [forbidden, setForbidden] = useState(false);
  // A read the person asked for (the status of an uncertain turn, the retry of a failed history or of the availability)
  // shows its spinner on the button that asked, also when the confirmed data stays on screen meanwhile.
  const [rereading, setRereading] = useState<"status" | "retry" | "availability">();
  const reread = useCallback(
    async (kind: "status" | "retry" | "availability", read: () => Promise<unknown>) => {
      setRereading(kind);
      try {
        await read();
      } finally {
        setRereading((current) => (current === kind ? undefined : current));
      }
    },
    [],
  );
  const restoreDecision = useRestoreFocusOnClose(
    nextConversation !== undefined,
  );
  const bootstrap = useQuery({
    queryKey: [
      ...assistantKey(userId),
      "bootstrap",
      i18n.language,
      permissionsVersion,
    ],
    queryFn: ({ signal }) => assistantApi.bootstrap(signal),
    enabled: !!userId,
    gcTime: 60000,
    staleTime: 0,
  });
  const data = useAssistantConversation(
    userId,
    conversationId,
    accepted && accepted.conversationId === conversationId
      ? accepted.requestId
      : undefined,
    i18n.language,
    permissionsVersion,
  );
  const actions = useAssistantTurnActions({
    userId,
    onAccepted: (value, submission) => {
      setAccepted(value);
      setDraft("");
      // The turn took the composer's file and recording, also when «Consultar estado» or «Repetir el mismo pedido» confirmed it: they
      // leave the composer, so the next send does not repeat them and the leave guard lets go.
      if (submission.file || submission.body.documentRequestId) setAttachment(undefined);
      if (submission.body.audioRequestId) recorder.discard();
      navigation.allowNextNavigation();
      setDrawerOpen(false);
      update({ conversacion: value.conversationId, page: undefined });
    },
    onForbidden: () => {
      setDraft("");
      setForbidden(true);
      void client.invalidateQueries({ queryKey: currentUserQueryKey });
    },
    // I2: what the turn named expired, so the next send uploads the same recording and file again.
    onSourceExpired: ({ body }) => {
      if (body.audioRequestId) dictation.forget(body.audioRequestId);
      if (body.documentRequestId) reading.forget(body.documentRequestId);
    },
  });
  // IA4: one recording per message, up to the bound of a WhatsApp audio; leaving the page loses it like a draft.
  const recorder = useAudioRecorder(audioMaximumBytes);
  // A 429 on the upload of a recording or of a document starts the same wait as one on the turn.
  const dictation = useAssistantDictation({ userId, onForbidden: () => setForbidden(true), onWait: actions.startCooldown });
  // Stage 3: a photo or a PDF is read before its turn, under its own request.
  const reading = useAssistantDocument({ userId, onForbidden: () => setForbidden(true), onWait: actions.startCooldown });
  // A send that prepares a recording or a document belongs to the conversation it started in: leaving it retires that send, so its
  // turn never reaches the conversation that was left.
  const sendGeneration = useRef(0);
  const retireSend = () => { sendGeneration.current += 1; };
  const navigation = useUnsavedChangesGuard(
    !!draft.trim() || actions.uncertain || recorder.state !== "idle" || !!attachment,
    { queryKeys: ["conversacion"] },
  );
  useEffect(() => {
    return () => {
      void client.cancelQueries({ queryKey: assistantKey(userId) });
      client.removeQueries({ queryKey: assistantKey(userId) });
    };
  }, [client, userId]);
  useEffect(
    () => () => {
      client.removeQueries({
        predicate: (query) =>
          query.queryKey[0] === "assistant" &&
          query.queryKey[1] === userId &&
          query.queryKey.at(-1) === permissionsVersion,
      });
    },
    [client, userId, permissionsVersion],
  );
  const permissionLost = [
    bootstrap.error,
    data.conversation.error,
    data.turn.error,
    data.history.error,
    list.query.error,
  ].some((error) => error instanceof ApiError && error.status === 403);
  useEffect(
    () =>
      client.getQueryCache().subscribe((event) => {
        if (
          event.type !== "updated" ||
          event.query.queryKey[0] !== "assistant" ||
          event.query.queryKey[1] !== userId
        )
          return;
        const error = event.query.state.error;
        if (error instanceof ApiError && error.status === 403) {
          setDraft("");
          setForbidden(true);
          client.removeQueries({ queryKey: assistantKey(userId) });
          void client.invalidateQueries({ queryKey: currentUserQueryKey });
        }
      }),
    [client, userId],
  );
  const announced = useRef(new Set<string>());
  const observedStates = useRef(new Map<string, AssistantState>());
  useEffect(() => {
    for (const turn of data.turns) {
      const previous = observedStates.current.get(turn.requestId);
      observedStates.current.set(turn.requestId, turn.state);
      if (
        !turn.failure ||
        !announcedStates.includes(turn.state) ||
        isActiveTurn(turn) ||
        (!isActiveTurn(previous ? { state: previous } : undefined) &&
          accepted?.requestId !== turn.requestId)
      )
        continue;
      const id = `assistant:${userId}:${turn.requestId}:${turn.state}`;
      if (announced.current.has(id)) continue;
      announced.current.add(id);
      notify({
        id,
        kind: turn.state === "uncertain" ? "warning" : "error",
        message: turn.failure.detail,
        action:
          turn.state === "uncertain"
            ? {
                label: t("checkStatus"),
                onClick: () => {
                  void reread("status", data.refetch);
                },
              }
            : undefined,
      });
    }
  }, [data, userId, t, accepted, reread]);
  function go(id: string | null) {
    retireSend();
    navigation.allowNextNavigation();
    setAccepted(undefined);
    setDraft("");
    setLocalError(undefined);
    setDrawerOpen(false);
    update(
      {
        conversacion: id ?? undefined,
        page: undefined,
        pageSize: undefined,
        sort: undefined,
      },
      { replace: false },
    );
  }
  function choose(id: string | null) {
    if (actions.busy || actions.uncertain || (id !== null && id === conversationId)) return;
    if (draft.trim() || data.active) setNextConversation(id);
    else go(id);
  }
  const context = useMemo(
    () => ({
      turns: data.turns,
      permissions: user?.permissions ?? [],
      timeZone: user?.timeZoneId ?? "UTC",
    }),
    [data.turns, user?.permissions, user?.timeZoneId],
  );
  const disabled =
    actions.busy ||
    actions.uncertain ||
    actions.cooldownSeconds > 0 ||
    data.active ||
    data.blocked ||
    bootstrap.isFetching ||
    data.conversation.isFetching ||
    bootstrap.data?.availability !== "available" ||
    (!!conversationId && !data.conversation.data);
  // With a proposal in the thread, the composer invites a change as much as another question.
  const hasProposal = data.turns.some(
    (turn) => !!turn.proposal && !!proposals?.accepts(turn.proposal),
  );
  // An installed module adds its requests to empty Home, by this person's permissions, and may say so in the composer. One that
  // attaches a file is offered only to whoever may attach.
  const moduleSuggestions = (proposals?.suggestions?.(user?.permissions ?? []) ?? [])
    .filter((item) => !item.attach || !!bootstrap.data?.attachments);
  const emptyPlaceholder = proposals?.placeholder?.(user?.permissions ?? []) ?? null;
  // Each request on its way shows it on the control that sent it; the cancellation, on the turn it cancels.
  const working = actions.working?.action;
  const cancelling = working === "cancel" ? actions.working?.target : undefined;
  // IA4: a recording travels first, then a photo or a PDF goes up and is read (Stage 3), and the turn travels last, with a spreadsheet
  // or a Word if there is one; the arrow shows the spinner for every step, how much of a file went up and the reading.
  const sendingMedia = dictation.normalizing || !!reading.phase || (working === "submit" && (recorder.state === "ready" || !!attachment));
  const composerDisabled = disabled || dictation.normalizing || !!reading.phase || recorder.state === "starting" || recorder.state === "recording";
  const goesWithTurn = !!attachment && !readsFirst(attachment.file.name);
  const sendLabel = dictation.normalizing ? t("sending")
    : reading.phase === "uploading" ? t("sendingFile", { percent: formatPercent(reading.progress ?? 0, i18n.language) })
    : reading.phase === "reading" ? t("attachment.reading")
    : working === "submit" && goesWithTurn ? t("sendingFile", { percent: formatPercent(actions.progress ?? 0, i18n.language) })
    : t(working === "submit" ? "sending" : "send");
  // What this person may attach, as the bootstrap says it (Stage 2 and 3).
  const kinds = attachmentKinds(bootstrap.data ?? {});
  // What the browser saw that does not serve, or why the server did not take the file: it stays under the composer with the file.
  const attachmentReason = attachment?.problem
    ? problemText(t, i18n.language, attachment.problem, kinds, attachment.file.size)
    : attachment ? actions.fileError ?? reading.fileError : undefined;
  // The clip hides when the file is chosen and the X goes with the file: the focus passes from one to the other, not to <body>.
  function chooseFile(file: File) {
    actions.clearFileError();
    reading.clear();
    setLocalError(undefined);
    flushSync(() => setAttachment({ file, problem: attachmentProblem(file, kinds) }));
    removeButton.current?.focus();
  }
  function removeFile() {
    actions.clearFileError();
    reading.clear();
    flushSync(() => setAttachment(undefined));
    clip.current?.focus();
  }
  async function sendMedia() {
    if (composerDisabled || !bootstrap.data || attachmentReason) return;
    const max = bootstrap.data.limits.questionMaxLength;
    if (draft.trim().length > max) {
      setLocalError(t("questionTooLong", { max }));
      return;
    }
    setLocalError(undefined);
    // After each wait the send checks it was not retired: leaving the conversation discards it, and its turn would reach the old one.
    const generation = sendGeneration.current;
    const recording = recorder.state === "ready" ? recorder.recording : undefined;
    const audioRequestId = recording ? await dictation.normalize(recording) : undefined;
    if (generation !== sendGeneration.current || (recording && !audioRequestId)) return;
    // A photo or a PDF is read first and the turn names its reading; a spreadsheet or a Word goes with the turn.
    const file = attachment?.file;
    const toRead = file && readsFirst(file.name) ? file : undefined;
    const documentRequestId = toRead ? await reading.read(toRead) : undefined;
    if (generation !== sendGeneration.current || (toRead && !documentRequestId)) return;
    // Its acceptance clears the composer (`onAccepted`), also when it is confirmed later.
    await actions.submit(draft, bootstrap.data.connectionRevision,
      conversationId && data.conversation.data ? { id: conversationId, revision: data.conversation.data.revision } : undefined,
      audioRequestId, toRead ? undefined : file, documentRequestId);
  }
  async function submit(question: string) {
    const max = bootstrap.data?.limits.questionMaxLength ?? 4000;
    if (!question.trim()) {
      setLocalError(t("invalidQuestion"));
      return false;
    }
    if (question.trim().length > max) {
      setLocalError(t("questionTooLong", { max }));
      return false;
    }
    if (disabled || !bootstrap.data) return false;
    setLocalError(undefined);
    return actions.submit(
      question,
      bootstrap.data.connectionRevision,
      conversationId && data.conversation.data
        ? { id: conversationId, revision: data.conversation.data.revision }
        : undefined,
    );
  }
  if (forbidden || permissionLost) return <ForbiddenPage />;
  return (
    <Page viewport title={t("common:home.title")}>
      <MessageContext value={context}>
        <AssistantRuntimeProvider
          turns={data.turns}
          running={data.active}
          onSubmit={submit}
          onCancel={async () => {
            if (data.requestId) await actions.cancel(data.requestId);
          }}
          onClear={() => setDraft("")}
          conversationId={conversationId}
          conversations={list.query.data?.items ?? []}
          onChoose={choose}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-4">
            <AccountRecoveryNotice />
            <AssistantWorkspace
              panel={
                <AssistantConversationPanel
                  list={list}
                  timeZone={user?.timeZoneId ?? "UTC"}
                  // While a recording or a document is prepared, its turn still waits for this conversation.
                  disabled={actions.busy || actions.uncertain || dictation.normalizing || !!reading.phase}
                  onCollapse={() => {
                    setPanelExpanded(false);
                    setDrawerOpen(false);
                  }}
                  onDelete={setDeleteId}
                />
              }
              panelLabel={t("conversations")}
              showLabel={t("showConversations")}
              drawerHelp={t("drawerHelp")}
              currentTitle={conversationId ? data.conversation.data?.title ?? t("conversationTitle") : t("newConversation")}
              expanded={panelExpanded}
              onExpandedChange={setPanelExpanded}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={setDrawerOpen}
            >
              {bootstrap.isPending ? (
                <Spinner />
              ) : bootstrap.isError ? (
                <EmptyState
                  title={t("loadingFailed")}
                  action={
                    <Button
                      size="touch"
                      variant="outline"
                      onClick={() => {
                        void bootstrap.refetch();
                      }}
                    >
                      {t("common:actions.retry")}
                    </Button>
                  }
                />
              ) : null}
              {conversationId && data.conversation.isPending ? (
                <Spinner />
              ) : data.blocked || data.unreadable ? (
                <EmptyState
                  title={t(
                    data.unreadable
                      ? "unavailableContent"
                      : data.conversation.data?.contentAccess === "expired"
                        ? "expiredContent"
                        : "blocked",
                  )}
                  action={
                    <Button size="touch" onClick={() => choose(null)}>
                      {t("newConversation")}
                    </Button>
                  }
                />
              ) : conversationId &&
                data.conversation.isError &&
                !data.conversation.data ? (
                <EmptyState
                  title={t("loadingFailed")}
                  action={
                    <Button
                      size="touch"
                      variant="outline"
                      onClick={() => {
                        void data.refetch();
                      }}
                    >
                      {t("common:actions.retry")}
                    </Button>
                  }
                />
              ) : (
                bootstrap.data && (
                  <AssistantThread
                    label={t("thread")}
                    UserMessage={ConfirmedMessage}
                    AssistantMessage={ConfirmedMessage}
                    welcome={
                      !data.turns.length && !data.history.isPending ? (
                        <AssistantWelcome />
                      ) : !conversationId ? (
                        <AssistantWelcome />
                      ) : data.history.isPending ? (
                        <Spinner />
                      ) : null
                    }
                    suggestions={<AssistantSuggestions items={[...moduleSuggestions, ...bootstrap.data.suggestions.slice(0, 3)]}
                      disabled={disabled || dictation.normalizing || !!reading.phase}
                      onChoose={question => {
                        const suggestion = moduleSuggestions.find(item => item.question === question);
                        setDraft(suggestion?.draft ?? question);
                        setLocalError(undefined);
                        // A request that brings a spreadsheet opens the picker, as the clip does.
                        if (suggestion?.attach) fileInput.current?.click();
                      }} />}
                    availability={bootstrap.data.availability !== "available" ? (
                      <div role="status" className="assistant-availability">
                        <span>{t(`availability.${bootstrap.data.availability}`)}</span>
                        {bootstrap.data.configurationDestination === "aiConfiguration" && user?.permissions.includes("ai.read") ? (
                          <Button variant="link" size="inline" asChild><Link to="/configuracion/ia">{t("configuration")}</Link></Button>
                        ) : <Button variant="link" size="inline" pending={rereading === "availability"} onClick={() => { void reread("availability", () => bootstrap.refetch()); }}>
                          {t(rereading === "availability" ? "retrying" : "common:actions.retry")}</Button>}
                      </div>
                    ) : null}
                    operation={
                      <>
                        <span
                          className="sr-only"
                          aria-live="polite"
                          aria-atomic="true"
                        >
                          {data.turn.data?.state === "completed"
                            ? t("states.completed")
                            : ""}
                        </span>
                        {data.history.hasNextPage ? (
                          <Button
                            size="touch"
                            variant="outline"
                            pending={data.history.isFetchingNextPage}
                            onClick={() => {
                              void data.history.fetchNextPage();
                            }}
                          >
                            {t(data.history.isFetchingNextPage ? "loadingMore" : "loadMore")}
                          </Button>
                        ) : null}
                        {data.turns
                          .filter((turn) => turn.state !== "completed")
                          .map((turn) => (
                            <AssistantOperationState
                              key={turn.requestId}
                              turn={turn}
                              busy={actions.busy}
                              cancelling={cancelling === turn.requestId}
                              refreshing={rereading === "status"}
                              onCancel={() => {
                                void actions.cancel(turn.requestId);
                              }}
                              onRefresh={() => {
                                void reread("status", data.refetch);
                              }}
                              onRepeat={() => setRepeat(turn)}
                            />
                          ))}
                        {/* While it reads again the error may clear before the answer arrives: the button stays with its spinner. */}
                        {data.turn.isError || data.history.isError || rereading === "retry" ? (
                          <Button
                            size="touch"
                            variant="outline"
                            pending={rereading === "retry"}
                            onClick={() => {
                              void reread("retry", data.refetch);
                            }}
                          >
                            {t(rereading === "retry" ? "retrying" : "common:actions.retry")}
                          </Button>
                        ) : null}
                        {actions.uncertain ? (
                          <div
                            role="status"
                            className="flex flex-wrap items-center gap-3 py-3"
                          >
                            <span>{t("acceptanceState")}</span>
                            <Button
                              size="touch"
                              variant="outline"
                              disabled={actions.busy}
                              pending={working === "recover"}
                              onClick={() => {
                                void actions.recover();
                              }}
                            >
                              {t(working === "recover" ? "checking" : "checkStatus")}
                            </Button>
                            <Button
                              size="touch"
                              variant="outline"
                              disabled={actions.busy}
                              pending={working === "retry"}
                              onClick={() => {
                                void actions.retryIdentical();
                              }}
                            >
                              {t(working === "retry" ? "sending" : "repeatIdentical")}
                            </Button>
                          </div>
                        ) : null}
                        {actions.cooldownSeconds > 0 ? (
                          <p role="status">
                            {/* The daily quota renews at 00:00 UTC: its wait says that hour in the profile's zone, not hours of seconds. */}
                            {actions.quotaRenewsAtUtc
                              ? t("quotaRenews", { time: formatTimeInZone(actions.quotaRenewsAtUtc, i18n.language, user?.timeZoneId) })
                              : t("cooldown", { seconds: actions.cooldownSeconds })}
                          </p>
                        ) : null}
                      </>
                    }
                    composer={
                      <AssistantComposer
                        label={t("question")}
                        hint={t("keyboardHelp")}
                        placeholder={recorder.state === "ready" || attachment ? t("placeholderOptional")
                          : hasProposal ? t("placeholderProposal") : (emptyPlaceholder ?? t("placeholder"))}
                        sendLabel={sendLabel}
                        sending={working === "submit" || dictation.normalizing || !!reading.phase}
                        value={draft}
                        onValueChange={(value) => {
                          setDraft(value);
                          setLocalError(undefined);
                        }}
                        disabled={composerDisabled}
                        error={localError ?? attachmentReason ?? dictation.error ?? reading.error ?? (recorder.denied ? t("audio.denied") : undefined)
                          ?? actions.fieldError}
                        attach={canAttach(kinds) ? (
                          <AssistantAttach label={t(kinds.word || kinds.reading ? "attachment.attachFile" : "attachment.attach")}
                            accept={attachmentAccept(kinds)} inputRef={fileInput} buttonRef={clip}
                            disabled={composerDisabled} showButton={!attachment} onChoose={chooseFile} />
                        ) : undefined}
                        record={bootstrap.data.audio && recorder.supported && recorder.state === "idle"
                          ? { label: t("audio.record"), onStart: () => { dictation.clearError(); void recorder.start(); } } : undefined}
                        recorder={recorder.state === "recording" || recorder.state === "ready" ? (
                          <AssistantRecorder recording={recorder.state === "ready" ? recorder.recording : undefined}
                            status={t("audio.recordingStatus", { time: elapsed(recorder.seconds) })} audioLabel={t("audio.yours")}
                            discardLabel={t("audio.discard")} stopLabel={t("audio.stop")} disabled={sendingMedia}
                            onDiscard={() => { dictation.clearError(); recorder.discard(); }} onStop={recorder.stop} />
                        ) : undefined}
                        attachment={attachment ? (
                          <AssistantFile name={attachment.file.name} removeLabel={t("attachment.remove", { name: attachment.file.name })}
                            description={describeFile(t, i18n.language, { kind: fileExtension(attachment.file.name), size: attachment.file.size })}
                            removeRef={removeButton} disabled={sendingMedia} onRemove={removeFile} />
                        ) : undefined}
                        onSendMedia={recorder.state === "ready" || attachment ? () => void sendMedia() : undefined}
                      />
                    }
                  />
                )
              )}
            </AssistantWorkspace>
          </div>
          {/* While «Cancelar y continuar» waits, the decision stays open with its spinner and the other choices are off;
              the button stays even if the canceled turn stops being active before the answer is confirmed. */}
          <Dialog
            open={nextConversation !== undefined}
            onOpenChange={(open) => {
              if (!open && !cancelling) setNextConversation(undefined);
            }}
          >
            <DialogContent onCloseAutoFocus={restoreDecision} closeDisabledReason={cancelling ? t("canceling") : undefined}>
              <DialogHeader>
                <DialogTitle>{t("newTitle")}</DialogTitle>
                <DialogDescription>{t("newHelp")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  size="touch"
                  variant="outline"
                  disabled={!!cancelling}
                  onClick={() => setNextConversation(undefined)}
                >
                  {t("keepEditing")}
                </Button>
                {(data.active && data.requestId) || cancelling ? (
                  <Button
                    size="touch"
                    variant="outline"
                    disabled={actions.busy}
                    pending={!!cancelling}
                    onClick={async () => {
                      if (await actions.cancel(data.requestId!)) {
                        go(nextConversation ?? null);
                        setNextConversation(undefined);
                      }
                    }}
                  >
                    {t(cancelling ? "canceling" : "cancelAndContinue")}
                  </Button>
                ) : null}
                <Button
                  size="touch"
                  disabled={!!cancelling}
                  onClick={() => {
                    go(nextConversation ?? null);
                    setNextConversation(undefined);
                  }}
                >
                  {t(data.active || cancelling ? "continueBackground" : "newConversation")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <ConfirmDialog
            actionSize="touch"
            open={!!deleteId}
            onOpenChange={(open) => {
              if (!open) setDeleteId(undefined);
            }}
            title={t("deleteTitle")}
            description={t("deleteHelp")}
            destructive
            confirmLabel={t("delete")}
            // The confirmation waits open with «Eliminando…» and closes with the answer, also when it fails.
            pending={working === "remove"}
            pendingLabel={t("deleting")}
            onConfirm={() => {
              const id = deleteId!;
              void actions.remove(id).then((removed) => {
                setDeleteId(undefined);
                if (removed && id === conversationId) go(null);
              });
            }}
          />
          <ConfirmDialog
            actionSize="touch"
            open={navigation.isBlocked}
            onOpenChange={(open) => {
              if (!open) navigation.stay();
            }}
            title={t("newTitle")}
            description={t(actions.uncertain ? "acceptanceUncertain" : "newHelp")}
            confirmLabel={t(actions.uncertain ? "checkStatus" : "newConversation")}
            cancelLabel={t("keepEditing")}
            onConfirm={() => {
              if (actions.uncertain) {
                navigation.stay();
                void actions.recover();
              } else {
                // Leaving discards the draft whole: the text, the file and the recording, and what was being prepared to send them.
                retireSend();
                dictation.cancel();
                reading.cancel();
                setDraft("");
                setAttachment(undefined);
                recorder.discard();
                setAccepted(undefined);
                navigation.leave();
              }
            }}
          />
          <ConfirmDialog
            actionSize="touch"
            open={!!repeat}
            onOpenChange={(open) => {
              if (!open) setRepeat(undefined);
            }}
            title={t("repeatTitle")}
            description={t("repeatHelp")}
            confirmLabel={t("prepareAgain")}
            onConfirm={() => {
              setDraft(repeat?.question ?? "");
              setRepeat(undefined);
            }}
          />
        </AssistantRuntimeProvider>
      </MessageContext>
    </Page>
  );
}
