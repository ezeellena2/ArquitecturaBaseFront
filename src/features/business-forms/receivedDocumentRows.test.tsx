import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { receivedDocumentDetailFixture, receivedDocumentIds } from "@/test/visual/receivedDocumentFixtures";
import { readReceivedDocument, type ReceivedDocumentEvent } from "./api/receivedDocuments";
import { ReceivedDocumentHistory } from "./components/documents/ReceivedDocumentHistory";
import { receivedDocumentActions, receivedDocumentEventKey, receivedDocumentName, receivedDocumentReason, receivedDocumentRowLabel } from "./receivedDocuments";

// VC1-A (task 26): until task 30 draws the rows, today's helpers read them right. A discarded row is reopened (its cells are what was
// read), a row past the limit waits for the team because of it (nothing expired), and the history says a row was sent as one of the loads
// of its spreadsheet or went over their limit, with the texts of the design and never a raw key.
const detail = receivedDocumentDetailFixture(receivedDocumentIds.forReview);
const spreadsheet = { name: "cobranzas-semana.xlsx", mediaType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 18_000, pages: null, stored: true };
const cells = [{ header: "Cliente", value: "Almacén Las Rosas" }, { header: "Importe", value: "61250" }];
const at = detail.document.receivedAtUtc;
const ana = { userId: "0199b0c0-0000-7000-8000-000000000304", displayName: "Ana Pérez" };
const step = (kind: ReceivedDocumentEvent["kind"], value: string | null = null, actor: typeof ana | null = null): ReceivedDocumentEvent => ({ atUtc: at, kind, actor, detail: value });
const asRow = (changes: Record<string, unknown>, history: unknown[]) => readReceivedDocument({ ...detail, reading: null, rowCells: cells,
  document: { ...detail.document, file: spreadsheet, row: { sheet: null, number: 5 }, ...changes }, history });
const overLimit = asRow({ state: "proposed", forReview: true, replyExpiresAtUtc: null }, [step("received", "sure"), step("overLimit")]);
const sent = asRow({ state: "proposed", forReview: false, replyExpiresAtUtc: "2026-10-22T21:12:00Z" }, [step("received", "sure"), step("sent", "1/3")]);
const unseen = asRow({ state: "unclassified", forReview: false, reasonCode: "unseen", deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null }, [step("received", "unseen")]);

