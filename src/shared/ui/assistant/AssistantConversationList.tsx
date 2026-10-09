import { useContext, useRef, useState } from "react";
import { ThreadListPrimitive, ThreadListItemPrimitive, ThreadListItemMorePrimitive, useAuiState } from "@assistant-ui/react";
import { Button } from "../button";
import { IconButton } from "../IconButton";
import { TrashIcon } from "../icons";
import { ConversationActions } from "./conversationActions";

export interface AssistantConversationGroup { readonly label: string; readonly ids: readonly string[] }

export function AssistantConversationList({ groups, disabled, genericTitle, moreLabel, deleteLabel, onDelete }: {
  groups: readonly AssistantConversationGroup[];
  disabled: boolean;
  genericTitle: string;
  moreLabel: (title: string) => string;
  deleteLabel: string;
  onDelete: (id: string) => void;
}) {
  const threadIds = useAuiState(state => state.threads.threadIds);
  return <ConversationActions value={{ disabled, genericTitle, moreLabel, deleteLabel, requestDelete: onDelete }}>
    {groups.map(group => {
      // Indices must belong to the native snapshot, even while a confirmed page is being adapted.
      const members = threadIds.map((id, index) => ({ id, index })).filter(item => group.ids.includes(item.id));
      return members.length ? <section key={group.label}><h3>{group.label}</h3><ul>{members.map(item => <li key={item.id}><ThreadListPrimitive.ItemByIndex index={item.index} components={{ ThreadListItem: ConversationRow }} /></li>)}</ul></section> : null;
    })}
  </ConversationActions>;
}

function ConversationRow() {
  const actions = useContext(ConversationActions);
  const id = useAuiState(state => state.threadListItem.id);
  const title = useAuiState(state => state.threadListItem.title) ?? actions.genericTitle;
  const [menuOpen, setMenuOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  return <ThreadListItemPrimitive.Root className="conversation-list-row">
    <ThreadListItemPrimitive.Trigger asChild disabled={actions.disabled}>
      <Button variant="ghost" className="conversation-select"><span className="conversation-label"><ThreadListItemPrimitive.Title fallback={actions.genericTitle} /></span></Button>
    </ThreadListItemPrimitive.Trigger>
    <ThreadListItemMorePrimitive.Root sharedFocusGroup open={menuOpen} onOpenChange={setMenuOpen}>
      <ThreadListItemMorePrimitive.Trigger asChild disabled={actions.disabled} ref={trigger}>
        <IconButton className="conversation-more-trigger" size="icon-sm" label={actions.moreLabel(title)}><span aria-hidden="true" className="conversation-ellipsis">…</span></IconButton>
      </ThreadListItemMorePrimitive.Trigger>
      <ThreadListItemMorePrimitive.Content className="conversation-actions-menu" align="start">
        <ThreadListItemMorePrimitive.Item className="conversation-actions-delete" onSelect={() => {
          setMenuOpen(false);
          // The confirmation captures a persistent row action instead of a disappearing menu item.
          trigger.current?.focus();
          actions.requestDelete(id);
        }}><TrashIcon />{actions.deleteLabel}</ThreadListItemMorePrimitive.Item>
      </ThreadListItemMorePrimitive.Content>
    </ThreadListItemMorePrimitive.Root>
  </ThreadListItemPrimitive.Root>;
}
