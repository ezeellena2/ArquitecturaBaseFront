import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import { formatTimeInZone } from "@/shared/lib/dateTime";
import { previewText } from "../lib/messagePresentation";
import type { Chat, Thread } from "../api/chat";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
// The two observable costs of a redraw: the time of every message in the history and the preview of every chat in the inbox.
vi.mock("@/shared/lib/dateTime", async importOriginal => {
  const actual = await importOriginal<typeof import("@/shared/lib/dateTime")>();
  return { ...actual, formatTimeInZone: vi.fn(actual.formatTimeInZone) };
});
vi.mock("../lib/messagePresentation", async importOriginal => {
  const actual = await importOriginal<typeof import("../lib/messagePresentation")>();
  return { ...actual, previewText: vi.fn(actual.previewText) };
});

const contact: Chat = { id: "chat-1", profileName: "Ana", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 2, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 3, unreadCount: 0, preview: "¿Llegó el pedido?" };
const message = (sequence: number, body: string, minutesAgo: number) => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const, id: `message-${sequence}`, direction: "Inbound" as const, body, kind: "Text" as const, occurredAtUtc: new Date(Date.now() - minutesAgo * 60_000).toISOString(), inboundSequence: sequence, operatorUserId: null, status: null, errorCode: null });
function serve(records: boolean) {
  const thread = { assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact, canReadFormRecords: records, outgoing: [], beforeAtUtc: null, beforeId: null,
    messages: [message(1, "Hola", 30), message(2, "Quería consultar algo", 20), message(3, "¿Llegó el pedido?", 10)] } as unknown as Thread;
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send", ...(records ? ["formrecords.read"] : [])] })),
    http.get("/api/whatsapp/chats", () => HttpResponse.json({ page: { items: [contact, { ...contact, id: "chat-2", profileName: "Luis", preview: "Gracias" }], totalCount: 2, page: 1, pageSize: 20, totalPages: 1 }, allCount: 2, unreadCount: 0 })),
    http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json(thread)),
    http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })));
}
beforeEach(() => { queryClient.clear(); });
afterEach(() => { queryClient.clear(); vi.clearAllMocks(); });

// Typing a reply redraws the composer only: the inbox and the history, with a time per message, stay as they were
// (performance review 26, 2026-11-07). Without form records the thread is stripped of private values, also on every read.
for (const records of [false, true]) it(`redraws neither the inbox nor the history while typing a reply ${records ? "with" : "without"} form records`, async () => {
  serve(records);
  renderRouteWithProviders("/whatsapp/chat");
  await userEvent.click(await screen.findByRole("button", { name: "Ana" }));
  const input = await screen.findByLabelText("Respuesta al cliente");
  await screen.findByText("Quería consultar algo");
  // The first letter turns the preview into «Borrador sin enviar» and turns off reusing a failed text: that one redraws.
  fireEvent.change(input, { target: { value: "H" } });
  expect(await screen.findByText("Borrador sin enviar")).toBeInTheDocument();
  vi.mocked(formatTimeInZone).mockClear();
  vi.mocked(previewText).mockClear();
  for (const value of ["Ho", "Hol", "Hola"]) fireEvent.change(input, { target: { value } });
  expect(input).toHaveValue("Hola");
  expect(screen.getByText("Borrador sin enviar")).toBeInTheDocument();
  expect(formatTimeInZone).not.toHaveBeenCalled();
  expect(previewText).not.toHaveBeenCalled();
});
