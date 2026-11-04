import { createContext, type ComponentType } from "react";

/** A proposal a Home answer closed on: the engine names it and its owner module decides how it reads and what it creates. */
export interface AssistantProposal {
  readonly id: string;
  readonly capability: string;
  readonly version: number;
  readonly content: unknown;
}
export interface AssistantProposalCardProps {
  /** The request of the turn that brought it: creating names the turn and the proposal, nothing else. */
  readonly requestId: string;
  readonly proposal: AssistantProposal;
  /** The proposal of the same capability this one replaced in the conversation, to mark what changed. */
  readonly previous: AssistantProposal | null;
  /** A later proposal of the same capability replaced this one: it folds to one line and can no longer be created. */
  readonly replaced: boolean;
}
export interface AssistantProposalExtension {
  readonly accepts: (proposal: AssistantProposal) => boolean;
  readonly Card: ComponentType<AssistantProposalCardProps>;
}
/** App composes the cards of the installed modules. The assistant never imports a module: without one, the answer reads alone. */
export const AssistantProposalContext = createContext<AssistantProposalExtension | null>(null);
