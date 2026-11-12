import { describe, expect, it } from "vitest";
import { acceptsProposal, formsAssistantSuggestions, proposalCapabilities, proposalReplacementGroup } from "./assistantProposalCapabilities";

const proposal = (capability: string, version = 1) => ({ id: "01990000-0000-7000-8000-000000000041", capability, version, content: {} });
const t = (key: string) => key;

describe("the proposals Home can close on for the forms module", () => {
  it("accepts version 1 of each capability, the catalog that maps a spreadsheet and the form with a document (version 2), and nothing else", () => {
    for (const capability of Object.values(proposalCapabilities)) expect(acceptsProposal(proposal(capability))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.catalog, 2))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.form, 2))).toBe(true);
    expect(acceptsProposal(proposal(proposalCapabilities.form, 3))).toBe(false);
    expect(acceptsProposal(proposal(proposalCapabilities.catalogImport, 2))).toBe(false);
    expect(acceptsProposal(proposal(proposalCapabilities.people, 2))).toBe(false);
    expect(acceptsProposal(proposal(proposalCapabilities.catalog, 3))).toBe(false);
    expect(acceptsProposal(proposal("fixture.propose"))).toBe(false);
  });

  it("puts the catalog, in both versions, and the import in one replacement group; the form and the people catalog keep their own", () => {
    const catalog = proposalReplacementGroup(proposal(proposalCapabilities.catalog));
    expect(proposalReplacementGroup(proposal(proposalCapabilities.catalog, 2))).toBe(catalog);
    expect(proposalReplacementGroup(proposal(proposalCapabilities.form, 2))).toBe(proposalReplacementGroup(proposal(proposalCapabilities.form)));
    expect(proposalReplacementGroup(proposal(proposalCapabilities.catalogImport))).toBe(catalog);
    const others = [proposalCapabilities.form, proposalCapabilities.people].map(capability => proposalReplacementGroup(proposal(capability)));
    expect(new Set([catalog, ...others]).size).toBe(3);
  });

  it("suggests building a form to whoever designs forms and a catalog from a spreadsheet, with the file picker, to whoever manages catalogs", () => {
    expect(formsAssistantSuggestions(["formtemplates.read", "formtemplates.manage"], t)).toEqual([
      { id: "forms.build-form", question: "assistantProposals.suggestions.form", draft: "assistantProposals.entries.form" },
    ]);
    expect(formsAssistantSuggestions(["formcatalogs.read", "formcatalogs.manage"], t)).toEqual([
      { id: "forms.build-catalog", question: "assistantProposals.suggestions.catalog", draft: "assistantProposals.suggestions.catalog", attach: true },
    ]);
    expect(formsAssistantSuggestions(["formtemplates.manage", "formcatalogs.manage"], t).map(suggestion => suggestion.id)).toEqual(["forms.build-form", "forms.build-catalog"]);
    expect(formsAssistantSuggestions(["formtemplates.read", "formcatalogs.read"], t)).toEqual([]);
  });
});
