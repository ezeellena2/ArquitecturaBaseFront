import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { currentUserQueryKey } from "@/auth/useCurrentUser";
import { queryClient } from "@/shared/api/queryClient";
import * as chatApi from "../api/chat";
import type { Chat, Outgoing, Thread } from "../api/chat";

vi.mock("react-oidc-context", async () => ({ ...(await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context")), useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) }));
let contact: Chat;
let thread: Thread;
let requests: { requestId: string; body: string }[];
const pending = (requestId: string, body: string): Outgoing => ({ quickReplies: null, assistant: null, origin: "Conversation" as const, id: "pending-1", requestId, body, state: "Pending", operatorUserId: currentUser.id, requestedAtUtc: "2026-10-02T12:00:00Z", waMessageId: null });
beforeEach(() => {
  queryClient.clear(); requests = [];
  contact = { id: "chat-1", profileName: "Ana", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 2, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 1, preview: "Hola" };
  thread = { assistantSuggestion: null, assistantAvailability: { state: "notInstalled" }, contact, messages: [{ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const, id: "message-1", direction: "Inbound", body: "Hola", kind: "Text", occurredAtUtc: contact.lastInboundAtUtc, inboundSequence: 1, operatorUserId: null, status: null, errorCode: null }], outgoing: [], beforeAtUtc: null, beforeId: null };
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send", "whatsapp.configureassistant"] })),
    http.get("/api/whatsapp/chats", () => HttpResponse.json({ page: { items: [contact, { ...contact, id: "chat-2", profileName: "Luis" }], totalCount: 2, page: 1, pageSize: 20, totalPages: 1 }, allCount: 2, unreadCount: 1 })),
    http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json(thread)),
    http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })),
    http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => { const body = await request.json() as typeof requests[number]; requests.push(body); thread.outgoing = [pending(body.requestId, body.body)]; return HttpResponse.json(thread.outgoing[0], { status: 202 }); }));
});
afterEach(() => { queryClient.clear(); toast.dismiss(); vi.restoreAllMocks(); });
const open = async () => { renderRouteWithProviders("/whatsapp/chat"); await userEvent.click(await screen.findByRole("button", { name: "Ana" })); return contact.mode === "Assistant" ? screen.findByRole("region", { name: "Asistente" }) : screen.findByLabelText("Respuesta al cliente"); };

function expectPrivateSendOutsideMutationCache(request: typeof requests[number]) {
  const states = JSON.stringify(queryClient.getMutationCache().getAll().map(mutation => mutation.state));
  expect(states).not.toContain(request.body);
  expect(states).not.toContain(request.requestId);
}

it("keeps the frozen text and identity outside MutationCache while sending and guards a second submit", async () => {
  let release!: () => void;
  const response = new Promise<void>(resolve => { release = resolve; });
  server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
    const body = await request.json() as typeof requests[number]; requests.push(body);
    await response;
    thread.outgoing = [pending(body.requestId, body.body)];
    return HttpResponse.json(thread.outgoing[0], { status: 202 });
  }));
  const input = await open(); fireEvent.change(input, { target: { value: "Texto privado durante el envío" } });
  const send = screen.getByRole("button", { name: "Enviar" });
  try {
    act(() => { fireEvent.click(send); fireEvent.click(send); fireEvent.keyDown(input, { key: "Enter", ctrlKey: true }); });
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(input).toBeDisabled();
    expectPrivateSendOutsideMutationCache(requests[0]);
  } finally { await act(async () => release()); }
  await waitFor(() => expect(input).toHaveValue(""));
  expect(requests).toHaveLength(1);
});

it("keeps confirmed text and identity outside MutationCache after accepting the send", async () => {
  const input = await open(); fireEvent.change(input, { target: { value: "Texto privado del recibo confirmado" } });
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  await waitFor(() => expect(input).toHaveValue(""));
  expectPrivateSendOutsideMutationCache(requests[0]);
});

