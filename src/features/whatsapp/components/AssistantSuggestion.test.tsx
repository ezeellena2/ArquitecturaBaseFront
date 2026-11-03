import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { chatKey } from "../api/chat";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import * as notifications from "@/shared/ui/notifications";
import { ChatThread } from "./ChatThread";
import type { AssistantSuggestionPointer } from "../api/assistant";
import type { AssistantAvailability } from "../api/chat";
import type { FormReply } from "../api/formReplies";
import type { ChatDraft } from "./ChatComposer";
const chatId = "019abcde-1000-7000-8000-000000000010";
const sourceMessageId = "019abcde-1000-7000-8000-000000000004";
const suggestionId = "019abcde-1000-7000-8000-000000000003";
const fields = [{ fieldId: "019abcde-1000-7000-8000-000000000005", label: "Cliente", displayValue: "Ana" }, { fieldId: "019abcde-1000-7000-8000-000000000006", label: "Fecha", displayValue: "17/10/2026" }];
const proposal = { proposalId: "019abcde-1000-7000-8000-000000000007", definitionId: "019abcde-1000-7000-8000-000000000001", versionId: "019abcde-1000-7000-8000-000000000002", versionNumber: 2, name: "Registrar visita", culture: "es", reason: "Pidió registrar una visita", fields };
const ready = { requestId: suggestionId, sourceMessageId, state: "Ready", proposal, outgoing: null };
let testClient: QueryClient;
let incomingSourceMessageId: string;
let availability: AssistantAvailability["state"];
let currentPointer: AssistantSuggestionPointer | null;
let sourceReply: FormReply | undefined;
const capturedSourceId = "019abcde-1000-7000-8000-000000000014";
function capturedReply(state: "Completed" | "Pending" | "Rejected" = "Completed"): FormReply {
 const metadata = { definitionId: proposal.definitionId, versionId: proposal.versionId, versionNumber: 2, name: "Entrega registrada" };
 return state === "Completed" ? { ...metadata, state, recordId: "019abcde-1000-7000-8000-000000000015", number: "VIS-000001", values: [] } : { ...metadata, state, recordId: null, number: null, values: null };
}
let recipientCulture: "es" | "en";
let eligibilityStatus: "Eligible" | "NoEligibleForms";
let body: typeof ready; let requests: unknown[]; let sends: { requestId: string; includedFieldIds: string[] }[]; let discarded: number;
function receipt(requestId: string) { return { quickReplies: null, id: "019abcde-1000-7000-8000-000000000008", requestId, operatorUserId: "019abcde-1000-7000-8000-000000000009", body: "Completá el formulario", requestedAtUtc: new Date().toISOString(), state: "Pending", waMessageId: null, kind: "Flow", origin: "Conversation", assistant: { reason: proposal.reason, proposedFields: fields }, recoveryPath: null, form: { definitionId: proposal.definitionId, versionId: proposal.versionId, versionNumber: 2, name: { es: proposal.name, en: "Register visit" }, culture: "es" } }; }
function Harness({ actor = "operator", permissions = ["whatsapp.read", "whatsapp.send", "formrecords.read"], id = chatId }: { actor?: string; permissions?: string[]; id?: string }) {
 const client = useQueryClient();
 useEffect(() => { testClient = client; }, [client]);
 const [draft, setDraft] = useState<ChatDraft>({ body: "Borrador que se conserva" });
 return <ChatThread id={id} actor={actor} readPermissions={permissions} canSend={permissions.includes("whatsapp.send")} canConfigureAssistant={false} draft={draft} updateDraft={setDraft} onBack={() => {}} />;
}
beforeEach(() => { recipientCulture = "es"; availability = "available"; currentPointer = null; sourceReply = undefined; incomingSourceMessageId = sourceMessageId; eligibilityStatus = "Eligible"; body = structuredClone(ready); requests = []; sends = []; discarded = 0;
 server.use(http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json({ assistantAvailability: { state: availability }, assistantSuggestion: currentPointer, contact: { id: chatId, profileName: "Juan", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 7, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 0, preview: "Hola", linkedAccount: { userId: "recipient", displayName: "Juan", email: null, isActive: true }, formEligibility: { status: eligibilityStatus, recipientCulture, recipientContextRevision: "context" } }, messages: [{ audio: null, quickReplies: null, id: incomingSourceMessageId, direction: "Inbound", kind: "Text", body: "Quiero registrar una visita", occurredAtUtc: new Date().toISOString(), inboundSequence: incomingSourceMessageId === sourceMessageId ? 1 : 2, operatorUserId: null, status: null, errorCode: null, origin: "Conversation", assistant: null }, ...(sourceReply ? [{ audio: null, quickReplies: null, id: capturedSourceId, direction: "Inbound", kind: "FlowReply", body: null, occurredAtUtc: new Date().toISOString(), inboundSequence: 3, operatorUserId: null, status: null, errorCode: null, origin: "Conversation", assistant: null, formReply: sourceReply }] : [])], outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: true })), http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })), http.post("/api/whatsapp/chats/:id/assistant-suggestions", async ({ request }) => { requests.push(await request.json()); return HttpResponse.json(body, { status: 202 }); }), http.get("/api/whatsapp/chats/:id/assistant-suggestions/:requestId", () => HttpResponse.json(body)), http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", () => { discarded++; return HttpResponse.json({ ...ready, state: "Discarded", proposal: null }); }), http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { const send = await request.json() as { requestId: string; includedFieldIds: string[] }; sends.push(send); return HttpResponse.json(receipt(send.requestId), { status: 202 }); }));
});
afterEach(() => vi.restoreAllMocks());
async function openSuggestion() { renderWithProviders(<Harness />); const action = await screen.findByRole("button", { name: "Revisar y enviar" }); await userEvent.click(action); return { dialog: await screen.findByRole("dialog"), action }; }
// A response held until the test releases it, to see what the chat shows while it waits.
function held() { let release!: () => void; const answer = new Promise<void>(resolve => { release = resolve; }); return { answer, release: () => act(async () => release()) }; }

