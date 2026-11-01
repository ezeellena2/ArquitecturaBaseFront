import {describe,expect,it} from "vitest";
import {fixtureDefinition} from "@/test/visual/formFixtures";
import {openDraftSession} from "./draftSession";
import {publicationIssueText,uniquePublicationIssues} from "./publicationPresentation";
const issue={channelId:"WhatsApp",code:"WhatsApp.Flow.ValidationFailed",path:"channel",fieldId:null,choiceId:null,culture:"en" as const,message:"WhatsApp rejected this form.",limit:null};
describe("Publication diagnostics",()=>{it("collapses repeated channel rejection while retaining distinct culture, reason and field",()=>{const differentCulture={...issue,culture:"es" as const};const differentReason={...issue,code:"Other"};const differentField={...issue,fieldId:"01990000-0000-7000-8000-000000000010"};expect(uniquePublicationIssues([issue,issue,differentCulture,issue,differentReason,differentField])).toEqual([issue,differentCulture,differentReason,differentField]);});});

// A text over its limit says how long it is: the issue brings the limit and the saved draft, the text (2026-11-01).
describe("The text a publication issue points at", () => {
  const definition = fixtureDefinition();
  const value = openDraftSession({ actorId: "actor", editorId: "editor" }, definition).value;
  const [customer, , amount, , , notes] = definition.draft.fields;
  const choice = customer!.type === "choice" && !customer!.source ? customer!.options[1]!.choiceId : "";
  const at = (path: string, fieldId: string | null = null, choiceId: string | null = null, culture: "es" | "en" | null = "es") => ({ path, fieldId, choiceId, culture });
  it("measures a question's title in the issue's language", () => {
    expect(publicationIssueText(at("draft.fields[2].label.en", amount!.fieldId, null, "en"), value)).toEqual({ part: "label", length: "Amount collected".length });
  });
  it("tells the help and an option apart from the title", () => {
    expect(publicationIssueText(at("draft.fields[5].help.es", notes!.fieldId), value)).toEqual({ part: "help", length: "Contá lo que pasó.".length });
    expect(publicationIssueText(at("draft.fields[0].options[1].label.es", customer!.fieldId, choice), value)).toEqual({ part: "option", length: "Distribuidora Norte".length });
  });
  it("measures the form name as the server saves it, without the spaces around it", () => {
    expect(publicationIssueText(at("name.es"), { ...value, name: { ...value.name, es: "  Registrar visita  " } })).toEqual({ part: "name", length: "Registrar visita".length });
    expect(publicationIssueText(at("draft.submitLabel.es"), value)).toEqual({ part: "submitLabel", length: "Confirmar visita".length });
  });
  it("finds nothing without a language or for a question that is not in the draft", () => {
    expect(publicationIssueText(at("draft.fields[2].label", amount!.fieldId, null, null), value)).toBeNull();
    expect(publicationIssueText(at("draft.fields[9].label.es", "01990000-0000-7000-8000-000000000099"), value)).toBeNull();
  });
});