for (const failure of ["network", "500", "400"] as const) it("keeps the draft outside MutationCache after a " + failure + " send result", async () => {
  server.use(http.post("/api/whatsapp/chats/:id/messages", async ({ request }) => {
    const body = await request.json() as typeof requests[number]; requests.push(body);
    return failure === "network" ? HttpResponse.error() : HttpResponse.json({ code: "Test.SendFailed", detail: "No se pudo enviar." }, { status: Number(failure) });
  }));
  const input = await open(); fireEvent.change(input, { target: { value: "Texto privado conservado ante el fallo" } });
  await userEvent.click(screen.getByRole("button", { name: "Enviar" }));
  if (failure === "400") await waitFor(() => expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled());
  else await screen.findAllByRole("button", { name: "Consultar envío" });
  expect(input).toHaveValue("Texto privado conservado ante el fallo");
  expect(input).toHaveProperty("disabled", failure !== "400");
  expectPrivateSendOutsideMutationCache(requests[0]);
  expect(requests).toHaveLength(1);
});

it("replaces the visible composer with the primary manual attention control in Assistant mode", async () => {
  contact.mode = "Assistant";
  renderRouteWithProviders("/whatsapp/chat");
  await userEvent.click(await screen.findByRole("button", { name: "Ana" }));
  const controls = await screen.findByRole("region", { name: "Asistente" });
  expect(within(controls).getByText("El asistente atiende esta conversación. Para escribirle vos, tomá la atención manual.")).toBeVisible();
  expect(within(controls).getByRole("button", { name: "Tomar atención manual" })).toHaveAttribute("data-variant", "default");
  expect(screen.queryByRole("textbox", { name: "Respuesta al cliente" })).not.toBeInTheDocument();
  expect(within(screen.getByRole("heading", { name: "Ana" }).closest("header")!).getByText("Asistente", { selector: '[data-slot="badge"]' })).toBeInTheDocument();
});

it("keeps assistant unavailability inline across refresh and reopening without repeating notifications", async () => {
  const warnings = vi.spyOn(toast, "warning");
  thread.assistantAvailability = { state: "paused" };
  await open();
  const reason = await screen.findByText("El asistente está pausado.");
  expect(reason.closest('[role="status"]')).not.toBeNull();
  expect(screen.getByText("La conversación sigue en atención manual.")).toBeVisible();
  await act(async () => { await queryClient.invalidateQueries({ queryKey: chatApi.chatKey }); });
  await userEvent.click(screen.getByRole("button", { name: "Luis" }));
  await userEvent.click(screen.getByRole("button", { name: "Ana" }));
  await screen.findByRole("textbox", { name: "Respuesta al cliente" });
  expect(screen.getAllByText("El asistente está pausado.")).toHaveLength(1);
  expect(warnings).not.toHaveBeenCalled();
});

it("does not describe Manual continuity while an unavailable Assistant owns the conversation", async () => {
  contact.mode = "Assistant";
  thread.assistantAvailability = { state: "paused" };
  await open();
  expect(screen.getByText("El asistente está pausado.")).toBeVisible();
  expect(screen.queryByText("La conversación sigue en atención manual.")).not.toBeInTheDocument();
});