// No explanation under the title (2026-11-01): what happens with the prefilled data goes in the (i) of its group.
it("reviews a suggestion without explanations under the title, with the prefilled help in the information icon", async () => {
 const { dialog } = await openSuggestion();
 expect(dialog).not.toHaveAttribute("aria-describedby");
 expect(within(dialog).queryByText(/Revisá los datos propuestos/)).not.toBeInTheDocument();
 const help = "Juan los ve cargados y los puede cambiar. Lo que destildes va vacío.";
 expect(within(dialog).getByRole("button", { name: "Más información sobre Datos que van prellenados" })).toHaveAccessibleDescription(help);
 expect(within(dialog).getByRole("group", { name: "Datos que van prellenados" })).toHaveAccessibleDescription(help);
 for (const text of within(dialog).getAllByText(help)) expect(text).not.toBeVisible();
});
// Board LR1: the prefilled data of a suggestion read in two columns under their title, not as «Cliente: Ana · Fecha: …».
it("reads the prefilled data of a suggestion in two columns", async () => {
 renderWithProviders(<Harness />);
 const card = (await screen.findByRole("button", { name: "Revisar y enviar" })).closest("section")!;
 expect(card).not.toHaveTextContent("Cliente:");
 expect(within(card).getByText("Prellenado con")).toBeInTheDocument();
 expect(within(card).getByText("Ana").closest("dd")?.previousElementSibling).toHaveTextContent(/^Cliente$/);
 expect(within(card).getByText("17/10/2026").closest("dd")?.previousElementSibling).toHaveTextContent(/^Fecha$/);
});
it("shows that it looks for a suggestion in the place of the card until the assistant answers", async () => {
 const wait = held();
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions", async ({ request }) => { requests.push(await request.json()); await wait.answer; return HttpResponse.json(body, { status: 202 }); }));
 renderWithProviders(<Harness />);
 try {
  const searching = await screen.findByText("Buscando una sugerencia…");
  expect(searching.closest('[role="status"]')).not.toBeNull();
  expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
 } finally { await wait.release(); }
 expect(await screen.findByRole("button", { name: "Revisar y enviar" })).toBeInTheDocument();
 expect(screen.queryByText("Buscando una sugerencia…")).not.toBeInTheDocument();
});
it("keeps telling that it looks for a suggestion while the assistant has it pending", async () => {
 body = { ...ready, state: "Pending", proposal: null as unknown as typeof proposal };
 renderWithProviders(<Harness />);
 const searching = await screen.findByText("Buscando una sugerencia…");
 expect(searching.closest('[role="status"]')).not.toBeNull();
 await waitFor(() => expect(requests).toHaveLength(1));
 expect(screen.getByText("Buscando una sugerencia…")).toBeInTheDocument();
 expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
});
it("shows that it discards the suggestion until the discard answers", async () => {
 const wait = held();
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", async () => { discarded++; await wait.answer; return HttpResponse.json({ ...ready, state: "Discarded", proposal: null }); }));
 renderWithProviders(<Harness />);
 try {
  await userEvent.click(await screen.findByRole("button", { name: "No, gracias" }));
  const working = await screen.findByRole("button", { name: "Descartando…" });
  expect(working).toHaveAttribute("aria-busy", "true");
  expect(working).toBeDisabled();
  expect(screen.getByRole("button", { name: "Revisar y enviar" })).toBeDisabled();
 } finally { await wait.release(); }
 await waitFor(() => expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument());
 expect(discarded).toBe(1);
});
it("shows that it saves the suggested send until it answers, without letting the dialog close", async () => {
 const wait = held();
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { const send = await request.json() as typeof sends[number]; sends.push(send); await wait.answer; return HttpResponse.json(receipt(send.requestId), { status: 202 }); }));
 const { dialog } = await openSuggestion();
 try {
  await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
  const working = await within(dialog).findByRole("button", { name: "Guardando…" });
  expect(working).toHaveAttribute("aria-busy", "true");
  expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeDisabled();
 } finally { await wait.release(); }
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(sends).toHaveLength(1);
});
// Checking a lost send is a read: it shows that it works and the dialog can still be closed (not frozen without a signal).
it("shows that it checks a lost suggested send while the dialog can still be closed", async () => {
 const wait = held();
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { sends.push(await request.json() as typeof sends[number]); return HttpResponse.error(); }),
  http.get("/api/whatsapp/chats/:id/assistant-suggestions/:requestId", async () => { await wait.answer; return HttpResponse.json({ ...ready, state: "Sent", proposal: null, outgoing: receipt("019abcde-1000-7000-8000-000000000011") }); }));
 const { dialog } = await openSuggestion();
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 const check = await within(dialog).findByRole("button", { name: "Consultar envío" });
 try {
  await userEvent.click(check);
  const working = await within(dialog).findByRole("button", { name: "Consultando…" });
  expect(working).toHaveAttribute("aria-busy", "true");
  expect(working).toBeDisabled();
  expect(within(dialog).getByRole("button", { name: "Cancelar" })).toBeEnabled();
  expect(within(dialog).getByRole("button", { name: "Cerrar" })).toBeEnabled();
 } finally { await wait.release(); }
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(sends).toHaveLength(1);
});
it("requests one shared suggestion and sends only explicitly included IDs through the existing form dialog", async () => {
 const { dialog } = await openSuggestion();
 expect(requests).toHaveLength(1); expect(requests[0]).toMatchObject({ sourceMessageId, expectedModeRevision: 7 });
 expect(within(dialog).getByText(/Registrar visita/)).toBeInTheDocument();
 expect(within(dialog).queryByRole("textbox")).not.toBeInTheDocument();
 await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fecha" }));
 expect(sends).toEqual([]);
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await waitFor(() => expect(sends).toHaveLength(1));
 expect(Object.keys(sends[0]).sort()).toEqual(["includedFieldIds", "requestId"]);
 expect(sends[0].includedFieldIds).toEqual([fields[0].fieldId]);
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Borrador que se conserva");
 expect(screen.getByRole("heading", { name: "Juan" })).toHaveFocus();
});
// The wait of a 429 is not written above the footer: the notification tells it once and then it is the help of the disabled send.
it("explains the wait of a suggested send as help of the footer action", async () => {
 const notice = vi.spyOn(notifications, "notify").mockImplementation(() => "");
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { sends.push(await request.json() as typeof sends[number]); return HttpResponse.json({ code: "General.TooManyRequests" }, { status: 429, headers: { "Retry-After": "30" } }); }));
 const { dialog } = await openSuggestion();
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 const wait = /^Esperá [0-9]+ segundos antes de volver a consultar o enviar\.$/;
 await waitFor(() => expect(within(dialog).getByRole("button", { name: "Enviar formulario" })).toHaveAccessibleDescription(wait));
 expect(within(dialog).getByRole("button", { name: "Enviar formulario" })).toBeDisabled();
 expect(within(dialog).getAllByText(wait)).toHaveLength(1);
 expect(notice).toHaveBeenCalledWith(expect.objectContaining({ kind: "error", message: expect.stringMatching(wait) }));
 expect(sends).toHaveLength(1);
});
// Outside the dialog the wait also turns off «No, gracias» and «Revisar y enviar»: it is their reason, not only the notification's.
it("gives the wait of a 429 as the reason of the suggestion actions", async () => {
 vi.spyOn(notifications, "notify").mockImplementation(() => "");
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", () => { discarded++; return HttpResponse.json({ code: "General.TooManyRequests" }, { status: 429, headers: { "Retry-After": "30" } }); }));
 renderWithProviders(<Harness />);
 await userEvent.click(await screen.findByRole("button", { name: "No, gracias" }));
 const wait = /^Esperá [0-9]+ segundos antes de volver a consultar o enviar\.$/;
 for (const name of ["No, gracias", "Revisar y enviar"]) {
  await waitFor(() => expect(screen.getByRole("button", { name })).toHaveAccessibleDescription(wait));
  expect(screen.getByRole("button", { name })).toBeDisabled();
 }
 for (const text of screen.getAllByText(wait)) expect(text).not.toBeVisible();
 await userEvent.hover(screen.getByRole("button", { name: "Revisar y enviar" }));
 expect(await screen.findByRole("tooltip")).toHaveTextContent(wait);
 expect(discarded).toBe(1);
});
it("cancels without sending or discarding and returns focus to the exact suggestion trigger", async () => {
 const { dialog, action } = await openSuggestion();
 await userEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
 expect(action).toHaveFocus(); expect(sends).toEqual([]); expect(discarded).toBe(0);
 await userEvent.click(screen.getByRole("button", { name: "No, gracias" }));
 await waitFor(() => expect(discarded).toBe(1));
 expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
});
it("consults a lost send response and consumes a shared accepted receipt without reposting", async () => {
 let gets = 0;
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { const send = await request.json() as typeof sends[number]; sends.push(send); return HttpResponse.error(); }), http.get("/api/whatsapp/chats/:id/assistant-suggestions/:requestId", () => { gets++; return HttpResponse.json({ ...ready, state: "Sent", proposal: null, outgoing: receipt("019abcde-1000-7000-8000-000000000011") }); }));
 const { dialog } = await openSuggestion(); await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await userEvent.click(await within(dialog).findByRole("button", { name: "Consultar envío" }));
 await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
 expect(gets).toBe(1); expect(sends).toHaveLength(1);
});
it("preserves the frozen send selection after a lost response and repeats only explicitly after consultation", async () => {
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", async ({ request }) => { sends.push(await request.json() as typeof sends[number]); return sends.length === 1 ? HttpResponse.error() : HttpResponse.json(receipt(sends[0].requestId), { status: 202 }); }));
 const { dialog } = await openSuggestion(); await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fecha" }));
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await userEvent.click(await within(dialog).findByRole("button", { name: "Consultar envío" }));
 expect(sends).toHaveLength(1); expect(within(dialog).getByRole("checkbox", { name: "Fecha" })).toBeDisabled();
 await userEvent.click(await within(dialog).findByRole("button", { name: "Repetir el mismo pedido" }));
 await waitFor(() => expect(sends).toHaveLength(2)); expect(sends[1]).toEqual(sends[0]);
});
it("withdraws a forbidden proposal without removing the authorized chat or its ordinary draft", async () => {
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/send", () => HttpResponse.json({ code: "General.Forbidden" }, { status: 403 })));
 const { dialog } = await openSuggestion(); await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await waitFor(() => expect(screen.queryByText("Ana")).not.toBeInTheDocument());
 expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
 expect(screen.getByText("Quiero registrar una visita")).toBeInTheDocument();
 expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Borrador que se conserva");
});
it("does not generate suggestions for a read-only operator", async () => {
 renderWithProviders(<Harness permissions={["whatsapp.read"]} />);
 await screen.findByText("Quiero registrar una visita");
 expect(requests).toEqual([]); expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
});
it("drops a late private proposal after the operator context changes", async () => {
 let resolve!: (response: Response) => void;
 server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions", () => new Promise<Response>(done => { resolve = done; })));
 const page = renderWithProviders(<Harness />); await waitFor(() => expect(resolve).toBeDefined());
 page.rerender(<Harness actor="other" permissions={["whatsapp.read"]} />);
 await act(async () => { resolve(HttpResponse.json(ready, { status: 202 })); });
 expect(screen.queryByText("Ana")).not.toBeInTheDocument(); expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
 expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Borrador que se conserva");
});

