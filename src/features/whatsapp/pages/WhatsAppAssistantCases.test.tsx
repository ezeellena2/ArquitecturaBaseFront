import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import type { Chat, NeedsPerson, Thread } from "../api/chat";

// Casos del asistente (AS4) in the chat: «Necesita una persona» in the row, the filter with its count, the mark in the header with
// the strip that says why, and that it goes away when the server stops sending it.
vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
const needsPerson: NeedsPerson = { reasonCode: "case", reason: "Pide hablar con una persona.", atUtc: "2026-11-11T13:19:00Z" };
let ana: Chat;
let thread: Thread;
let queries: URLSearchParams[];
const luis: Chat = { id: "chat-2", profileName: "Luis", phoneNumber: "+54 9 351 555-0000", mode: "Assistant", modeRevision: 1, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 0, preview: "Gracias" };
beforeEach(() => {
  queryClient.clear(); queries = [];
  ana = { id: "chat-1", profileName: "Ana", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 3, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 1, preview: "Mensaje del asistente", needsPerson };
  thread = { assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact: ana, messages: [{ audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: "message-1", direction: "Inbound", body: "Quiero hablar con alguien", kind: "Text", occurredAtUtc: ana.lastInboundAtUtc, inboundSequence: 1, operatorUserId: null, status: null, errorCode: null }], outgoing: [], beforeAtUtc: null, beforeId: null };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send"] })),
    http.get("/api/whatsapp/chats", ({ request }) => {
      const query = new URL(request.url).searchParams; queries.push(query);
      const items = query.get("needsPerson") === "true" ? [ana].filter(chat => chat.needsPerson) : [ana, luis];
      return HttpResponse.json({ page: { items, totalCount: items.length, page: 1, pageSize: 20, totalPages: 1 }, allCount: 2, unreadCount: 1, needsPersonCount: ana.needsPerson ? 1 : 0 });
    }),
    http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json(thread)),
    http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const rowOf = async (name: string) => (await screen.findByRole("button", { name })).parentElement!;

it("marks the conversation that needs a person in its row, between the name and the preview", async () => {
  renderRouteWithProviders("/whatsapp/chat");
  const row = await rowOf("Ana");
  const mark = within(row).getByText("Necesita una persona");
  expect(mark.compareDocumentPosition(within(row).getByText("Mensaje del asistente"))).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  expect(within(await rowOf("Luis")).queryByText("Necesita una persona")).not.toBeInTheDocument();
});
it("filters the conversations that need a person with its count, next to the other two", async () => {
  renderRouteWithProviders("/whatsapp/chat");
  const group = await screen.findByRole("group", { name: "Mostrar" });
  const filter = await within(group).findByRole("button", { name: "Necesita una persona (1)" });
  expect(within(group).getAllByRole("button").map(button => button.textContent)).toEqual(["Todos (2)", "Sin leer (1)", "Necesita una persona (1)"]);
  expect(filter).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(filter);
  expect(filter).toHaveAttribute("aria-pressed", "true");
  expect(within(group).getByRole("button", { name: "Todos (2)" })).toHaveAttribute("aria-pressed", "false");
  await waitFor(() => expect(queries.at(-1)?.get("needsPerson")).toBe("true"));
  expect(queries.at(-1)?.get("unreadOnly")).toBe("false");
  await waitFor(() => expect(screen.queryByRole("button", { name: "Luis" })).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Ana" })).toBeInTheDocument();
  await userEvent.click(within(group).getByRole("button", { name: "Sin leer (1)" }));
  await waitFor(() => expect(queries.at(-1)?.get("unreadOnly")).toBe("true"));
  expect(queries.at(-1)?.has("needsPerson")).toBe(false);
});
it("says that no conversation needs a person with the empty state of a filter", async () => {
  ana = { ...ana, needsPerson: undefined };
  renderRouteWithProviders("/whatsapp/chat");
  await userEvent.click(await screen.findByRole("button", { name: "Necesita una persona (0)" }));
  expect(await screen.findByText("No hay conversaciones con esos filtros.")).toBeInTheDocument();
});
it("shows the mark in the header and why in a strip under it, without repeating the mark to the eye nor «Motivo:»", async () => {
  renderRouteWithProviders("/whatsapp/chat");
  await userEvent.click(await screen.findByRole("button", { name: "Ana" }));
  await screen.findByLabelText("Respuesta al cliente");
  const header = screen.getByRole("heading", { name: "Ana" }).closest("header")!;
  expect(within(header).getByText("Necesita una persona")).toBeInTheDocument();
  expect(within(header).getByText("Atención manual")).toBeInTheDocument();
  const strip = screen.getAllByRole("status").find(item => item.textContent?.includes("Pide hablar con una persona."))!;
  // The strip names the mark only for a screen reader: the header already shows it.
  expect(within(strip).getByText("Necesita una persona:", { exact: false })).toHaveClass("sr-only");
  expect(strip).not.toHaveTextContent("Motivo");
  expect(within(strip).getByRole("button", { name: "Más información sobre Necesita una persona" })).toHaveAccessibleDescription("Se quita cuando alguien le responde.");
});
it.each([
  ["dailyReplyLimit", null, "Llegó al tope de respuestas del día"],
  ["dailyOfferLimit", null, "Llegó al tope de ofrecimientos del día"],
  ["replyTooLong", null, "La respuesta no pasó los límites"],
  ["blockedTopic", null, "Le preguntaron por un tema que no responde"],
  ["unknown", null, "No encontró la respuesta en lo cargado"],
  ["button", "Hablar con alguien", "Tocó «Hablar con alguien»"],
  ["newCode", null, "Lo derivó el asistente"],
])("says the reason %s in the strip with the words of the screen", async (reasonCode, reason, text) => {
  ana = { ...ana, needsPerson: { ...needsPerson, reasonCode, reason } };
  thread.contact = ana;
  renderRouteWithProviders("/whatsapp/chat?conversacion=chat-1");
  await screen.findByLabelText("Respuesta al cliente");
  expect(screen.getAllByRole("status").find(item => item.textContent?.includes(text))).toBeDefined();
});
it("takes the mark away when the server stops sending it, after a person answers", async () => {
  server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
    const { requestId, body } = await request.json() as { requestId: string; body: string };
    thread = { ...thread, contact: { ...ana, needsPerson: undefined }, outgoing: [{ quickReplies: null, assistant: null, origin: "Conversation", id: "out-1", requestId, body, state: "Pending", operatorUserId: currentUser.id, requestedAtUtc: new Date().toISOString(), waMessageId: null }] };
    ana = { ...ana, needsPerson: undefined };
    return HttpResponse.json(thread.outgoing[0], { status: 202 });
  }));
  renderRouteWithProviders("/whatsapp/chat?conversacion=chat-1");
  const input = await screen.findByLabelText("Respuesta al cliente");
  expect(within(screen.getByRole("heading", { name: "Ana" }).closest("header")!).getByText("Necesita una persona")).toBeInTheDocument();
  fireEvent.change(input, { target: { value: "Hola Ana, soy Pablo." } });
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(screen.queryByText("Pide hablar con una persona.")).not.toBeInTheDocument());
  expect(screen.queryByText("Necesita una persona")).not.toBeInTheDocument();
  expect(await screen.findByRole("button", { name: "Necesita una persona (0)" })).toBeInTheDocument();
});