describe("WhatsAppChatPage", () => {
  it("opens a conversation linked from a form response without sending anything", async () => {
    const id = "0199a0c0-0000-7000-8000-000000000061";
    contact.id = id;
    renderRouteWithProviders("/whatsapp/chat?conversacion=" + id);
    expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("");
    expect(requests).toHaveLength(0);
  });
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
    contact.mode = "Assistant";
    const changes: unknown[] = [];
    server.use(http.put("/api/whatsapp/chats/:id/mode", async ({ request }) => { changes.push(await request.json()); contact.mode = "Manual"; contact.modeRevision++; return HttpResponse.json({ mode: contact.mode, modeRevision: contact.modeRevision, assistantSendInProgress: false }); }));
    await open(); expect(screen.queryByRole("textbox", { name: "Respuesta al cliente" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Tomar atención manual" }));
    expect(changes).toEqual([]);
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tomar atención manual" }));
    await waitFor(() => expect(changes).toEqual([{ mode: "Manual", expectedRevision: 2 }]));
    expect(await screen.findByRole("textbox", { name: "Respuesta al cliente" })).toBeEnabled();
  });
  it("denies the route before reading messages when the read permission is missing", async () => {
    const list = vi.fn(() => HttpResponse.json({}));
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: [] })), http.get("/api/whatsapp/chats", list));
    const { router } = renderRouteWithProviders("/whatsapp/chat");
    await waitFor(() => expect(router.state.location.pathname).toBe("/sin-permiso"));
    expect(list).not.toHaveBeenCalled();
  });
  it("keeps the visible inbox when a refresh fails and tells it only in a notification, not next to the title", async () => {
    const errors = vi.spyOn(toast, "error");
    renderRouteWithProviders("/whatsapp/chat");
    await screen.findByRole("button", { name: "Ana" });
    server.use(http.get("/api/whatsapp/chats", () => HttpResponse.json({ code: "General.Unexpected" }, { status: 500 })));
    await userEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(errors).toHaveBeenCalledTimes(1));
    // Page.status shows only the state of the object; the conversations stay as they were.
    expect(screen.queryByText("No se pudo actualizar. Se conserva el historial visible.")).not.toBeInTheDocument();
    expect(screen.queryByText("No se pudo cargar el chat.")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ana" })).toBeVisible();
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


it("removes inbox and thread payloads on permission changes without discarding the private text draft", async () => {
  contact.preview = "obsolete inbox marker";
  thread.messages[0].body = "obsolete thread marker";
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send", "formrecords.read"] })));
  const input = await open();
  fireEvent.change(input, { target: { value: "Private draft kept" } });
  expect(JSON.stringify(queryClient.getQueryCache().getAll().map(q => q.state.data))).toContain("obsolete inbox marker");
  contact.preview = "Allowed inbox"; thread.messages[0].body = "Allowed history";
  act(() => { queryClient.setQueryData(currentUserQueryKey, { ...currentUser, permissions: ["whatsapp.read", "whatsapp.send"] }); });
  await waitFor(() => expect(screen.queryByText("obsolete thread marker")).not.toBeInTheDocument());
  await waitFor(() => expect(JSON.stringify(queryClient.getQueryCache().getAll().map(q => q.state.data))).not.toContain("obsolete"));
  expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Private draft kept");
  expect(await screen.findByText("Allowed history")).toBeInTheDocument();
});


it("cancels an in-flight inbox query and refuses its old result after form record permission is revoked", async () => {
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "formrecords.read"] })));
  let resolve!: (value: Awaited<ReturnType<typeof chatApi.listChats>>) => void;
  const safe = { page: { items: [{ ...contact, preview: "Authorized inbox" }], totalCount: 1, page: 1, pageSize: 20, totalPages: 1 }, allCount: 1, unreadCount: 0 };
  const reads = vi.spyOn(chatApi, "listChats").mockImplementationOnce(() => new Promise(done => { resolve = done; })).mockResolvedValue(safe);
  renderRouteWithProviders("/whatsapp/chat");
  await waitFor(() => expect(reads).toHaveBeenCalledOnce());
  const oldSignal = reads.mock.calls[0][3]!;
  act(() => { queryClient.setQueryData(currentUserQueryKey, { ...currentUser, permissions: ["whatsapp.read"] }); });
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
  expect(oldSignal.aborted).toBe(true);
  await act(async () => { resolve({ ...safe, page: { ...safe.page, items: [{ ...contact, preview: "revoked inbox marker" }] } }); });
  expect(JSON.stringify(queryClient.getQueryCache().getAll().map(q => q.state.data))).not.toContain("revoked inbox marker");
  expect(await screen.findByText("Authorized inbox")).toBeInTheDocument();
});

it("takes manual attention with Send alone and reports only the observed assistant send in progress", async () => {
  contact.mode = "Assistant";
  contact.lastInboundAtUtc = "2020-01-01T00:00:00Z";
  thread.outgoing = [{ ...pending("assistant-pending", "Ya empezó"), origin: "Assistant", operatorUserId: null, state: "Sending" }];
  const changes: unknown[] = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send"] })),
    http.put("/api/whatsapp/chats/:id/mode", async ({ request }) => {
      changes.push(await request.json()); contact.mode = "Manual"; contact.modeRevision++;
      return HttpResponse.json({ mode: contact.mode, modeRevision: contact.modeRevision, assistantSendInProgress: true });
    }));
  await open();
  const take = screen.getByRole("button", { name: "Tomar atención manual" });
  expect(take).toBeEnabled();
  await userEvent.click(take);
  expect(changes).toEqual([]);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tomar atención manual" }));
  await waitFor(() => expect(changes).toEqual([{ mode: "Manual", expectedRevision: 2 }]));
  expect(await screen.findByText(/El asistente estaba mandando un formulario/)).toBeInTheDocument();
});

