import { useContext, useRef, useState } from "react";
import { ThreadListPrimitive, ThreadListItemPrimitive, ThreadListItemMorePrimitive, useAuiState } from "@assistant-ui/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/ui/button";
import { IconButton } from "@/shared/ui/IconButton";
import { TrashIcon } from "@/shared/ui/icons";
import { ConversationActions } from "./conversationActions";

/** Read indices from the runtime snapshot so newly accepted rows cannot outrun its update. */
export function ConversationGroups({ groups }: { groups: readonly { label: string; ids: readonly string[] }[] }) {
  const threadIds = useAuiState(state => state.threads.threadIds);
  return <>{groups.map(group => {
    const members = threadIds.map((id, index) => ({ id, index })).filter(item => group.ids.includes(item.id));
    return members.length ? <section key={group.label}><h3>{group.label}</h3><ul>{members.map(item => <li key={item.id}><ThreadListPrimitive.ItemByIndex index={item.index} components={{ ThreadListItem: ConversationRow }} /></li>)}</ul></section> : null;
  })}</>;
}

/** The library owns selection, title scope and menu focus. The board owns deletion confirmation. */
export function ConversationRow() {
  const { t } = useTranslation("conversationPreview");
  const { disabled, requestDelete } = useContext(ConversationActions);
  const id = useAuiState(state => state.threadListItem.id);
  const title = useAuiState(state => state.threadListItem.title) ?? t("generic");
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return <ThreadListItemPrimitive.Root className="conversation-list-row">
    <ThreadListItemPrimitive.Trigger asChild disabled={disabled}>
      <Button variant="ghost" className="conversation-select"><span className="conversation-label"><ThreadListItemPrimitive.Title fallback={t("generic")} /></span></Button>
    </ThreadListItemPrimitive.Trigger>
    <ThreadListItemMorePrimitive.Root sharedFocusGroup open={menuOpen} onOpenChange={setMenuOpen}>
      <ThreadListItemMorePrimitive.Trigger asChild disabled={disabled} ref={triggerRef}>
        <IconButton className="conversation-more-trigger" size="icon-sm" label={t("moreActions", { title })}><span aria-hidden="true" className="conversation-ellipsis">…</span></IconButton>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content className="conversation-actions-menu" align="start">
        <ThreadListItemMorePrimitive.Item className="conversation-actions-delete" onSelect={() => {
          setMenuOpen(false);
          // ConfirmDialog must capture a persistent trigger, rather than a disappearing menu item.
          triggerRef.current?.focus();
          requestDelete(id);
        }}><TrashIcon />{t("delete")}</ThreadListItemMorePrimitive.Item>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  </ThreadListItemPrimitive.Root>;
}