describe("today's helpers with a row", () => {
  it("reopen a discarded row, whose cells are what was read, and still not a file that was never read", () => {
    const discarded = asRow({ state: "discarded", forReview: false, reasonCode: "reviewer", deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null },
      [step("received", "sure"), step("overLimit"), step("discarded", null, ana)]);
    expect(receivedDocumentActions(discarded).reopen).toBe(true);
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.rejected)).reopen).toBe(false);
  });

  it("say a row past the limit waits for the team because of the limit, not because its reply expired", () => {
    expect(receivedDocumentReason(overLimit, "?")).toEqual({ key: "reasons.forReviewOverLimit" });
    // One that was sent and whose reply expired still says so, as a row (task 30: «la confirmara»).
    expect(receivedDocumentReason({ ...sent, document: { ...sent.document, forReview: true, replyExpiresAtUtc: null } }, "?"))
      .toEqual({ key: "reasons.row.forReviewExpired", values: { person: "Pablo Sosa" } });
  });

  it("name the step of a row sent as one of the loads, to its person, and of one past their limit", () => {
    expect(receivedDocumentEventKey(step("sent", "2/3"), [], "Marta Ruiz")).toEqual({ key: "history.sent", values: { person: "Marta Ruiz", position: "2", total: "3" } });
    expect(receivedDocumentEventKey(step("overLimit"))).toEqual({ key: "history.overLimit" });
  });

  it("name a row by its number, with its sheet when the book has several, and a notice names it with its spreadsheet", () => {
    expect(receivedDocumentRowLabel({ sheet: null, number: 1234 })).toEqual({ key: "row.label", values: { number: "1234" } });
    expect(receivedDocumentRowLabel({ sheet: "Ventas", number: 5 })).toEqual({ key: "row.labelSheet", values: { sheet: "Ventas", number: "5" } });
    const t = (key: string, values?: Record<string, string>) => key + JSON.stringify(values);
    expect(receivedDocumentName(sent.document, t)).toBe('cobranzas-semana.xlsx · row.label{"number":"5"}');
    expect(receivedDocumentName(detail.document, t)).toBe("comprobante.jpg");
  });

  it("say a row is «la fila»: it fits no form, a person discarded it, and a repeated one names the data or the row it repeats", () => {
    const unmatched = asRow({ state: "unclassified", forReview: false, reasonCode: "unknown", deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null }, [step("received", "unknown")]);
    expect(receivedDocumentReason(unmatched, "?")).toEqual({ key: "reasons.row.unknown" });
    // One past the sample the AI read comes with its own code: it does not say it fits no form, because nobody read it.
    expect(receivedDocumentReason(unseen, "?")).toEqual({ key: "reasons.row.unseen" });
    const discarded = asRow({ state: "discarded", forReview: false, reasonCode: "reviewer", deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null },
      [step("received", "sure"), step("discarded", null, ana)]);
    expect(receivedDocumentReason(discarded, "?")).toEqual({ key: "reasons.row.reviewerBy", values: { person: "Ana Pérez" } });
    const repeated = (repetition: Record<string, unknown>) => readReceivedDocument({ ...asRow({ state: "discarded", forReview: false, reasonCode: "duplicate",
      deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null }, [step("received", "duplicate")]),
    proposal: { ...detail.proposal, repetition: { atUtc: at, recordId: null, recordNumber: null, documentId: null, ...repetition } } });
    expect(receivedDocumentReason(repeated({ recordId: ana.userId, recordNumber: "COB-000118", labels: ["Monto", "Cliente"] }), "?", labels => labels.join(" + ")))
      .toEqual({ key: "reasons.row.duplicateOf", values: { data: "Monto + Cliente", number: "COB-000118", count: 2 } });
    expect(receivedDocumentReason(repeated({ documentId: ana.userId, row: { sheet: null, number: 3 } }), "?")).toEqual({ key: "reasons.row.duplicateRow", values: { number: "3" } });
    expect(receivedDocumentReason(repeated({ documentId: ana.userId, row: { sheet: "Ventas", number: 3 } }), "?"))
      .toEqual({ key: "reasons.row.duplicateRowSheet", values: { number: "3", sheet: "Ventas" } });
  });

  it("tell the steps of a row as «la fila», and the ones that read the same as a document's", () => {
    expect(receivedDocumentEventKey(step("received", "sure"), [], "", true)).toEqual({ key: "history.row.received.sure" });
    expect(receivedDocumentEventKey(step("received", "unseen"), [], "", true)).toEqual({ key: "history.row.received.unseen" });
    expect(receivedDocumentEventKey(step("received", "unknown"), [], "", true)).toEqual({ key: "history.row.received.unknown" });
    expect(receivedDocumentEventKey(step("received", "notSendable"), [], "", true)).toEqual({ key: "history.received.notSendable" });
    expect(receivedDocumentEventKey(step("extractionRequested", "Cobranzas"), [], "", true)).toEqual({ key: "history.row.extractionRequested", values: { form: "Cobranzas" } });
    expect(receivedDocumentEventKey(step("received", "sure"))).toEqual({ key: "history.received.sure" });
  });

  it("show those steps and that reason with the texts of the design, in Spanish and in English", async () => {
    renderWithProviders(<><ReceivedDocumentHistory detail={sent} zone="UTC" /><ReceivedDocumentHistory detail={overLimit} zone="UTC" />
      <ReceivedDocumentHistory detail={unseen} zone="UTC" /></>);
    expect(await screen.findByText("Se la mandó prellenada a Pablo Sosa, como 1 de 3.")).toBeInTheDocument();
    expect(screen.getAllByText("Llegó y la IA la reconoció")).toHaveLength(2);
    expect(screen.getByText("Pasó el tope de 3 cargas por mensaje: quedó para revisar acá.")).toBeInTheDocument();
    expect(screen.getByText("Llegó y la IA no llegó a leerla")).toBeInTheDocument();
    expect(screen.queryByText(/history\./)).not.toBeInTheDocument();
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "formDocuments"), en = i18n.getFixedT("en", "formDocuments");
    expect(es("reasons.forReviewOverLimit")).toBe("Pasó el tope de 3 cargas por mensaje.");
    expect(es("reasons.row.unseen")).toBe("La IA no llegó a leerla.");
    expect(en("reasons.row.unseen")).toBe("The AI did not get to read it.");
    expect(en("history.row.received.unseen")).toBe("Arrived and the AI did not get to read it");
    // «el mismo dato», which agrees with any label («Fecha» too), and «los mismos datos» for several.
    expect(es("reasons.row.duplicateOf", { data: "«Fecha»", number: "COB-000118", count: 1 })).toBe("Repetida: el mismo dato «Fecha» que COB-000118.");
    expect(es("reasons.row.duplicateOf", { data: "«Monto» y «Cliente»", number: "COB-000118", count: 2 }))
      .toBe("Repetida: los mismos datos «Monto» y «Cliente» que COB-000118.");
    expect(en("history.sent", { person: "Marta Ruiz", position: "1", total: "3" })).toBe("Sent prefilled to Marta Ruiz, as 1 of 3.");
    expect(en("history.overLimit")).toBe("It went over the limit of 3 loads per message: left to review here.");
    expect(en("reasons.forReviewOverLimit")).toBe("It went over the limit of 3 loads per message.");
  });
});
