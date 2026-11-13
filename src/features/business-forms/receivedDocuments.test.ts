import { describe, expect, it } from "vitest";
import en from "@/locales/en/formDocuments.json";
import es from "@/locales/es/formDocuments.json";
import { receivedDocumentDetailFixture, receivedDocumentFields, receivedDocumentForms, receivedDocumentIds, receivedDocumentOptions, receivedDocumentsPageFixture } from "@/test/visual/receivedDocumentFixtures";
import type { ReceivedDocumentEvent } from "./api/receivedDocuments";
import { documentFormProposalFailureKey, hasReceivedDocumentFilters, receivedDocumentActions, receivedDocumentAnswers, receivedDocumentAnswersKey, receivedDocumentCandidate, receivedDocumentDataColumns,
  receivedDocumentDatum, receivedDocumentDraft, receivedDocumentEventKey, receivedDocumentExtractionFailureKey, receivedDocumentForms as formsOf, receivedDocumentKind,
  receivedDocumentProblems, receivedDocumentReason, receivedDocumentShownData, receivedDocumentStateLabel, receivedDocumentValueNeedsLook, searchDigitsMissing } from "./receivedDocuments";

// «Documentos recibidos» (DOC5-A): what the page and its panel decide without the server.
const page = receivedDocumentsPageFixture();
const forReview = receivedDocumentDetailFixture(receivedDocumentIds.forReview);

