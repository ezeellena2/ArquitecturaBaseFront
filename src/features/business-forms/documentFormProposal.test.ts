import { describe, expect, it } from "vitest";
import type { FormProposal } from "./assistantProposal";
import { documentFormBody, documentFormChanged, documentFormEdit, documentFormProblems, documentFormProposalPath, documentFormQuestionProblems,
  documentFormServerProblems, documentQuestionIndex, proposalTypeKey, type DocumentFormEdit } from "./documentFormProposal";

// «Armar formulario con la IA» (DOC6): what the page decides without the server: the form as it is edited, from the proposal; what is
// missing before «Crear borrador»; the body it sends; where the server's problems go; and the address of a request.
const requestId = "0199b0c0-0000-7000-8000-000000000901";
const proposalId = "0199b0c0-0000-7000-8000-000000000961";
const catalogId = "0199b0c0-0000-7000-8000-000000000981";
const content: FormProposal = {
  culture: "es", name: "Tickets de combustible", prefix: "TCB", submitLabel: "Cargar ticket",
  questions: [
    { label: "Estación", type: "catalog", required: true, options: [], catalog: { id: catalogId, name: "Estaciones" }, sample: "Estación Ruta 9" },
    { label: "Combustible", type: "choice", required: true, options: ["Nafta súper", "Gasoil"], catalog: null, sample: "Nafta súper" },
    { label: "Importe", type: "number", required: false, options: [], catalog: null, sample: "52360" },
    { label: "Ticket", type: "document", required: false, options: [], catalog: null, sample: null },
  ],
  documentReading: { recognition: "Un ticket de carga de combustible." }, standard: null,
};
const edit = documentFormEdit(content);
const withQuestion = (index: number, changes: Partial<DocumentFormEdit["questions"][number]>) =>
  ({ ...edit, questions: edit.questions.map((question, position) => position === index ? { ...question, ...changes } : question) });

describe("the form as it is edited", () => {
  it("starts from the proposal: its name, prefix, button, how to recognize it and every question with what it read", () => {
    expect(edit).toMatchObject({ name: "Tickets de combustible", prefix: "TCB", submitLabel: "Cargar ticket", recognition: "Un ticket de carga de combustible." });
    expect(edit.questions.map(question => [question.label, question.type, question.required, question.options, question.catalog, question.sample])).toEqual([
      ["Estación", "catalog", true, [], { id: catalogId, name: "Estaciones" }, "Estación Ruta 9"],
      ["Combustible", "choice", true, ["Nafta súper", "Gasoil"], null, "Nafta súper"],
      ["Importe", "number", false, [], null, "52360"],
      ["Ticket", "document", false, [], null, null],
    ]);
    // Each question has a key of its own, so removing one does not take another's place.
    expect(new Set(edit.questions.map(question => question.key)).size).toBe(4);
    // A proposal without a reading starts without «Cómo reconocerlo».
    expect(documentFormEdit({ ...content, documentReading: null }).recognition).toBe("");
  });

  it("knows whether something changed, whatever the keys", () => {
    expect(documentFormChanged(edit, content)).toBe(false);
    expect(documentFormChanged(documentFormEdit(content), content)).toBe(false);
    expect(documentFormChanged({ ...edit, name: "Tickets" }, content)).toBe(true);
    expect(documentFormChanged({ ...edit, questions: edit.questions.slice(1) }, content)).toBe(true);
    expect(documentFormChanged(withQuestion(2, { required: true }), content)).toBe(true);
  });

  it("names a type as the editor does", () => {
    expect(["shortText", "number", "yesNo", "catalog", "multiChoice"].map(type => proposalTypeKey(type as never)))
      .toEqual(["types.shortText", "types.decimal", "types.boolean", "types.catalogChoice", "types.multiChoice"]);
  });
});

