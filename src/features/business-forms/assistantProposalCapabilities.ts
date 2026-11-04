import type { AssistantDraftSuggestion, AssistantProposal } from "@/shared/hooks/assistantProposalContext";

// The proposals of this module that Home can close on (IA1-A). Light on purpose: App reads it before loading the card.
export const proposalCapabilities = {
  form: "forms.authoring.propose-form",
  catalog: "forms.authoring.propose-catalog",
  people: "forms.catalog-filters.propose",
} as const;
const accepted: readonly string[] = Object.values(proposalCapabilities);
export const acceptsProposal = (proposal: AssistantProposal) => proposal.version === 1 && accepted.includes(proposal.capability);
type Translate = (key: string, options?: Record<string, unknown>) => string;
// Empty Home suggests building a form to whoever can design forms (IA4); a catalog from a spreadsheet arrives with the clip.
export const formsAssistantSuggestions = (permissions: readonly string[], t: Translate): readonly AssistantDraftSuggestion[] =>
  permissions.includes("formtemplates.manage")
    ? [{ id: "forms.build-form", question: t("assistantProposals.suggestions.form"), draft: t("assistantProposals.entries.form") }]
    : [];
export const formsAssistantPlaceholder = (permissions: readonly string[], t: Translate) =>
  permissions.includes("formtemplates.manage") ? t("assistantProposals.placeholder") : null;
