import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { receivedDocumentDetailFixture, receivedDocumentIds } from "@/test/visual/receivedDocumentFixtures";
import { readReceivedDocument, type ReceivedDocumentEvent } from "./api/receivedDocuments";
import { ReceivedDocumentHistory } from "./components/documents/ReceivedDocumentHistory";
import { receivedDocumentActions, receivedDocumentEventKey, receivedDocumentReason } from "./receivedDocuments";

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

describe("today's helpers with a row", () => {
  it("reopen a discarded row, whose cells are what was read, and still not a file that was never read", () => {
    const discarded = asRow({ state: "discarded", forReview: false, reasonCode: "reviewer", deleteAfterUtc: "2027-02-09T20:30:00Z", replyExpiresAtUtc: null },
      [step("received", "sure"), step("overLimit"), step("discarded", null, ana)]);
    expect(receivedDocumentActions(discarded).reopen).toBe(true);
    expect(receivedDocumentActions(receivedDocumentDetailFixture(receivedDocumentIds.rejected)).reopen).toBe(false);
  });

  it("say a row past the limit waits for the team because of the limit, not because its reply expired", () => {
    expect(receivedDocumentReason(overLimit, "?")).toEqual({ key: "reasons.forReviewOverLimit" });
    // One that was sent and whose reply expired still says so.
    expect(receivedDocumentReason({ ...sent, document: { ...sent.document, forReview: true, replyExpiresAtUtc: null } }, "?"))
      .toEqual({ key: "reasons.forReviewExpired", values: { person: "Pablo Sosa" } });
  });

  it("name the step of a row sent as one of the loads, to its person, and of one past their limit", () => {
    expect(receivedDocumentEventKey(step("sent", "2/3"), [], "Marta Ruiz")).toEqual({ key: "history.sent", values: { person: "Marta Ruiz", position: "2", total: "3" } });
    expect(receivedDocumentEventKey(step("overLimit"))).toEqual({ key: "history.overLimit" });
  });

  it("show those steps and that reason with the texts of the design, in Spanish and in English", async () => {
    renderWithProviders(<><ReceivedDocumentHistory detail={sent} zone="UTC" /><ReceivedDocumentHistory detail={overLimit} zone="UTC" /></>);
    expect(await screen.findByText("Se la mandó prellenada a Pablo Sosa, como 1 de 3.")).toBeInTheDocument();
    expect(screen.getByText("Pasó el tope de 3 cargas por mensaje: quedó para revisar acá.")).toBeInTheDocument();
    expect(screen.queryByText(/history\./)).not.toBeInTheDocument();
    await i18n.loadLanguages("en");
    const es = i18n.getFixedT("es", "formDocuments"), en = i18n.getFixedT("en", "formDocuments");
    expect(es("reasons.forReviewOverLimit")).toBe("Pasó el tope de 3 cargas por mensaje.");
    expect(en("history.sent", { person: "Marta Ruiz", position: "1", total: "3" })).toBe("Sent prefilled to Marta Ruiz, as 1 of 3.");
    expect(en("history.overLimit")).toBe("It went over the limit of 3 loads per message: left to review here.");
    expect(en("reasons.forReviewOverLimit")).toBe("It went over the limit of 3 loads per message.");
  });
});