it("retires the manual mode confirmation immediately when Send is revoked", async () => {
  contact.mode = "Assistant";
  const change = vi.fn(() => HttpResponse.json({ mode: "Manual", modeRevision: 3, assistantSendInProgress: false }));
  server.use(http.put("/api/whatsapp/chats/:id/mode", change));
  await open();
  await userEvent.click(screen.getByRole("button", { name: "Tomar atención manual" }));
  expect(screen.getByRole("dialog")).toBeInTheDocument();
  act(() => queryClient.setQueryData(currentUserQueryKey, { ...currentUser, permissions: ["whatsapp.read", "whatsapp.configureassistant"] }));
  await within(await screen.findByRole("region", { name: "Asistente" })).findByText("Tenés permiso para ver el chat. Para contestar necesitás el permiso de responder.");
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Tomar atención manual" })).not.toBeInTheDocument();
  expect(change).not.toHaveBeenCalled();
});
it("cancels taking manual attention without changing the mode and returns focus to its trigger", async () => {
  contact.mode = "Assistant";
  const change = vi.fn(); server.use(http.put("/api/whatsapp/chats/:id/mode", change));
  await open();
  const take = screen.getByRole("button", { name: "Tomar atención manual" });
  await userEvent.click(take);
  await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(change).not.toHaveBeenCalled();
  await waitFor(() => expect(take).toHaveFocus());
});

it("enables Assistant with ConfigureAssistant alone after explicit confirmation and sends no message", async () => {
  thread.assistantAvailability = { state: "available" };
  const changes: unknown[] = [];
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.configureassistant"] })),
    http.put("/api/whatsapp/chats/:id/mode", async ({ request }) => {
      changes.push(await request.json()); contact.mode = "Assistant"; contact.modeRevision++;
      return HttpResponse.json({ mode: contact.mode, modeRevision: contact.modeRevision, assistantSendInProgress: false });
    }));
  await open();
  expect(screen.queryByRole("button", { name: "Enviar" })).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: "Pasar a modo Asistente" }));
  const dialog = screen.getByRole("dialog", { name: "Pasar a modo Asistente" });
  expect(changes).toEqual([]); expect(requests).toEqual([]);
  await userEvent.click(within(dialog).getByRole("button", { name: "Pasar a Asistente" }));
  await waitFor(() => expect(changes).toEqual([{ mode: "Assistant", expectedRevision: 2 }]));
  expect(screen.queryByRole("button", { name: "Tomar atención manual" })).not.toBeInTheDocument();
  expect(requests).toEqual([]);
});
it.each(["notInstalled", "notConfigured", "paused", "modelNotQualified"] as const)("does not offer Assistant when its real availability is %s", async state => {
  thread.assistantAvailability = { state };
  await open();
  expect(screen.queryByRole("button", { name: "Pasar a modo Asistente" })).not.toBeInTheDocument();
  expect(requests).toEqual([]);
});

it("keeps keyboard focus in the conversation after the mode trigger disappears on success", async () => {
  contact.mode = "Assistant";
  server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["whatsapp.read", "whatsapp.send"] })),
    http.put("/api/whatsapp/chats/:id/mode", () => { contact.mode = "Manual"; contact.modeRevision++; return HttpResponse.json({ mode: contact.mode, modeRevision: contact.modeRevision, assistantSendInProgress: false }); }));
  await open();
  const take = screen.getByRole("button", { name: "Tomar atención manual" });
  await userEvent.click(take);
  await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Tomar atención manual" }));
  await waitFor(() => expect(take).not.toBeInTheDocument());
  await waitFor(() => expect(screen.getByRole("heading", { name: "Ana" })).toHaveFocus());
});
