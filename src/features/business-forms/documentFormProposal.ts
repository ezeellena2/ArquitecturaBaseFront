import type { DocumentFormDraftBody } from "./api/documentFormProposals";
import type { FormProposal, ProposedQuestion } from "./assistantProposal";

// «Armar formulario con la IA» (DOC6): what its page decides without the server. The form starts as the assistant proposed it and is
// edited in memory (name, prefix, final button, «Cómo reconocerlo» and the questions, each with what it read in the first document);
// «Crear borrador» sends it in the proposal's own terms, which is all the server takes (no help, lengths or settings of the editor).

export type ProposalQuestionType = ProposedQuestion["type"];
/** The types a proposal can give a question, as the editor lists them. */
export const proposalQuestionTypes: readonly ProposalQuestionType[] = ["shortText", "longText", "number", "date", "yesNo", "choice", "multiChoice", "catalog", "photo", "document"];
/** The editor's name of a type (`forms:types.*`), the same Home's card uses. */
export const proposalTypeKey = (type: ProposalQuestionType) => "types." + (type === "number" ? "decimal" : type === "yesNo" ? "boolean" : type === "catalog" ? "catalogChoice" : type);
export const isChoiceType = (type: ProposalQuestionType) => type === "choice" || type === "multiChoice";
/** What the server takes (SaveFormDraftRequestValidator and FormAuthoringProposalPolicy): up to 40 questions, and up to 160 characters in
 * the final button, a question and an option. */
export const documentFormLimits = { questions: 40, text: 160 } as const;
/** How many documents the assistant reads for a proposal: the first and up to four more (FormDocumentAuthoringPolicy.MaxReadings). */
export const documentFormReadings = 5;

export interface DocumentFormQuestion {
  /** Its own key, so a removed question never lends its place to another. */
  readonly key: string;
  readonly label: string;
  readonly type: ProposalQuestionType;
  readonly required: boolean;
  readonly options: readonly string[];
  readonly catalog: { readonly id: string; readonly name: string } | null;
  /** What it read in the first document; it is not sent. */
  readonly sample: string | null;
}
export interface DocumentFormEdit {
  readonly name: string;
  readonly prefix: string;
  readonly submitLabel: string;
  readonly recognition: string;
  readonly questions: readonly DocumentFormQuestion[];
}

let lastKey = 0;
/** A key for a question added on the page. */
export const newQuestionKey = () => "new-" + ++lastKey;

export function documentFormEdit(content: FormProposal): DocumentFormEdit {
  return {
    name: content.name, prefix: content.prefix, submitLabel: content.submitLabel, recognition: content.documentReading?.recognition ?? "",
    questions: content.questions.map((question, index) => ({ key: "proposed-" + index, label: question.label, type: question.type, required: question.required,
      options: question.options, catalog: question.catalog, sample: question.sample })),
  };
}

// What is compared: the form as it would be sent, never the keys nor what was read.
const comparable = (edit: DocumentFormEdit) => JSON.stringify([edit.name, edit.prefix, edit.submitLabel, edit.recognition,
  edit.questions.map(question => [question.label, question.type, question.required, question.options, question.catalog?.id ?? null])]);
/** Whether the form differs from the proposal, for the guard that asks before leaving. */
export const documentFormChanged = (edit: DocumentFormEdit, content: FormProposal) => comparable(edit) !== comparable(documentFormEdit(content));

// The server writes the prefix in capitals; it has to start with a letter and use up to 12 letters or digits, as the library asks.
const prefixPattern = /^[A-Z][A-Z0-9]{0,11}$/;
const prefixOf = (edit: DocumentFormEdit) => edit.prefix.trim().toUpperCase();
const optionsOf = (question: DocumentFormQuestion) => isChoiceType(question.type) ? question.options.map(option => option.trim()).filter(Boolean) : [];

/** What a question lacks: its text, the options of a choice or the catalog of a catalog question (i18n keys, by its field). */
export function documentFormQuestionProblems(question: DocumentFormQuestion): Partial<Record<"label" | "options" | "catalogId", string>> {
  return {
    ...question.label.trim() ? {} : { label: "formDocuments:formProposal.labelRequired" },
    ...isChoiceType(question.type) && optionsOf(question).length === 0 ? { options: "formDocuments:formProposal.optionsRequired" } : {},
    ...question.type === "catalog" && !question.catalog ? { catalogId: "formDocuments:formProposal.catalogRequired" } : {},
  };
}

/**
 * What the form lacks before «Crear borrador», by the paths the server answers with: the name, a prefix that numbers, «Cómo
 * reconocerlo» (the reading goes on) and at least one question, each complete. A blank button becomes «Enviar» on the server.
 */
export function documentFormProblems(edit: DocumentFormEdit): Record<string, string> {
  const problems: Record<string, string> = {};
  if (!edit.name.trim()) problems.name = "forms:library.required";
  if (!prefixPattern.test(prefixOf(edit))) problems.prefix = "forms:library.prefixInvalid";
  if (!edit.recognition.trim()) problems.recognition = "formDocuments:formProposal.recognitionRequired";
  if (edit.questions.length === 0) problems.questions = "formDocuments:formProposal.questionsRequired";
  edit.questions.forEach((question, index) => {
    for (const [field, key] of Object.entries(documentFormQuestionProblems(question))) problems[`questions[${index}].${field}`] = key;
  });
  return problems;
}

/** The body of «Crear borrador»: the form as edited, trimmed, each question with only what its type uses. */
export function documentFormBody(requestId: string, proposalId: string, edit: DocumentFormEdit): DocumentFormDraftBody {
  return {
    requestId, proposalId, name: edit.name.trim(), prefix: prefixOf(edit), submitLabel: edit.submitLabel.trim(), recognition: edit.recognition.trim(),
    questions: edit.questions.map(question => ({ label: question.label.trim(), type: question.type, required: question.required, options: optionsOf(question),
      catalogId: question.type === "catalog" ? question.catalog?.id ?? null : null })),
  };
}

const fieldPath = /^(name|prefix|submitLabel|recognition|questions)$|^questions\[\d+\](\.[a-zA-Z]+)?$/;
/** The question a server path names («questions[2]», «questions[2].options»), or null. */
export function documentQuestionIndex(path: string): number | null {
  const match = /^questions\[(\d+)\]/.exec(path);
  return match ? Number(match[1]) : null;
}
/** The server's problems of a ProblemDetails: the ones of a field of the page, by their path, and the rest, said apart. */
export function documentFormServerProblems(errors: Readonly<Record<string, readonly string[]>>) {
  const fields: Record<string, string> = {};
  const others: string[] = [];
  for (const [path, messages] of Object.entries(errors)) {
    const message = messages[0];
    if (!message) continue;
    if (fieldPath.test(path)) fields[path] = message; else others.push(message);
  }
  return { fields, others };
}

/** The address of a request: the page asks it while what it asks for (`documento` or `tema`) is in the address, and reads it after. */
export function documentFormProposalPath(requestId: string, ask?: { readonly documentId: string } | { readonly topicId: string }) {
  const path = `/formularios/documentos/armar/${requestId}`;
  if (!ask) return path;
  return path + "?" + new URLSearchParams("documentId" in ask ? { documento: ask.documentId } : { tema: ask.topicId });
}
