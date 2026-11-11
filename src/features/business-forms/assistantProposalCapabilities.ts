import type { AssistantDraftSuggestion, AssistantProposal } from "@/shared/hooks/assistantProposalContext";

// The proposals of this module that Home can close on (IA1-A). Light on purpose: App reads it before loading the card.
export const proposalCapabilities = {
  form: "forms.authoring.propose-form",
  catalog: "forms.authoring.propose-catalog",
  catalogImport: "forms.authoring.propose-import",
  people: "forms.catalog-filters.propose",
} as const;
// The versions the card draws: version 2 of the catalog maps the turn's spreadsheet; version 1 still reads in older turns.
const versions = new Map<string, readonly number[]>([
  [proposalCapabilities.form, [1]],
  [proposalCapabilities.catalog, [1, 2]],
  [proposalCapabilities.catalogImport, [1]],
  [proposalCapabilities.people, [1]],
]);
export const acceptsProposal = (proposal: AssistantProposal) => versions.get(proposal.capability)?.includes(proposal.version) ?? false;
// A catalog and an import into one that exists replace each other in the conversation; the form and the people catalog
// keep their own group.
export const proposalReplacementGroup = (proposal: AssistantProposal) =>
  proposal.capability === proposalCapabilities.catalog || proposal.capability === proposalCapabilities.catalogImport ? "forms.catalogs" : proposal.capability;
type Translate = (key: string, options?: Record<string, unknown>) => string;
// Empty Home suggests building a form to whoever can design forms and a catalog from a spreadsheet, which also opens the file
// picker, to whoever manages catalogs (IA4); the request stays in the composer.
export const formsAssistantSuggestions = (permissions: readonly string[], t: Translate): readonly AssistantDraftSuggestion[] => [
  ...(permissions.includes("formtemplates.manage")
    ? [{ id: "forms.build-form", question: t("assistantProposals.suggestions.form"), draft: t("assistantProposals.entries.form") }]
    : []),
  ...(permissions.includes("formcatalogs.manage")
    ? [{ id: "forms.build-catalog", question: t("assistantProposals.suggestions.catalog"), draft: t("assistantProposals.suggestions.catalog"), attach: true }]
    : []),
];
export const formsAssistantPlaceholder = (permissions: readonly string[], t: Translate) =>
  permissions.includes("formtemplates.manage") ? t("assistantProposals.placeholder") : null;
