import { z } from "zod";
import type { AssistantProposal } from "@/shared/hooks/assistantProposalContext";
import { proposalCapabilities } from "./assistantProposalCapabilities";
import { emptyForm } from "./editorModel";
import type { DraftChoice, DraftEditorValue, DraftQuestion, FormCulture } from "./model";

// The three proposals the Home assistant can close on for this module, as the server normalized them.
const culture = z.enum(["es", "en"]);
const proposedQuestion = z.strictObject({
  label: z.string().min(1),
  type: z.enum(["shortText", "longText", "number", "date", "yesNo", "choice", "multiChoice", "catalog", "photo", "document"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)),
  catalog: z.strictObject({ id: z.string().uuid(), name: z.string() }).nullable(),
});
const formProposal = z.strictObject({
  culture, name: z.string().min(1), prefix: z.string().min(1), submitLabel: z.string().min(1),
  questions: z.array(proposedQuestion).min(1).max(40),
});
const catalogProposal = z.strictObject({
  culture, name: z.string().min(1), description: z.string(), valueType: z.enum(["text", "integer", "decimal", "date"]),
  code: z.string().min(1), option: z.string().min(1),
  fields: z.array(z.strictObject({ name: z.string().min(1), type: z.enum(["text", "integer", "decimal", "date", "boolean"]) })).max(20),
});
const peopleProposal = z.strictObject({
  metadataReadOrdinal: z.number().int().positive(), name: z.string().min(1), description: z.string(),
  filters: z.strictObject({
    textColumn: z.string(), detailColumn: z.string().nullable(),
    conditions: z.array(z.strictObject({ column: z.string(), operator: z.string(), value: z.string() })),
    excludeRecipient: z.boolean(), sortColumn: z.string(), sortDescending: z.boolean(),
  }),
  limitations: z.array(z.strictObject({ code: z.string(), criterion: z.string() })),
});
export type FormProposal = z.infer<typeof formProposal>;
export type ProposedQuestion = FormProposal["questions"][number];
export type CatalogProposal = z.infer<typeof catalogProposal>;
export type PeopleProposal = z.infer<typeof peopleProposal>;
export type ReadProposal =
  | { readonly kind: "form"; readonly content: FormProposal }
  | { readonly kind: "catalog"; readonly content: CatalogProposal }
  | { readonly kind: "people"; readonly content: PeopleProposal };

/** The proposal as this module reads it, or null when it is another capability, version or shape: then no card shows. */
export function readProposal(proposal: AssistantProposal): ReadProposal | null {
  if (proposal.version !== 1) return null;
  if (proposal.capability === proposalCapabilities.form) {
    const parsed = formProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "form", content: parsed.data } : null;
  }
  if (proposal.capability === proposalCapabilities.catalog) {
    const parsed = catalogProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "catalog", content: parsed.data } : null;
  }
  if (proposal.capability === proposalCapabilities.people) {
    const parsed = peopleProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "people", content: parsed.data } : null;
  }
  return null;
}

/** The questions that did not exist, the same, in the proposal this one replaced: the card marks them «Nueva». */
export function newQuestions(content: FormProposal, previous: AssistantProposal | null): ReadonlySet<number> {
  const before = previous ? readProposal(previous) : null;
  if (before?.kind !== "form") return new Set();
  const known = new Set(before.content.questions.map(question => JSON.stringify(question)));
  return new Set(content.questions.flatMap((question, index) => known.has(JSON.stringify(question)) ? [] : [index]));
}

/** The editor value the proposal becomes, for «Ver cómo queda»: the same mapping the server applies when it creates the draft. */
export function formProposalPreview(content: FormProposal): DraftEditorValue {
  const base = emptyForm(content.culture);
  return {
    ...base, name: { [content.culture]: content.name }, prefix: content.prefix,
    draft: { ...base.draft, submitLabel: { [content.culture]: content.submitLabel },
      fields: content.questions.map((question, index) => previewQuestion(question, content.culture, "q" + (index + 1))) },
  };
}
function previewQuestion(question: ProposedQuestion, culture: FormCulture, localId: string): DraftQuestion {
  const common = { localId, fieldId: null, replacesFieldId: null, label: { [culture]: question.label }, help: null, required: question.required };
  const minimum = question.required ? 1 : 0;
  const options = (): readonly DraftChoice[] => question.options.map((label, index) => ({ localId: localId + "o" + (index + 1), choiceId: null, label: { [culture]: label } }));
  switch (question.type) {
    case "shortText": return { ...common, type: "shortText", maxLength: 80 };
    case "longText": return { ...common, type: "longText", maxLength: 600 };
    case "number": return { ...common, type: "decimal" };
    case "yesNo": return { ...common, type: "boolean" };
    case "date": return { ...common, type: "date" };
    case "choice": return { ...common, type: "choice", options: options() };
    case "multiChoice": return { ...common, type: "multiChoice", options: options(), selection: { minSelected: minimum, maxSelected: question.options.length } };
    case "catalog": return { ...common, type: "choice", source: { catalog: question.catalog?.id ?? null } };
    case "photo": return { ...common, type: "photo", files: { minFiles: minimum, maxFiles: 1, photoSource: "cameraOrGallery" } };
    case "document": return { ...common, type: "document", files: { minFiles: minimum, maxFiles: 1 } };
  }
}
