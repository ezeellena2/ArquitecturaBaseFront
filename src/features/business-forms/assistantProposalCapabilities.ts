import type { AssistantProposal } from "@/shared/hooks/assistantProposalContext";

// The proposals of this module that Home can close on (IA1-A). Light on purpose: App reads it before loading the card.
export const proposalCapabilities = {
  form: "forms.authoring.propose-form",
  catalog: "forms.authoring.propose-catalog",
  people: "forms.catalog-filters.propose",
} as const;
const accepted: readonly string[] = Object.values(proposalCapabilities);
export const acceptsProposal = (proposal: AssistantProposal) => proposal.version === 1 && accepted.includes(proposal.capability);