describe("what is missing before «Crear borrador»", () => {
  it("asks for the name, a prefix that numbers, how to recognize it and at least one question", () => {
    expect(documentFormProblems(edit)).toEqual({});
    expect(documentFormProblems({ ...edit, name: " ", prefix: "1AB", recognition: "" })).toEqual({
      name: "forms:library.required", prefix: "forms:library.prefixInvalid", recognition: "formDocuments:formProposal.recognitionRequired",
    });
    // The server writes the prefix in capitals, and a blank button becomes «Enviar».
    expect(documentFormProblems({ ...edit, prefix: " tcb ", submitLabel: "" })).toEqual({});
    expect(documentFormProblems({ ...edit, questions: [] })).toEqual({ questions: "formDocuments:formProposal.questionsRequired" });
  });

  it("asks each question for its text, the options of a choice and the catalog of a catalog question", () => {
    expect(documentFormProblems(withQuestion(1, { label: "  ", options: [" ", ""] }))).toEqual({
      "questions[1].label": "formDocuments:formProposal.labelRequired", "questions[1].options": "formDocuments:formProposal.optionsRequired",
    });
    expect(documentFormProblems(withQuestion(0, { catalog: null }))).toEqual({ "questions[0].catalogId": "formDocuments:formProposal.catalogRequired" });
    // Options left over from another type do not count.
    expect(documentFormProblems(withQuestion(2, { options: [""] }))).toEqual({});
    expect(documentFormQuestionProblems({ ...edit.questions[1]!, type: "multiChoice", options: [] })).toEqual({ options: "formDocuments:formProposal.optionsRequired" });
  });
});

describe("the body of «Crear borrador»", () => {
  it("sends the form as edited, in the proposal's terms, without what it read", () => {
    const body = documentFormBody(requestId, proposalId, { ...withQuestion(1, { options: [" Nafta súper ", "", "Gasoil"] }), name: " Tickets ", prefix: " tcb ", recognition: " Un ticket. " });
    expect(body).toEqual({
      requestId, proposalId, name: "Tickets", prefix: "TCB", submitLabel: "Cargar ticket", recognition: "Un ticket.",
      questions: [
        { label: "Estación", type: "catalog", required: true, options: [], catalogId },
        { label: "Combustible", type: "choice", required: true, options: ["Nafta súper", "Gasoil"], catalogId: null },
        { label: "Importe", type: "number", required: false, options: [], catalogId: null },
        { label: "Ticket", type: "document", required: false, options: [], catalogId: null },
      ],
    });
    // A question that changed its type leaves behind what it no longer uses.
    expect(documentFormBody(requestId, proposalId, withQuestion(0, { type: "shortText" })).questions[0]).toEqual({ label: "Estación", type: "shortText", required: true, options: [], catalogId: null });
  });
});

describe("the server's problems", () => {
  it("go to their field, each question's to its row, and what has no place apart", () => {
    const problems = documentFormServerProblems({ name: ["Ya hay un formulario con ese nombre."], prefix: ["El prefijo está en uso."], submitLabel: ["Muy largo."],
      recognition: ["Escribí cómo reconocerlo."], questions: ["Hasta 40 preguntas."], "questions[2]": ["No válida."], "questions[0].catalogId": ["El catálogo ya no está."],
      proposalId: ["La propuesta cambió."] });
    expect(problems.fields).toEqual({ name: "Ya hay un formulario con ese nombre.", prefix: "El prefijo está en uso.", submitLabel: "Muy largo.", recognition: "Escribí cómo reconocerlo.",
      questions: "Hasta 40 preguntas.", "questions[2]": "No válida.", "questions[0].catalogId": "El catálogo ya no está." });
    expect(problems.others).toEqual(["La propuesta cambió."]);
    expect(["questions[2]", "questions[0].catalogId", "questions", "name"].map(documentQuestionIndex)).toEqual([2, 0, null, null]);
  });
});

describe("the address of a request", () => {
  it("names the request and, until the server keeps it, what it asks for", () => {
    expect(documentFormProposalPath(requestId)).toBe(`/formularios/documentos/armar/${requestId}`);
    expect(documentFormProposalPath(requestId, { documentId: catalogId })).toBe(`/formularios/documentos/armar/${requestId}?documento=${catalogId}`);
    expect(documentFormProposalPath(requestId, { topicId: catalogId })).toBe(`/formularios/documentos/armar/${requestId}?tema=${catalogId}`);
  });
});
