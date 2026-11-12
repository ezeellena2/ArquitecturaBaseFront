import { z } from "zod";
import type { AssistantProposal } from "@/shared/hooks/assistantProposalContext";
import { acceptsProposal, proposalCapabilities } from "./assistantProposalCapabilities";
import { emptyForm } from "./editorModel";
import type { DraftChoice, DraftEditorValue, DraftQuestion, FormCulture } from "./model";

// The proposals the Home assistant can close on for this module, as the server normalized them: one strict shape per version.
const culture = z.enum(["es", "en"]);
const questionShape = {
  label: z.string().min(1),
  type: z.enum(["shortText", "longText", "number", "date", "yesNo", "choice", "multiChoice", "catalog", "photo", "document"]),
  required: z.boolean(),
  options: z.array(z.string().min(1)),
  catalog: z.strictObject({ id: z.string().uuid(), name: z.string() }).nullable(),
};
const formShape = { culture, name: z.string().min(1), prefix: z.string().min(1), submitLabel: z.string().min(1) };
const formProposal = z.strictObject({ ...formShape, questions: z.array(z.strictObject(questionShape)).min(1).max(40) });
// Etapa 3 de la IA (propose-form@2): version 1's form and, with the turn's document, the reading it turns on with «Cómo reconocerlo»,
// what each question read in the document (for DOC6 to compare) and a similar library standard, each one null or exactly its object.
const documentFormProposal = z.strictObject({
  ...formShape,
  questions: z.array(z.strictObject({ ...questionShape, sample: z.string().nullable() })).min(1).max(40),
  documentReading: z.strictObject({ recognition: z.string().min(1) }).nullable(),
  standard: z.strictObject({ key: z.string().min(1), name: z.string().min(1) }).nullable(),
});
const valueType = z.enum(["text", "integer", "decimal", "date"]);
const catalogShape = {
  culture, name: z.string().min(1), description: z.string(), valueType, code: z.string().min(1), option: z.string().min(1),
  fields: z.array(z.strictObject({ name: z.string().min(1), type: z.enum(["text", "integer", "decimal", "date", "boolean"]) })).max(20),
};
const catalogProposal = z.strictObject(catalogShape);
// Stage 2: what a proposal takes from the turn's spreadsheet, ordered as the catalog (code, option, value, detail and fields):
// each column with its letter and its header, and up to three rows of data with one text per column.
const spreadsheet = z.strictObject({
  fileName: z.string().min(1), sheetName: z.string(), rowCount: z.number().int().nonnegative(), hasHeaders: z.boolean(),
  columns: z.array(z.strictObject({
    target: z.enum(["code", "option", "value", "detail", "field"]), field: z.string().min(1).nullable(), key: z.string().min(1).nullable(),
    letter: z.string().regex(/^[A-Z]{1,3}$/), header: z.string().nullable(),
  })).min(2),
  sample: z.array(z.array(z.string())).max(3),
});
const mappedCatalogProposal = z.strictObject({ ...catalogShape, spreadsheet: spreadsheet.nullable() });
const importProposal = z.strictObject({ catalog: z.strictObject({ id: z.string().uuid(), name: z.string().min(1), valueType }), spreadsheet });
const peopleProposal = z.strictObject({
  metadataReadOrdinal: z.number().int().positive(), name: z.string().min(1), description: z.string(),
  filters: z.strictObject({
    textColumn: z.string(), detailColumn: z.string().nullable(),
    conditions: z.array(z.strictObject({ column: z.string(), operator: z.string(), value: z.string() })),
    excludeRecipient: z.boolean(), sortColumn: z.string(), sortDescending: z.boolean(),
  }),
  limitations: z.array(z.strictObject({ code: z.string(), criterion: z.string() })),
});
/** A form proposal: version 1 reads as one without a document (no reading, samples or standard). */
export type FormProposal = z.infer<typeof documentFormProposal>;
export type ProposedQuestion = FormProposal["questions"][number];
/** A catalog proposal: version 1 reads as one without a spreadsheet. */
export type CatalogProposal = z.infer<typeof mappedCatalogProposal>;
export type ProposalSpreadsheet = z.infer<typeof spreadsheet>;
export type ImportProposal = z.infer<typeof importProposal>;
export type PeopleProposal = z.infer<typeof peopleProposal>;
export type ReadProposal =
  | { readonly kind: "form"; readonly content: FormProposal }
  | { readonly kind: "catalog"; readonly content: CatalogProposal }
  | { readonly kind: "import"; readonly content: ImportProposal }
  | { readonly kind: "people"; readonly content: PeopleProposal };

/** The proposal as this module reads it, or null when it is another capability, version or shape: then no card shows. */
export function readProposal(proposal: AssistantProposal): ReadProposal | null {
  if (!acceptsProposal(proposal)) return null;
  if (proposal.capability === proposalCapabilities.form && proposal.version === 1) {
    const parsed = formProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "form", content: { ...parsed.data, questions: parsed.data.questions.map(question => ({ ...question, sample: null })),
      documentReading: null, standard: null } } : null;
  }
  if (proposal.capability === proposalCapabilities.form) {
    const parsed = documentFormProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "form", content: parsed.data } : null;
  }
  if (proposal.capability === proposalCapabilities.catalog && proposal.version === 1) {
    const parsed = catalogProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "catalog", content: { ...parsed.data, spreadsheet: null } } : null;
  }
  if (proposal.capability === proposalCapabilities.catalog) {
    const parsed = mappedCatalogProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "catalog", content: parsed.data } : null;
  }
  if (proposal.capability === proposalCapabilities.catalogImport) {
    const parsed = importProposal.safeParse(proposal.content);
    return parsed.success ? { kind: "import", content: parsed.data } : null;
  }
  const parsed = peopleProposal.safeParse(proposal.content);
  return parsed.success ? { kind: "people", content: parsed.data } : null;
}

/** The questions that did not exist, the same, in the proposal this one replaced: the card marks them «Nueva». What a question read
 *  in the document is not the question, so the two versions compare without it. */
export function newQuestions(content: FormProposal, previous: AssistantProposal | null): ReadonlySet<number> {
  const before = previous ? readProposal(previous) : null;
  if (before?.kind !== "form") return new Set();
  const asked = (question: ProposedQuestion) => {
    const { sample: _, ...asked } = question;
    return JSON.stringify(asked);
  };
  const known = new Set(before.content.questions.map(asked));
  return new Set(content.questions.flatMap((question, index) => known.has(asked(question)) ? [] : [index]));
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
