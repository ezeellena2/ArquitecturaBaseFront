import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { queryClient } from "@/shared/api/queryClient";
import type { Chat, Outgoing, Thread } from "../api/chat";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
let contact: Chat;
let thread: Thread;
let requests: { requestId: string; body: string }[];
const pending = (requestId: string, body: string): Outgoing => ({ id: "pending-1", requestId, body, state: "Pending", operatorUserId: currentUser.id, requestedAtUtc: "2026-10-02T12:00:00Z", waMessageId: null });
beforeEach(() => {
  queryClient.clear(); requests = [];
  contact = { id: "chat-1", profileName: "Ana", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 2, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 1, preview: "Hola" };
  thread = { contact, messages: [{ id: "message-1", direction: "Inbound", body: "Hola", kind: "Text", occurredAtUtc: contact.lastInboundAtUtc, inboundSequence: 1, operatorUserId: null, status: null, errorCode: null }], outgoing: [], beforeAtUtc: null, beforeId: null };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send", "whatsapp.manage"] })),
    http.get("/api/whatsapp/chats", () => HttpResponse.json({ page: { items: [contact, { ...contact, id: "chat-2", profileName: "Luis" }], totalCount: 2, page: 1, pageSize: 20, totalPages: 1 }, allCount: 2, unreadCount: 1 })),
    http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json(thread)),
    http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })),
    http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => { const body = await request.json() as typeof requests[number]; requests.push(body); thread.outgoing = [pending(body.requestId, body.body)]; return HttpResponse.json(thread.outgoing[0], { status: 202 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const open = async () => { renderRouteWithProviders("/whatsapp/chat"); await userEvent.click(await screen.findByRole("button", { name: "Ana" })); return screen.findByLabelText("Respuesta al cliente"); };

describe("WhatsAppChatPage", () => {
  it("keeps manual attention without offering the retired login bot", async () => {
    await open();
    expect(screen.queryByRole("button", { name: "Activar bot" })).not.toBeInTheDocument();
  });
  it("uses a safe localized preview for an access event", async () => {
    Object.assign(contact, { previewPurpose: "Access", previewAccessEventKind: "Invitation", preview: "secreto 123456" });
    await open();
    expect(screen.getAllByText("Invitación enviada")).toHaveLength(2);
    expect(screen.queryByText(/secreto 123456/)).not.toBeInTheDocument();
  });
  it("preserves drafts across conversations and prevents a second send while delivery is pending", async () => {
    const input = await open(); fireEvent.change(input, { target: { value: "Te confirmo el pedido" } });
    await userEvent.click(screen.getByRole("button", { name: "Luis" }));
    expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Ana" }));
    expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Te confirmo el pedido");
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await waitFor(() => expect(requests).toHaveLength(1));
    await waitFor(() => expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue(""));
    expect(await screen.findByText("En cola", { exact: false })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });
  it("looks up an uncertain committed request without posting again", async () => {
    server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
      const body = await request.json() as typeof requests[number]; requests.push(body); thread.outgoing = [pending(body.requestId, body.body)];
      return HttpResponse.json({ code: "General.Unexpected", traceId: "chat-trace" }, { status: 500 });
    }), http.get("/api/whatsapp/chats/:id/outgoing/:requestId", () => HttpResponse.json(thread.outgoing[0])));
    const input = await open(); fireEvent.change(input, { target: { value: "Respuesta conservada" } });
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const check = (await screen.findAllByRole("button", { name: "Consultar envío" }))[0];
    expect(input).toHaveValue("Respuesta conservada"); expect(input).toBeDisabled();
    await userEvent.click(check);
    await waitFor(() => expect(input).toHaveValue(""));
    expect(requests).toHaveLength(1);
  });
  it("recovers an uncertain send from the notification action without posting again", async () => {
    const lookups = vi.fn(() => HttpResponse.json(thread.outgoing[0]));
    server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
      const body = await request.json() as typeof requests[number]; requests.push(body);
      thread.outgoing = [pending(body.requestId, body.body)];
      return HttpResponse.error();
    }), http.get("/api/whatsapp/chats/:id/outgoing/:requestId", lookups));
    const input = await open(); fireEvent.change(input, { target: { value: "Respuesta conservada" } });
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    const notifications = within(screen.getByRole("region", { name: "Notificaciones alt+T" }));
    await userEvent.click(await notifications.findByRole("button", { name: "Consultar envío" }));
    await waitFor(() => expect(lookups).toHaveBeenCalledOnce());
    await waitFor(() => expect(input).toHaveValue(""));
    expect(requests).toHaveLength(1);
  });
  it("repeats the same identity and frozen body after lookup returns not found", async () => {
    server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
      const body = await request.json() as typeof requests[number]; requests.push(body);
      return requests.length === 1 ? HttpResponse.error() : HttpResponse.json(pending(body.requestId, body.body), { status: 202 });
    }), http.get("/api/whatsapp/chats/:id/outgoing/:requestId", () => new HttpResponse(null, { status: 404 })));
    const input = await open(); fireEvent.change(input, { target: { value: "Mismo pedido" } });
    await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
    await userEvent.click((await screen.findAllByRole("button", { name: "Consultar envío" }))[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Repetir el mismo pedido" }));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1]).toEqual(requests[0]);
  });
  it("requires confirmation and sends the current revision when taking manual attention", async () => {
    contact.mode = "Bot";
    const changes: unknown[] = [];
    server.use(http.put("/api/whatsapp/chats/:id/mode", async ({ request }) => { changes.push(await request.json()); contact.mode = "Manual"; contact.modeRevision++; return new HttpResponse(null, { status: 204 }); }));
    const input = await open(); expect(input).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Tomar atención manual" }));
    expect(changes).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(changes).toEqual([{ mode: "Manual", expectedRevision: 2 }]));
    await waitFor(() => expect(input).toBeEnabled());
  });
  it("denies the route before reading messages when the read permission is missing", async () => {
    const list = vi.fn(() => HttpResponse.json({}));
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: [] })), http.get("/api/whatsapp/chats", list));
    const { router } = renderRouteWithProviders("/whatsapp/chat");
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
    expect(list).not.toHaveBeenCalled();
  });
  it("requires confirmation to review its own uncertainty without repeating or marking it delivered", async () => {
    thread.outgoing = [{ ...pending("request-review", "Resultado externo incierto"), state: "Uncertain" }];
    const reviews: string[] = [];
    server.use(http.post("/api/whatsapp/chats/:id/outgoing/:requestId/review", ({ params }) => {
      reviews.push(params.requestId as string);
      thread.outgoing[0].state = "Reviewed";
      return new HttpResponse(null, { status: 204 });
    }));
    const input = await open();
    expect(input).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Ya revisé el WhatsApp" }));
    expect(reviews).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Confirmar que revisé" }));
    await waitFor(() => expect(reviews).toEqual(["request-review"]));
    expect(await screen.findByText("Revisado por el operador")).toBeInTheDocument();
    await waitFor(() => expect(input).toBeEnabled());
    expect(requests).toEqual([]);
    expect(screen.queryByText("Entregado")).not.toBeInTheDocument();
    expect(screen.queryByText("Leído")).not.toBeInTheDocument();
  });
  it("prepares a confirmed failed message as a draft without overwriting or sending", async () => {
    thread.messages.push({ ...thread.messages[0], id: "failed", direction: "Outbound", body: "Texto fallido conservado", status: "Failed", operatorUserId: currentUser.id });
    const input = await open();
    fireEvent.change(input, { target: { value: "Borrador que estoy escribiendo" } });
    expect(screen.getByRole("button", { name: "Usar este texto en el borrador" })).toBeDisabled();
    expect(input).toHaveValue("Borrador que estoy escribiendo");
    fireEvent.change(input, { target: { value: "" } });
    await userEvent.click(screen.getByRole("button", { name: "Usar este texto en el borrador" }));
    expect(input).toHaveValue("Texto fallido conservado");
    expect(requests).toEqual([]);
  });
  it("reports a lost review response once and keeps the uncertain send blocked", async () => {
    const errors = vi.spyOn(toast, "error");
    thread.outgoing = [{ ...pending("request-review", "Resultado externo incierto"), state: "Uncertain" }];
    server.use(http.post("/api/whatsapp/chats/:id/outgoing/:requestId/review", () => HttpResponse.error()));
    const input = await open();
    await userEvent.click(screen.getByRole("button", { name: "Ya revisé el WhatsApp" }));
    await userEvent.click(screen.getByRole("button", { name: "Confirmar que revisé" }));
    await waitFor(() => expect(errors).toHaveBeenCalledTimes(1));
    expect(errors.mock.calls[0][0]).toBe("No se pudo confirmar la revisión. Actualizá el chat y revisá el estado del envío antes de volver a intentarlo.");
    expect(input).toBeDisabled();
    expect(requests).toEqual([]);
    expect(screen.getByText("Envío sin confirmar")).toBeInTheDocument();
  });
});
