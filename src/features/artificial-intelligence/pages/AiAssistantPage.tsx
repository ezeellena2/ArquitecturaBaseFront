import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useSearchParams, Link } from "react-router";
import { useAuiState } from "@assistant-ui/react";
import { useCurrentUser, currentUserQueryKey } from "@/auth/useCurrentUser";
import { AccountRecoveryNotice } from "@/auth/components/AccountRecoveryNotice";
import { ApiError } from "@/shared/api/ApiError";
import { AssistantProposalContext } from "@/shared/hooks/assistantProposalContext";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useRestoreFocusOnClose } from "@/shared/hooks/useRestoreFocusOnClose";
import { formatTimeInZone } from "@/shared/lib/dateTime";
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
import { AssistantSuggestions } from "@/shared/ui/assistant/AssistantSuggestions";
import { notify } from "@/shared/ui/notifications";
import {
  assistantApi,
  type AssistantAccepted,
  type AssistantState,
  type AssistantTurn,
} from "../api/assistant";
import { assistantKey, isActiveTurn, proposalNeighbors } from "../assistant/model";
import { useAssistantConversation } from "../hooks/useAssistantConversation";
import { useAssistantTurnActions } from "../hooks/useAssistantTurnActions";
import { AssistantRuntimeProvider } from "../components/assistant/AssistantRuntimeProvider";
import { AssistantWelcome } from "../components/assistant/AssistantWelcome";
import { AssistantSources } from "../components/assistant/AssistantSources";
import { AssistantOperationState } from "../components/assistant/AssistantOperationState";
import { AssistantConversationPanel } from "../components/assistant/AssistantConversationPanel";
import { AssistantWorkspace } from "@/shared/ui/assistant/AssistantWorkspace";
import { useAssistantConversationList } from "../hooks/useAssistantConversationList";
const announcedStates: readonly AssistantState[] = [
  "failed",
  "uncertain",
  "expired",
];
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
      ? { ...proposalNeighbors(value.turns, turn), Card: proposals.Card }
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
  const [draft, setDraft] = useState("");
  const [localError, setLocalError] = useState<string>();
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
    onAccepted: (value) => {
      setAccepted(value);
      setDraft("");
      navigation.allowNextNavigation();
      setDrawerOpen(false);
      update({ conversacion: value.conversationId, page: undefined });
    },
    onForbidden: () => {
      setDraft("");
      setForbidden(true);
      void client.invalidateQueries({ queryKey: currentUserQueryKey });
    },
  });
  const navigation = useUnsavedChangesGuard(
    !!draft.trim() || actions.uncertain,
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
  // Each request on its way shows it on the control that sent it; the cancellation, on the turn it cancels.
  const working = actions.working?.action;
  const cancelling = working === "cancel" ? actions.working?.target : undefined;
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
                  disabled={actions.busy || actions.uncertain}
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
              ) : data.blocked ? (
                <EmptyState
                  title={t(
                    data.conversation.data?.contentAccess === "expired"
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
                    suggestions={<AssistantSuggestions items={bootstrap.data.suggestions.slice(0, 3)} disabled={disabled}
                      onChoose={question => { setDraft(question); setLocalError(undefined); }} />}
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
                            {t("cooldown", { seconds: actions.cooldownSeconds })}
                          </p>
                        ) : null}
                      </>
                    }
                    composer={
                      <AssistantComposer
                        label={t("question")}
                        hint={t("keyboardHelp")}
                        placeholder={t(hasProposal ? "placeholderProposal" : "placeholder")}
                        sendLabel={t(working === "submit" ? "sending" : "send")}
                        sending={working === "submit"}
                        value={draft}
                        onValueChange={(value) => {
                          setDraft(value);
                          setLocalError(undefined);
                        }}
                        disabled={disabled}
                        error={localError ?? actions.fieldError}
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
                setDraft("");
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
