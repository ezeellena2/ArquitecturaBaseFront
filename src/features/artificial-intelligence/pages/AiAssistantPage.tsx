import {
  createContext,
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
import { assistantKey, isActiveTurn } from "../assistant/model";
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
  const message = useAuiState((state) => state.message);
  const requestId = message.metadata.custom.requestId;
  const turn = value.turns.find((item) => item.requestId === requestId);
  if (!turn) return null;
  const role = message.role === "user" ? "user" : "assistant";
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
    ["conversacion"],
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
                  void data.refetch();
                },
              }
            : undefined,
      });
    }
  }, [data, userId, t, accepted]);
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
                        ) : <Button variant="link" size="inline" onClick={() => { void bootstrap.refetch(); }}>{t("common:actions.retry")}</Button>}
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
                            disabled={data.history.isFetchingNextPage}
                            onClick={() => {
                              void data.history.fetchNextPage();
                            }}
                          >
                            {t("loadMore")}
                          </Button>
                        ) : null}
                        {data.turns
                          .filter((turn) => turn.state !== "completed")
                          .map((turn) => (
                            <AssistantOperationState
                              key={turn.requestId}
                              turn={turn}
                              busy={actions.busy}
                              onCancel={() => {
                                void actions.cancel(turn.requestId);
                              }}
                              onRefresh={() => {
                                void data.refetch();
                              }}
                              onRepeat={() => setRepeat(turn)}
                            />
                          ))}
                        {data.turn.isError || data.history.isError ? (
                          <Button
                            size="touch"
                            variant="outline"
                            onClick={() => {
                              void data.refetch();
                            }}
                          >
                            {t("common:actions.retry")}
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
                              onClick={() => {
                                void actions.recover();
                              }}
                            >
                              {t("checkStatus")}
                            </Button>
                            <Button
                              size="touch"
                              variant="outline"
                              disabled={actions.busy}
                              onClick={() => {
                                void actions.retryIdentical();
                              }}
                            >
                              {t("repeatIdentical")}
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
                        placeholder={t("placeholder")}
                        sendLabel={t("send")}
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
          <Dialog
            open={nextConversation !== undefined}
            onOpenChange={(open) => {
              if (!open) setNextConversation(undefined);
            }}
          >
            <DialogContent onCloseAutoFocus={restoreDecision}>
              <DialogHeader>
                <DialogTitle>{t("newTitle")}</DialogTitle>
                <DialogDescription>{t("newHelp")}</DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  size="touch"
                  variant="outline"
                  onClick={() => setNextConversation(undefined)}
                >
                  {t("keepEditing")}
                </Button>
                {data.active && data.requestId ? (
                  <Button
                    size="touch"
                    variant="outline"
                    disabled={actions.busy}
                    onClick={async () => {
                      if (await actions.cancel(data.requestId!)) {
                        go(nextConversation ?? null);
                        setNextConversation(undefined);
                      }
                    }}
                  >
                    {t("cancelAndContinue")}
                  </Button>
                ) : null}
                <Button
                  size="touch"
                  onClick={() => {
                    go(nextConversation ?? null);
                    setNextConversation(undefined);
                  }}
                >
                  {t(data.active ? "continueBackground" : "newConversation")}
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
            onConfirm={() => {
              const id = deleteId!;
              void actions.remove(id).then((removed) => {
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
