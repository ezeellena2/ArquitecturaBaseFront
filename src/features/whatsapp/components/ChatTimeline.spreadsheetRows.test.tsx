import { act, screen, within } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { queryClient } from "@/shared/api/queryClient";
import i18n from "@/shared/i18n";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders, renderWithProviders } from "@/test/utils/renderWithProviders";
import { createChatDocumentVisualFixtures } from "@/test/visual/chatDocumentFixtures";
import type { ChatMessage, SpreadsheetRows } from "../api/chat";
import type { ChatFormMetadata } from "../api/formMetadata";
import { buildTimeline } from "../lib/timeline";
import { spreadsheetRowGroups } from "../lib/spreadsheetRows";
import { ChatTimeline } from "./ChatTimeline";

vi.mock("react-oidc-context", async () => ({ ...await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context"), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "test" } }) }));

// VC1-A (task 30): the notice of the loads of a spreadsheet carries «Por qué lo propuso», in two columns: what it recognized, the rows it
// sent, the ones for the team (a run of more than three as a range) and the repeated ones, with the way to «Documentos recibidos» only for
// whoever can open it. Each load is the card of its form, without the footer that only goes to WhatsApp.
const form: ChatFormMetadata = { definitionId: "0199b0c0-0000-7000-8000-000000000421", versionId: "0199b0c0-0000-7000-8000-000000000431", versionNumber: 2,
  name: { es: "Cobranzas", en: "Collections" }, culture: "es" };
const row = (number: number, sheet: string | null = null) => ({ sheet, number });
const rows: SpreadsheetRows = { recognized: [{ form: "Cobranzas", count: 8 }], sent: [row(2), row(3), row(4)], forTeam: [row(5), row(6), row(7), row(8)],
  repeated: [{ row: row(9), recordNumber: "COB-000118", sameAs: null }] };
const message = (overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Assistant", id: "notice", status: "Read",
  body: "Recibí una planilla con 8 filas de «Cobranzas».", direction: "Outbound", kind: "Text", occurredAtUtc: "2026-11-12T13:41:00Z", inboundSequence: 0,
  operatorUserId: null, errorCode: null, purpose: "Business", ...overrides });

async function timeline(messages: ChatMessage[], opensReceivedDocuments: boolean) {
  // The way to the inbox is a link of the app's router.
  await act(async () => { renderWithProviders(<MemoryRouter><ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline(messages, [])} actor="me"
    timeZone="America/Argentina/Buenos_Aires" canSend canReuse onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false}
    loadingOlder={false} historyError={false} loadOlder={vi.fn()} opensReceivedDocuments={opensReceivedDocuments} /></MemoryRouter>); });
}
// Each row of «Por qué lo propuso»: its label and its value.
const pairs = (section: HTMLElement) => [...section.querySelectorAll("dt")].map(term => [term.textContent, term.nextElementSibling?.textContent]);

beforeAll(async () => { await i18n.loadNamespaces("whatsapp"); await i18n.loadLanguages(["es", "en"]); });
afterEach(async () => { await i18n.changeLanguage("es"); });

describe("the rows of a list in «Por qué lo propuso»", () => {
  it("lists up to three rows in a row and reads a longer run as a range, each sheet apart", () => {
    expect(spreadsheetRowGroups([row(2), row(3), row(4)])).toEqual([{ sheet: null, count: 3, parts: [{ from: 2, to: 2 }, { from: 3, to: 3 }, { from: 4, to: 4 }] }]);
    expect(spreadsheetRowGroups([row(8), row(5), row(6), row(7), row(11)])).toEqual([{ sheet: null, count: 5, parts: [{ from: 5, to: 8 }, { from: 11, to: 11 }] }]);
    expect(spreadsheetRowGroups([row(2, "Ventas"), row(4, "Compras"), row(3, "Ventas")])).toEqual([
      { sheet: "Ventas", count: 2, parts: [{ from: 2, to: 2 }, { from: 3, to: 3 }] }, { sheet: "Compras", count: 1, parts: [{ from: 4, to: 4 }] }]);
  });
});

