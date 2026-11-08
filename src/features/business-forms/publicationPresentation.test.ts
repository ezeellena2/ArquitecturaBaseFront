import {describe,expect,it} from "vitest";
import i18n from "@/shared/i18n";
import {fixtureDefinition} from "@/test/visual/formFixtures";
import {openDraftSession} from "./draftSession";
import type {CanonicalQuestion} from "./model";
import {publicationIssueNames,publicationIssueText,uniquePublicationIssues} from "./publicationPresentation";
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

// RG13-A (2026-11-07): with a channel, a minimum of items that WhatsApp does not load stops publishing. The server says it in
// general and brings the limit; the problem says it with the limit and the block's minimum, from the draft.
describe("A minimum of items over what WhatsApp loads", () => {
  it("says up to how many items WhatsApp loads and the minimum of the block, in the menu language", async () => {
    await i18n.loadLanguages("en");
    const base = fixtureDefinition();
    const groupId = "01990000-0000-7000-8000-000000000901";
    const group = { fieldId: groupId, key: "field_" + groupId.replaceAll("-", ""), type: "group", label: { es: "Artículos", en: "Items" }, help: null,
      required: true, rows: { minRows: 15, maxRows: 20 } } as CanonicalQuestion;
    const value = openDraftSession({ actorId: "actor", editorId: "editor" }, { ...base, draft: { ...base.draft, fields: [...base.draft.fields, group] } }).value;
    const issue = { channelId: null, code: "Forms.Publication.MinRowsOverChannelLimit", path: "draft.fields[6].rows", fieldId: groupId, choiceId: null,
      culture: null, message: "En WhatsApp se cargan menos ítems que el mínimo del bloque.", limit: 10 };

    expect(publicationIssueNames(value, "es", i18n.getFixedT("es", "forms")).issueDetail(issue)).toBe("En WhatsApp se cargan hasta 10 ítems; el mínimo es 15.");
    expect(publicationIssueNames(value, "en", i18n.getFixedT("en", "forms")).issueDetail(issue)).toBe("WhatsApp loads up to 10 items; the minimum is 15.");
    expect(publicationIssueNames(value, "es", i18n.getFixedT("es", "forms")).issueDetail({ ...issue, limit: null })).toBe(issue.message);
  });
});