it("analyzes a linked active conversation without eligible forms while keeping form sending blocked", async () => {
 eligibilityStatus = "NoEligibleForms";
 renderWithProviders(<Harness />);
 await waitFor(() => expect(requests).toHaveLength(1));
 await userEvent.click(await screen.findByRole("button", { name: "Revisar y enviar" }));
 const dialog = await screen.findByRole("dialog");
 expect(within(dialog).getByRole("button", { name: "Enviar formulario" })).toBeDisabled();
 expect(sends).toEqual([]);
});

it("keeps the ordinary editor node, caret and draft when a newer inbound source replaces the private suggestion", async () => {
 renderWithProviders(<Harness />);
 await screen.findByRole("button", { name: "Revisar y enviar" });
 const input = screen.getByLabelText("Respuesta al cliente") as HTMLTextAreaElement;
 fireEvent.change(input, { target: { value: "Respuesta en edición" } });
 act(() => { input.focus(); input.setSelectionRange(5, 5); });
 incomingSourceMessageId = "019abcde-1000-7000-8000-000000000012";
 body = { ...ready, requestId: "019abcde-1000-7000-8000-000000000013", sourceMessageId: incomingSourceMessageId };
 await act(async () => { await testClient.invalidateQueries({ queryKey: chatKey }); });
 await waitFor(() => expect(requests).toHaveLength(2));
 await screen.findByRole("button", { name: "Revisar y enviar" });
 expect(screen.getByLabelText("Respuesta al cliente")).toBe(input);
 expect(input).toHaveFocus(); expect(input).toHaveValue("Respuesta en edición");
 expect(input.selectionStart).toBe(5);
});