describe("the notice of the loads of a spreadsheet", () => {
  it("says why it proposed them, with the way to the inbox, and draws each load as the card of its form", async () => {
    await timeline([message({ spreadsheetRows: rows }), message({ id: "load-1", kind: "Flow", form, body: "1 de 3 · $95.000 · Ferretería Norte", occurredAtUtc: "2026-11-12T13:41:01Z" })], true);
    const title = await screen.findByText("Por qué lo propuso");
    const section = title.closest("section")!;
    expect(pairs(section)).toEqual([["Reconoció", "8 filas de «Cobranzas», seguro"], ["Mandó", "Filas 2, 3 y 4"], ["Para el equipo", "Filas 5 a 8"],
      ["Repetidas", "Fila 9, ya en COB-000118"]]);
    expect(within(section).getByRole("link", { name: "Ver en Documentos recibidos" })).toHaveAttribute("href", "/formularios/documentos");
    expect(screen.getByText("1 de 3 · $95.000 · Ferretería Norte")).toBeInTheDocument();
    expect(screen.getByText("Cobranzas")).toBeInTheDocument();
  });

  it("names the sheets and a row equal to another, and leaves out the way to the inbox for whoever cannot open it", async () => {
    await timeline([message({ spreadsheetRows: { recognized: [{ form: "Cobranzas", count: 2 }, { form: "Pagos", count: 1 }], sent: [row(2, "Ventas")],
      forTeam: [row(3, "Ventas"), row(2, "Compras")], repeated: [{ row: row(4, "Ventas"), recordNumber: null, sameAs: row(2, "Ventas") }] } })], false);
    const section = (await screen.findByText("Por qué lo propuso")).closest("section")!;
    expect(pairs(section)).toEqual([["Reconoció", "2 filas de «Cobranzas», seguro1 fila de «Pagos», seguro"], ["Mandó", "Ventas · fila 2"],
      ["Para el equipo", "Ventas · fila 3Compras · fila 2"], ["Repetidas", "Ventas · fila 4, igual que Ventas · fila 2"]]);
    expect(within(section).queryByRole("link")).not.toBeInTheDocument();
  });

  // The conversation decides it (`ChatThread`): the scene's reader has formdocuments.read; without it, «Por qué lo propuso» has no link.
  it.each([["with", true], ["without", false]])("opens «Documentos recibidos» from the conversation only %s formdocuments.read", async (_, reads) => {
    const scene = createChatDocumentVisualFixtures("es", "chat-document-rows");
    queryClient.clear();
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: scene.permissions.filter(permission => reads || permission !== "formdocuments.read") })),
      http.get("/api/forms/documents/counts", () => HttpResponse.json({ forReview: 0, unclassified: 0, total: 0 })),
      http.all("/api/whatsapp/chats*", ({ request }) => scene.handle(request)));
    renderRouteWithProviders("/whatsapp/chat?conversacion=chat-marta");
    const section = (await screen.findByText("Por qué lo propuso", {}, { timeout: 10_000 })).closest("section")!;
    expect(within(section).getByText("Filas 5 a 8")).toBeInTheDocument();
    expect(within(section).queryAllByRole("link", { name: "Ver en Documentos recibidos" })).toHaveLength(reads ? 1 : 0);
  }, 20_000);

  it("says it in English", async () => {
    await act(async () => { await i18n.changeLanguage("en"); });
    await timeline([message({ spreadsheetRows: { ...rows, recognized: [{ form: "Collections", count: 8 }], repeated: [{ row: row(9), recordNumber: null, sameAs: row(2) }] } })], true);
    const section = (await screen.findByText("Why it proposed this")).closest("section")!;
    expect(pairs(section)).toEqual([["Recognized", "8 rows of “Collections”, sure"], ["Sent", "Rows 2, 3, and 4"], ["For the team", "Rows 5 to 8"],
      ["Repeated", "Row 9, the same as row 2"]]);
    expect(within(section).getByRole("link", { name: "View in Received documents" })).toBeInTheDocument();
  });
});
