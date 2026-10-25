import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router";
import { useQueryUpdate } from "@/shared/hooks/useQueryUpdate";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "@/auth/useCurrentUser";
import { usePermissions } from "@/auth/usePermissions";
import { Page } from "@/shared/ui/Page";
import { Surface } from "@/shared/ui/Surface";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { useUnsavedChangesGuard } from "@/shared/hooks/useUnsavedChangesGuard";
import { cn } from "@/shared/lib/utils";
import { ApiError } from "@/shared/api/ApiError";
import { listChats } from "../api/chat";
import { ChatThread } from "../components/ChatThread";
import type { ChatDraft } from "../components/ChatComposer";
import { useVisibleChat } from "../hooks/useChatThread";
import { chatReadScopeKey, useChatReadCleanup } from "../hooks/useChatReadScope";
import { previewText } from "../lib/messagePresentation";

export function WhatsAppChatPage() {
  const { data: user } = useCurrentUser();
  return user ? <Inbox key={user.id} actor={user.id} timeZone={user.timeZoneId} /> : null;
}

function Inbox({ actor, timeZone }: { actor: string; timeZone: string }) {
  const { t, i18n } = useTranslation("whatsapp");
  const { has, permissions } = usePermissions();
  const readScope = { actor, culture: i18n.resolvedLanguage ?? "es", permissions };
  const listRoot = [...chatReadScopeKey(readScope), "list"] as const;
  useChatReadCleanup(listRoot);
  const [params] = useSearchParams();
  const updateQuery = useQueryUpdate();
  const selected = params.get("conversacion") || undefined;
  const setSelected = (id: string | undefined) => updateQuery({ conversacion: id }, { replace: false });
  const [search, setSearch] = useState("");
  const [unread, setUnread] = useState(false);
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, ChatDraft>>({});
  const guard = useUnsavedChangesGuard(Object.values(drafts).some(draft => Boolean(draft.body.trim()) || Boolean(draft.attempt) || Boolean(draft.form?.touched) || Boolean(draft.form?.attempt)));
  const visible = useVisibleChat();
  const list = useQuery({ queryKey: [...listRoot, page, search, unread], enabled: has("whatsapp.read"), queryFn: async ({ signal }) => {
      const result = await listChats(page, search, unread, signal);
      signal.throwIfAborted();
      return result;
    },
    refetchInterval: query => query.state.error instanceof ApiError && query.state.error.status === 403 ? false : visible ? 5000 : false });
  return (
    // Un refresco fallido conserva la bandeja visible y lo avisa la notificación común de la consulta (QueryCache):
    // `status` muestra sólo el estado del objeto, y el cuerpo dice que no se pudo cargar sólo si no hay nada que mostrar.
    <Page title={t("title")}
      actions={<Button variant="outline" size="sm" onClick={() => void list.refetch()}>{t("refreshAction")}</Button>}>
      <Surface>
        <div className="grid h-[calc(100svh-10rem)] min-h-[30rem] grid-cols-1 xl:grid-cols-[280px_minmax(0,1fr)]">
          <div className={cn("flex min-h-0 flex-col border-r border-[var(--color-border)]", selected ? "max-xl:hidden" : "")}>
            <div className="flex flex-col gap-3 border-b border-[var(--color-border)] p-3">
              <label htmlFor="chat-search" className="sr-only">{t("search")}</label>
              <Input id="chat-search" value={search} placeholder={t("search")} onChange={event => { setSearch(event.target.value); setPage(1); }} />
              <div className="flex gap-2"><Button size="sm" variant={!unread ? "default" : "outline"} onClick={() => { setUnread(false); setPage(1); }}>{t("all", { count: list.data?.allCount ?? 0 })}</Button>
                <Button size="sm" variant={unread ? "default" : "outline"} onClick={() => { setUnread(true); setPage(1); }}>{t("unread", { count: list.data?.unreadCount ?? 0 })}</Button></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto" aria-label={t("conversations")}>
              {list.isPending ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("loading")}</p> : null}
              {list.isError && !list.data ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t("loadFailed")}</p> : null}
              {list.data?.page.items.map(chat => <div key={chat.id} className={cn("border-b border-[var(--color-border)] p-2", selected === chat.id ? "bg-[var(--color-surface-muted)]" : "")}>
                <Button variant="ghost" className="w-full justify-start text-left" aria-label={chat.profileName ?? chat.phoneNumber ?? t("unnamed")} aria-pressed={selected === chat.id} onClick={() => setSelected(chat.id)}>
                  <span className="flex w-full min-w-0 items-center justify-between gap-2"><span className="min-w-0 flex-1 truncate">{chat.profileName ?? chat.phoneNumber ?? t("unnamed")}</span>{chat.mode === "Assistant" ? <Badge variant="outline">{t("mode.Assistant")}</Badge> : null}{chat.unreadCount ? <span className="text-xs">{chat.unreadCount}</span> : null}</span>
                </Button>
                <p className="truncate px-2 text-xs text-[var(--color-content-muted)]">{drafts[chat.id]?.body ? t("draft") : previewText(t, chat.previewPurpose, chat.previewAccessEventKind, chat.preview)}</p>
              </div>)}
              {list.data?.page.items.length === 0 ? <p className="p-4 text-sm text-[var(--color-content-muted)]">{t(search || unread ? "noResults" : "empty")}</p> : null}
            </div>
            {list.data && list.data.page.totalPages > 1 ? <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] p-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(value => value - 1)}>{t("previous")}</Button><span className="text-xs">{page} / {list.data.page.totalPages}</span><Button variant="outline" size="sm" disabled={page >= list.data.page.totalPages} onClick={() => setPage(value => value + 1)}>{t("next")}</Button>
            </div> : null}
          </div>
          <div className={cn("min-h-0 min-w-0", selected ? "" : "max-xl:hidden")}>
            {selected ? <ChatThread key={selected} id={selected} actor={actor} readPermissions={permissions} timeZone={timeZone} canSend={has("whatsapp.send")} canConfigureAssistant={has("whatsapp.configureassistant")} draft={drafts[selected] ?? { body: "" }}
              updateDraft={update => setDrafts(current => ({ ...current, [selected]: update(current[selected] ?? { body: "" }) }))} onBack={() => setSelected(undefined)} /> :
              <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[var(--color-content-muted)]">{t("select")}</div>}
          </div>
        </div>
      </Surface>
      <ConfirmDialog open={guard.isBlocked} onOpenChange={open => { if (!open) guard.stay(); }} title={t("leave.title")} description={t("leave.description")} confirmLabel={t("leave.confirm")} cancelLabel={t("leave.cancel")} destructive onConfirm={guard.leave} />
    </Page>
  );
}