describe("the list", () => {
  it("asks for three digits before searching, as the server", () => {
    expect(searchDigitsMissing("")).toBe(false);
    expect(searchDigitsMissing("15")).toBe(true);
    expect(searchDigitsMissing("abc")).toBe(true);
    expect(searchDigitsMissing("1.5")).toBe(true);
    expect(searchDigitsMissing("150.000")).toBe(false);
    expect(searchDigitsMissing("20-23456789-7")).toBe(false);
  });

  it("gives each datum read its own column, in the order they appear, and «—» where a document does not bring it", () => {
    expect(receivedDocumentDataColumns(page.items)).toEqual(["Monto", "Banco o billetera de origen", "CUIT o CUIL de origen"]);
    expect(receivedDocumentDatum(page.items[4]!, "CUIT o CUIL de origen")).toBe("20-23456789-7");
    expect(receivedDocumentDatum(page.items[0]!, "CUIT o CUIL de origen")).toBeUndefined();
    expect(receivedDocumentDataColumns([])).toEqual([]);
  });

  it("counts the form and the person among the private filters", () => {
    expect(hasReceivedDocumentFilters({})).toBe(false);
    expect(hasReceivedDocumentFilters({ form: { id: receivedDocumentForms.payments, name: "Pagos de clientes" } })).toBe(true);
    expect(hasReceivedDocumentFilters({ sender: { id: receivedDocumentIds.other, name: "Pablo Sosa" } })).toBe(true);
  });

  it("reads a proposed document nobody waits for as «Para revisar», and knows a photo, a PDF and a Word", () => {
    expect(page.items.map(receivedDocumentStateLabel)).toEqual(["forReview", "confirmed", "unclassified", "unclassified", "forReview", "proposed", "discarded", "confirmed", "discarded", "unclassified"]);
    expect(["image/jpeg", "image/png", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"].map(receivedDocumentKind))
      .toEqual(["photo", "photo", "pdf", "word", "file"]);
  });
});

describe("the panel", () => {
  it("reviews the candidate of the document's form, and offers the forms the server can read it for, its own first if it left them", () => {
    const doubt = { ...forReview, proposal: { ...forReview.proposal!, outcome: "doubt" as const, candidates: [
      { ...forReview.proposal!.candidates[0]!, definitionId: receivedDocumentForms.expenses, name: "Gastos" }, forReview.proposal!.candidates[0]!] } };
    expect(receivedDocumentCandidate(doubt)?.definitionId).toBe(receivedDocumentForms.payments);
    expect(formsOf(doubt).map(form => form.name)).toEqual(["Pagos de clientes", "Gastos"]);
    // An unclassified one without candidates can be read for any of them.
    const unknown = receivedDocumentDetailFixture(receivedDocumentIds.unclassified);
    expect(receivedDocumentCandidate(unknown)).toBeNull();
    expect(formsOf(unknown).map(form => form.name)).toEqual(["Pagos de clientes", "Gastos"]);
    // Its form, deactivated since, stays chosen in the list, which says what it is.
    expect(formsOf({ ...forReview, forms: [{ definitionId: receivedDocumentForms.expenses, name: "Gastos" }] }).map(form => form.name)).toEqual(["Pagos de clientes", "Gastos"]);
    expect(formsOf(receivedDocumentDetailFixture(receivedDocumentIds.forReview, "es", false))).toEqual([]);
  });

  it("lets edit and pass only what waits for the team, choose the form also of an unclassified one, and only read without «Revisar documentos»", () => {
    expect(receivedDocumentActions(forReview)).toEqual({ edit: true, pass: true, changeForm: true, discard: true, reopen: false, waiting: false });
    // Its person was sent the form: everything stays in place, off, with the reason (VC1-A, the backend answers 409 AwaitingSender).
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.waiting))).toEqual({ edit: false, pass: true, changeForm: true, discard: true, reopen: false, waiting: true });
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.unclassified))).toEqual({ edit: false, pass: false, changeForm: true, discard: true, reopen: false, waiting: false });
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.discarded))).toEqual({ edit: false, pass: false, changeForm: false, discard: false, reopen: true, waiting: false });
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.pdf))).toEqual({ edit: false, pass: false, changeForm: false, discard: false, reopen: false, waiting: false });
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.forReview, "es", false))).toEqual({ edit: false, pass: false, changeForm: false, discard: false, reopen: false, waiting: false });
  });

  it("does not reopen a document that was never read, as a rejected file: nothing would be left to review", () => {
    const rejected = receivedDocumentDetailFixture(receivedDocumentIds.rejected);
    expect(rejected.reading).toBeNull();
    expect(receivedDocumentActions(rejected).reopen).toBe(false);
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.discarded)).reopen).toBe(true);
  });

  it("starts the data as read, a decimal in the menu's format, and sends them canonical, with the options chosen and leaving out what is empty", () => {
    const candidate = receivedDocumentCandidate(forReview)!;
    const draft = receivedDocumentDraft(candidate, "es");
    expect(draft[receivedDocumentFields.amount]).toBe("68500,00");
    expect(receivedDocumentDraft(candidate, "en")[receivedDocumentFields.amount]).toBe("68500.00");
    expect(draft[receivedDocumentFields.destinationAccount]).toBe("");
    expect(draft[receivedDocumentFields.currency]).toBe(receivedDocumentOptions.pesos);
    const answers = receivedDocumentAnswers(candidate, { ...draft, [receivedDocumentFields.operation]: " 6120093745 ", [receivedDocumentFields.destinationBank]: receivedDocumentOptions.galicia });
    expect(answers.find(answer => answer.fieldId === receivedDocumentFields.amount)?.value).toBe("68500.00");
    expect(answers.find(answer => answer.fieldId === receivedDocumentFields.operation)?.value).toBe("6120093745");
    expect(answers.find(answer => answer.fieldId === receivedDocumentFields.client)?.value).toBe(receivedDocumentOptions.bakery);
    // A choice not read can be answered with one of its options.
    expect(answers.find(answer => answer.fieldId === receivedDocumentFields.destinationBank)?.value).toBe(receivedDocumentOptions.galicia);
    expect(answers.some(answer => answer.fieldId === receivedDocumentFields.destinationAccount)).toBe(false);
    expect(receivedDocumentAnswers(candidate, draft).some(answer => answer.fieldId === receivedDocumentFields.destinationBank)).toBe(false);
    // The same answers repeat the request; any change is another.
    expect(receivedDocumentAnswersKey(answers)).toBe(receivedDocumentAnswersKey(receivedDocumentAnswers(candidate, { ...draft, [receivedDocumentFields.operation]: "6120093745",
      [receivedDocumentFields.destinationBank]: receivedDocumentOptions.galicia })));
    expect(receivedDocumentAnswersKey(answers)).not.toBe(receivedDocumentAnswersKey(receivedDocumentAnswers(candidate, draft)));
  });

  it("stops a required datum left empty, a number that is not one and a date that is not one", () => {
    const candidate = receivedDocumentCandidate(forReview)!;
    const draft = receivedDocumentDraft(candidate, "es");
    expect(receivedDocumentProblems(candidate, draft)).toEqual({});
    expect(receivedDocumentProblems(candidate, { ...draft, [receivedDocumentFields.amount]: "", [receivedDocumentFields.date]: "21/10" }))
      .toEqual({ [receivedDocumentFields.amount]: "required", [receivedDocumentFields.date]: "date" });
    expect(receivedDocumentProblems(candidate, { ...draft, [receivedDocumentFields.amount]: "68.500,00" })).toEqual({ [receivedDocumentFields.amount]: "number" });
    // An empty option that is not required is not a problem; a required one is, also when it was not read.
    expect(receivedDocumentProblems(candidate, { ...draft, [receivedDocumentFields.destinationBank]: "" })).toEqual({});
    expect(receivedDocumentProblems(candidate, { ...draft, [receivedDocumentFields.currency]: "" })).toEqual({ [receivedDocumentFields.currency]: "required" });
  });

  it("keeps in sight a datum with doubts, one that does not pass and a required one not read", () => {
    const values = receivedDocumentCandidate(forReview)!.values;
    expect(values.filter(receivedDocumentValueNeedsLook).map(value => value.fieldId)).toEqual([receivedDocumentFields.operation]);
    expect(receivedDocumentValueNeedsLook({ ...values[1]!, value: null, text: null, mark: "notRead" })).toBe(true);
    expect(receivedDocumentValueNeedsLook({ ...values[6]!, mark: "invalid", errorCode: "Forms.Record.BankAccountInvalid" })).toBe(true);
  });

  it("folds the data after the eighth, except the ones that need a look, and unfolds them all", () => {
    const values = receivedDocumentCandidate(forReview)!.values;
    expect(receivedDocumentShownData(values, false, () => false)).toEqual({ shown: values.slice(0, 8), hidden: 7, folds: true });
    // A datum below the fold that needs a look stays in sight, folded or not, and «Ver menos datos» still folds the others.
    const late = (value: { fieldId: string }) => value.fieldId === receivedDocumentFields.destinationTaxId;
    expect(receivedDocumentShownData(values, false, late)).toEqual({ shown: [...values.slice(0, 8), values[13]], hidden: 6, folds: true });
    expect(receivedDocumentShownData(values, true, late)).toEqual({ shown: values, hidden: 0, folds: true });
    // Nothing to fold: neither «Ver más» nor «Ver menos».
    expect(receivedDocumentShownData(values.slice(0, 8), true, () => false)).toEqual({ shown: values.slice(0, 8), hidden: 0, folds: false });
    expect(receivedDocumentShownData(values, false, () => true)).toEqual({ shown: values, hidden: 0, folds: false });
  });
});