it.each(["notInstalled", "paused"] as const)("consults an authoritative configured pointer with %s AI without attributing its source to the assistant", async state => {
 availability = state; sourceReply = capturedReply();
 currentPointer = { requestId: suggestionId, sourceMessageId: capturedSourceId, state: "Ready" };
 let consulted = 0;
 server.use(http.get("/api/whatsapp/chats/:id/assistant-suggestions/:requestId", () => {
  consulted++; return HttpResponse.json({ ...ready, sourceMessageId: capturedSourceId, proposal: { ...proposal, proposalId: null } });
 }));
 renderWithProviders(<Harness />);
 const card = await screen.findByRole("region", { name: "Sugerencia de formulario" });
 expect(consulted).toBe(1); expect(requests).toEqual([]);
 expect(within(card).getByText("Podés mandarle Registrar visita")).toBeInTheDocument();
 expect(screen.queryByText(/El asistente sugiere/)).not.toBeInTheDocument();
 await userEvent.click(within(card).getByRole("button", { name: "Revisar y enviar" }));
 const dialog = await screen.findByRole("dialog");
 await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fecha" }));
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await waitFor(() => expect(sends).toHaveLength(1));
 expect(sends[0].includedFieldIds).toEqual([fields[0].fieldId]);
 expect(requests).toEqual([]);
 expect(await screen.findByLabelText("Respuesta al cliente")).toHaveValue("Borrador que se conserva");
});
it("requests interpretation from the latest captured FlowReply without reading its body or reusing earlier text", async () => {
 sourceReply = capturedReply(); body = { ...ready, sourceMessageId: capturedSourceId };
 renderWithProviders(<Harness />);
 await waitFor(() => expect(requests).toHaveLength(1));
 expect(requests[0]).toMatchObject({ sourceMessageId: capturedSourceId, expectedModeRevision: 7 });
 expect(await screen.findByRole("button", { name: "Revisar y enviar" })).toBeInTheDocument();
});
it.each(["Pending", "Rejected"] as const)("does not reuse earlier text behind a latest captured %s reply", async state => {
 sourceReply = capturedReply(state);
 renderWithProviders(<Harness />);
 await screen.findByText("Quiero registrar una visita");
 await userEvent.click(screen.getByLabelText("Respuesta al cliente"));
 expect(requests).toEqual([]);
});
it("does not start a new captured interpretation when AI is unavailable and no pointer exists", async () => {
 availability = "notInstalled"; sourceReply = capturedReply();
 renderWithProviders(<Harness />);
 await screen.findByText("Quiero registrar una visita");
 await userEvent.click(screen.getByLabelText("Respuesta al cliente"));
 expect(requests).toEqual([]);
 expect(screen.queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
});

it("preserves the active pointer selection and dialog when AI becomes unavailable", async () => {
 currentPointer = { requestId: suggestionId, sourceMessageId, state: "Ready" };
 const { dialog } = await openSuggestion();
 await userEvent.click(within(dialog).getByRole("checkbox", { name: "Fecha" }));
 availability = "paused";
 await act(async () => { await testClient.invalidateQueries({ queryKey: chatKey }); });
 expect(screen.getByRole("dialog")).toBe(dialog);
 expect(within(dialog).getByRole("checkbox", { name: "Fecha" })).not.toBeChecked();
 expect(requests).toEqual([]);
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" }));
 await waitFor(() => expect(sends).toHaveLength(1));
 expect(sends[0].includedFieldIds).toEqual([fields[0].fieldId]);
});

it("shows the proposal presentation culture when an English account receives the complete original form", async () => {
 recipientCulture = "en"; const { dialog } = await openSuggestion();
 expect(within(dialog).getByText("Le llega en español.", { exact: true })).toBeInTheDocument();
 expect(within(dialog).getByText(/Registrar visita/)).toBeInTheDocument();
 await userEvent.click(within(dialog).getByRole("button", { name: "Enviar formulario" })); await waitFor(() => expect(sends).toHaveLength(1));
 expect(Object.keys(sends[0]).sort()).toEqual(["includedFieldIds", "requestId"]);
});
