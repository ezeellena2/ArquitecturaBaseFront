import type { ComponentType } from "react";
import { BanIcon, BookIcon, ChatIcon, FormIcon, ListIcon, UserIcon } from "@/shared/ui/icons";
import { agentActionKinds, type AgentActionKind } from "../api/assistantAgent";
import type { DraftProfile } from "../lib/assistantAgentDraft";

/** The icon of each action of «Qué hacer» (AS2 and AS5): the same in the list, in Límites and in a test. */
export const actionIcons: Record<AgentActionKind, ComponentType<{ className?: string }>> = {
  SendForm: FormIcon, ExactText: ChatIcon, DraftedReply: BookIcon, AskButtons: ListIcon, Handoff: UserIcon, NoReply: BanIcon,
};

// Where Guardar takes the focus when it finds a problem: the field, or the row of the case.
export const profileFieldId = (field: keyof DraftProfile) => "agent-profile-" + field;
export const limitsFieldId = { topics: "agent-limits-topics", cannotPromise: "agent-limits-cannot-promise", maxReplyLength: "agent-limits-max-length",
  dailyReplyLimit: "agent-limits-daily", allowedActions: "agent-limits-action-" + agentActionKinds[0] } as const;
export const caseRowId = (id: string) => "agent-case-" + id;
export const fallbackRowId = "agent-case-fallback";