describe("why and what happened", () => {
  it("says why a document is where it is when its state does not", () => {
    expect(receivedDocumentReason(forReview, "?")).toEqual({ key: "reasons.forReviewExpired", values: { person: "Pablo Sosa" } });
    const step = (kind: ReceivedDocumentEvent["kind"], detail: string | null = null): ReceivedDocumentEvent => ({ atUtc: forReview.document.receivedAtUtc, kind, actor: null, detail });
    const after = (...history: ReceivedDocumentEvent[]) => receivedDocumentReason({ ...forReview, history }, "?")?.key ?? null;
    expect(after(step("received", "notSendable"))).toBe("reasons.forReviewNotSendable");
    // VC1-A: the first row of a spreadsheet nobody recognized, whose form its person chose from the list and could not be sent.
    expect(after(step("received", "unknown"), step("formChosen", "notSendable"))).toBe("reasons.forReviewNotSendable");
    // The person chose a form of a doubt and did not confirm it; a change of form that failed leaves it as it was.
    expect(after(step("received", "doubt"), step("formChosen"))).toBe("reasons.forReviewExpired");
    expect(after(step("received", "sure"), step("extractionRequested", "Gastos"), step("extractionFailed"))).toBe("reasons.forReviewExpired");
    // Someone of the team brought it back or read it for another form: nothing expired, and its state says it all.
    expect(after(step("received", "doubt"), step("choseOther"), step("extractionRequested", "Pagos de clientes"), step("formChanged", "Pagos de clientes"))).toBeNull();
    expect(after(step("received", "sure"), step("discarded"), step("reopened"))).toBeNull();
    expect(receivedDocumentReason(receivedDocumentDetailFixture(receivedDocumentIds.waiting), "?")).toBeNull();
    expect(receivedDocumentReason(receivedDocumentDetailFixture(receivedDocumentIds.unclassified), "?")?.key).toBe("reasons.unknown");
    expect(receivedDocumentReason(receivedDocumentDetailFixture(receivedDocumentIds.other), "?")?.key).toBe("reasons.other");
    expect(receivedDocumentReason(receivedDocumentDetailFixture(receivedDocumentIds.discarded), "?")).toEqual({ key: "reasons.reviewerBy", values: { person: "Ana Pérez" } });
    const discarded = receivedDocumentDetailFixture(receivedDocumentIds.discarded);
    const unreadable = { ...discarded, document: { ...discarded.document, reasonCode: "unreadable" }, reading: { ...discarded.reading!, readability: "unreadable" as const, problem: "blurry" as const } };
    expect(receivedDocumentReason(unreadable, "?")?.key).toBe("reasons.unreadable.blurry");
    const repeated = { ...discarded, document: { ...discarded.document, reasonCode: "duplicate" },
      proposal: { outcome: "sure" as const, documentType: null, candidates: [], repetition: { atUtc: "2026-10-20T13:39:00Z", recordId: receivedDocumentIds.confirmed, recordNumber: "REC-000123", documentId: null } } };
    expect(receivedDocumentReason(repeated, "?")).toEqual({ key: "reasons.duplicateOf", values: { number: "REC-000123" } });
    expect(receivedDocumentReason({ ...discarded, document: { ...discarded.document, reasonCode: "protected" } }, "?")?.key).toBe("reasons.protected");
    expect(receivedDocumentReason({ ...discarded, document: { ...discarded.document, reasonCode: "tooManyRows" } }, "?")?.key).toBe("reasons.tooManyRows");
    expect(receivedDocumentReason({ ...discarded, document: { ...discarded.document, reasonCode: "somethingNew" } }, "?")?.key).toBe("reasons.notOpened");
    expect(receivedDocumentReason(receivedDocumentDetailFixture(receivedDocumentIds.pdf), "?")).toBeNull();
  });

  it("names each step of the history with the form or the response it names", () => {
    const at = "2026-10-21T21:12:00Z";
    expect(receivedDocumentEventKey({ atUtc: at, kind: "received", actor: null, detail: "doubt" })).toEqual({ key: "history.received.doubt" });
    expect(receivedDocumentEventKey({ atUtc: at, kind: "received", actor: null, detail: "unavailable" })).toEqual({ key: "history.received.other" });
    expect(receivedDocumentEventKey({ atUtc: at, kind: "formChanged", actor: null, detail: "Gastos" })).toEqual({ key: "history.formChanged", values: { form: "Gastos" } });
    expect(receivedDocumentEventKey({ atUtc: at, kind: "confirmed", actor: null, detail: "REC-000124" })).toEqual({ key: "history.confirmed", values: { number: "REC-000124" } });
    expect(receivedDocumentEventKey({ atUtc: at, kind: "reopened", actor: null, detail: null })).toEqual({ key: "history.reopened" });
    expect(receivedDocumentEventKey({ atUtc: at, kind: "formChosen", actor: null, detail: null })).toEqual({ key: "history.formChosen" });
    // The engine refused a change of form: the step names the form asked for, from the step that asked for it.
    const refused: ReceivedDocumentEvent = { atUtc: at, kind: "extractionFailed", actor: null, detail: "Forms.ReceivedDocument.ExtractionRefused" };
    const asked: ReceivedDocumentEvent = { atUtc: at, kind: "extractionRequested", actor: null, detail: "Gastos" };
    expect(receivedDocumentEventKey(refused, [asked])).toEqual({ key: "history.extractionRefused", values: { form: "Gastos" } });
    expect(receivedDocumentEventKey(refused)).toEqual({ key: "history.extractionRefusedOther" });
    expect(receivedDocumentExtractionFailureKey("Forms.ReceivedDocument.ExtractionRefused")).toBe("extraction.refused");
    expect(receivedDocumentExtractionFailureKey("Forms.ReceivedDocument.Unrecognized")).toBe("extraction.unrecognized");
    expect(receivedDocumentExtractionFailureKey("Forms.ReceivedDocument.FormChanged")).toBe("extraction.failed");
  });
});

// DOC6 (task 14): why «Armar formulario con la IA» ended without a proposal, by its code: the assistant proposed none, the request is no
// longer there, or the engine could not (its codes come as they are, and all of them read the same).
describe("a form proposal", () => {
  it("says why it failed, in both languages", () => {
    expect(documentFormProposalFailureKey("Forms.ReceivedDocument.NoFormProposal")).toBe("formProposal.failure.noProposal");
    expect(documentFormProposalFailureKey("Forms.ReceivedDocument.ProposalNotFound")).toBe("formProposal.failure.notFound");
    for (const code of ["Ai.Assistant.ProviderUnavailable", "Ai.Assistant.Expired", "Ai.Assistant.InvalidOutput", "Ai.Assistant.LimitExceeded", "Ai.Assistant.ContentBlocked"])
      expect(documentFormProposalFailureKey(code)).toBe("formProposal.failure.failed");
    const texts = (locale: typeof es) => Object.values(locale.formProposal.failure);
    expect(texts(es)).toHaveLength(3);
    expect([...texts(es), ...texts(en)].every(text => text.trim() !== "")).toBe(true);
  });
});
