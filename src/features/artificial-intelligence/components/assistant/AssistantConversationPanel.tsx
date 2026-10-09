import { useEffect, useState } from "react";
import { ThreadListPrimitive } from "@assistant-ui/react";
import { useTranslation } from "react-i18next";
import { AssistantConversationList } from "@/shared/ui/assistant/AssistantConversationList";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { ChevronLeftIcon, PencilIcon } from "@/shared/ui/icons";
import { Pagination } from "@/shared/ui/Pagination";
import { EmptyState } from "@/shared/ui/EmptyState";
import { Spinner } from "@/shared/ui/Spinner";
import { conversationGroups } from "../../assistant/conversationGroups";
import type { useAssistantConversationList } from "../../hooks/useAssistantConversationList";

export function AssistantConversationPanel({ list, timeZone, disabled, onCollapse, onDelete }: {
  list: ReturnType<typeof useAssistantConversationList>;
  timeZone: string;
  disabled: boolean;
  onCollapse: () => void;
  onDelete: (id: string) => void;
}) {
  const { t } = useTranslation(["assistant", "common"]);
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const refresh = () => { if (document.visibilityState === "visible") setNow(new Date().toISOString()); };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const { query, pagination } = list;
  const groups = conversationGroups(query.data?.items ?? [], now, timeZone).map(group => ({ label: t(`groups.${group.key}`), ids: group.ids }));
  return <ThreadListPrimitive.Root className="conversation-panel-body">
    <div className="conversation-panel-heading"><h2>{t("conversations")}</h2><IconButton label={t("hideConversations")} onClick={onCollapse}><ChevronLeftIcon /></IconButton></div>
    <div className="conversation-new"><ThreadListPrimitive.New asChild disabled={disabled}><Button className="w-full justify-start gap-2" variant="ghost"><PencilIcon />{t("newConversation")}</Button></ThreadListPrimitive.New></div>
    <div className="conversation-list" aria-busy={query.isFetching}>
      {query.isPending ? <div className="conversation-list-status" role="status"><Spinner />{t("loadingHistory")}</div>
        : !query.data && query.isError ? <EmptyState embedded title={t("historyLoadingFailed")} action={<Button variant="outline" onClick={() => { void query.refetch(); }}>{t("common:actions.retry")}</Button>} />
        : !query.data?.items.length ? <p className="conversation-empty-history">{t("emptyHistory")}</p>
        : <AssistantConversationList groups={groups} disabled={disabled} genericTitle={t("conversationTitle")} moreLabel={title => t("conversationActions", { title })} deleteLabel={t("delete")} onDelete={onDelete} />}
    </div>
    {query.data?.totalCount ? <div className="conversation-pagination"><Pagination {...query.data} hasPrevious={!disabled && query.data.hasPrevious} hasNext={!disabled && query.data.hasNext} onPageChange={pagination.setPage} /></div> : null}
  </ThreadListPrimitive.Root>;
}
