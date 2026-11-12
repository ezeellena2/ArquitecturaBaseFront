import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatMessage } from "../api/chat";
import { buildTimeline } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";

const message = (overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation",
  id: "document", status: null, body: null, direction: "Inbound", kind: "ReceivedDocument", occurredAtUtc: "2026-11-12T15:00:00Z", inboundSequence: 1,
  operatorUserId: null, errorCode: null, ...overrides });
const at = (minute: number) => "2026-11-12T15:0" + minute + ":00Z";

async function timeline(messages: ChatMessage[]) {
  await act(async () => { renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline(messages, [])} actor="me"
    timeZone="America/Argentina/Buenos_Aires" canSend canReuse onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false}
    loadingOlder={false} historyError={false} loadOlder={vi.fn()} />); });
}
const notRead = "No se leyó: el número no tiene una cuenta vinculada. Lo atiende un operador.";
// The bubble's own text, apart from its card: a document says everything in its card, never «Mensaje documento».
const ownText = (bubble: HTMLElement) => bubble.querySelector(".message-bubble > p")?.textContent;

beforeAll(async () => { await i18n.loadNamespaces("whatsapp"); await i18n.loadLanguages(["es", "en"]); });
afterEach(async () => { await i18n.changeLanguage("es"); });

// Task 8 of the documents (DOC2 and DOC4): a document the person sends is its name with its type and its pages and, below, its
// caption, as a spreadsheet; a photo is one page and it is not counted, and one WhatsApp sent without a file name is «Foto». What a
// number without a linked account sent in a row says once, under the last of its documents, that it was not read.
describe("a document received by WhatsApp in the chat", () => {
  it("shows its name, its type with its pages and its caption below, with nothing in the bubble's own text", async () => {
    await timeline([message({ body: "Te paso el pago de La Posta", document: { name: "comprobante-la-posta.pdf", kind: "pdf", pages: 2 } })]);

    const card = screen.getByRole("region", { name: "documento" });
    expect(within(card).getByText("PDF · 2 páginas")).toBeInTheDocument();
    expect(within(card).getByText("comprobante-la-posta.pdf").compareDocumentPosition(within(card).getByText("Te paso el pago de La Posta")))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(ownText(screen.getByRole("article"))).toBe("");
    expect(screen.queryByText(notRead)).not.toBeInTheDocument();
  });

  it("titles a photo without a file name «Foto», and names a photo, a Word, a PDF before its pages, one of another kind and one whose content expired", async () => {
    await timeline([
      message({ id: "unnamed", occurredAtUtc: at(0), document: { kind: "jpeg", pages: 1 } }),
      message({ id: "photo", occurredAtUtc: at(1), document: { name: "comprobante.jpg", kind: "jpeg", pages: 1 } }),
      message({ id: "screenshot", occurredAtUtc: at(2), document: { name: "captura.png", kind: "png", pages: 1 } }),
      message({ id: "word", occurredAtUtc: at(3), document: { name: "aviso-de-pago.docx", kind: "docx" } }),
      message({ id: "one-page", occurredAtUtc: at(4), document: { name: "recibo.pdf", kind: "pdf", pages: 1 } }),
      message({ id: "unprepared", occurredAtUtc: at(5), document: { name: "nuevo.pdf", kind: "pdf" } }),
      message({ id: "other", occurredAtUtc: at(6), document: { name: "archivo" } }),
      message({ id: "expired", occurredAtUtc: at(7) }),
    ]);

    expect(screen.getAllByRole("region", { name: "documento" }).map(region => region.textContent)).toEqual(["Foto", "comprobante.jpgFoto", "captura.pngFoto",
      "aviso-de-pago.docxWord", "recibo.pdfPDF · 1 página", "nuevo.pdfPDF", "archivoDocumento", "DocumentoYa no está disponible."]);
    expect(screen.getAllByRole("article").map(ownText)).toEqual(Array(8).fill(""));
  });

  it("says once, under the last of the documents a number without a linked account sent in a row, that they were not read", async () => {
    await timeline([
      message({ id: "budget", occurredAtUtc: at(0), document: { name: "presupuesto.pdf", kind: "pdf", pages: 1, reasonCode: "notLinked" } }),
      message({ id: "receipt", occurredAtUtc: at(1), body: "Te mando el comprobante de la seña", document: { kind: "jpeg", pages: 1, reasonCode: "notLinked" } }),
    ]);

    const [first, last] = screen.getAllByRole("article");
    const line = screen.getByText(notRead);
    expect(last).not.toContainElement(line);
    expect(last.compareDocumentPosition(line)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(line.id).not.toBe("");
    expect(last).toHaveAttribute("aria-describedby", line.id);
    expect(last).toHaveAccessibleDescription(notRead);
    expect(first).not.toHaveAttribute("aria-describedby");
    expect(within(last).getByText("Te mando el comprobante de la seña")).toBeInTheDocument();
  });

  it("writes the pages with the thousands of the language", async () => {
    await timeline([message({ document: { name: "manual.pdf", kind: "pdf", pages: 1250 } })]);
    expect(screen.getByText("PDF · 1.250 páginas")).toBeInTheDocument();
  });

  it("says it in English, with the English thousands", async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
    await timeline([message({ id: "pdf", occurredAtUtc: at(0), document: { name: "manual.pdf", kind: "pdf", pages: 1250 } }),
      message({ id: "photo", occurredAtUtc: at(1), body: "Here is the deposit receipt", document: { kind: "jpeg", pages: 1, reasonCode: "notLinked" } }),
      message({ id: "word", occurredAtUtc: at(2), document: { name: "notice.docx", kind: "docx" } }),
      message({ id: "expired", occurredAtUtc: at(3) })]);
    const regions = screen.getAllByRole("region", { name: "document" });
    expect(regions.map(region => region.textContent)).toEqual(["manual.pdfPDF · 1,250 pages", "PhotoHere is the deposit receipt", "notice.docxWord",
      "DocumentIt is no longer available."]);
    expect(screen.getByText("Not read: the number has no linked account. An operator will handle it.")).toBeInTheDocument();
  });
});
