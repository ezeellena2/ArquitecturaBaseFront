import { useEffect, useState } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { chatKey } from "../api/chat";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { expect, it } from "vitest";
import { server } from "@/test/mocks/server";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatDraft } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
const id = "019abcde-1000-7000-8000-000000000010";
const messageId = "019abcde-1000-7000-8000-000000000004";
let readClient: QueryClient;
function Harness({ canSend = true }: { canSend?: boolean }) {
 const client = useQueryClient(); useEffect(() => { readClient = client; }, [client]);
 const [draft, updateDraft] = useState<ChatDraft>({ body: "Borrador conservado" });
 return <ChatThread id={id} actor="operator" readPermissions={canSend ? ["whatsapp.read", "whatsapp.send"] : ["whatsapp.read"]} canSend={canSend} canConfigureAssistant={false} draft={draft} updateDraft={updateDraft} onBack={() => {}}/>;
}
function setup(completed = false) {
 let transcriptions = 0; const suggestions: Record<string, unknown>[] = [];
 const read = () => ({ assistantAvailability: { state: "available" }, assistantSuggestion: null, contact: { id, profileName: "Juan", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 7, lastInboundAtUtc: new Date().toISOString(), lastInboundSequence: 1, unreadCount: 0, preview: "Audio", linkedAccount: { userId: "recipient", displayName: "Juan", email: null, isActive: true }, formEligibility: { status: "NoEligibleForms", recipientCulture: "es", recipientContextRevision: "context" } }, messages: [{ id: messageId, direction: "Inbound", kind: "Audio", body: completed ? "Quiero registrar una visita" : null, audio: { state: completed ? "Completed" : "Pending", canPlay: true }, occurredAtUtc: new Date().toISOString(), inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin: "Conversation", assistant: null, quickReplies: null }], outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: false });
 server.use(http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json(read())), http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })),
 http.post("/api/whatsapp/chats/:id/messages/:messageId/audio-transcription", () => { transcriptions++; completed = true; return HttpResponse.json({ state: "Transcribing", canPlay: true }, { status: 202 }); }),
 http.post("/api/whatsapp/chats/:id/assistant-suggestions", async ({ request }) => { const body = await request.json() as Record<string, unknown>; suggestions.push(body); return HttpResponse.json({ requestId: body.requestId, sourceMessageId: messageId, state: "NoReply", proposal: null, outgoing: null }, { status: 202 }); }));
 return { suggestions, transcriptions: () => transcriptions };
}
it("uses a newly completed audio as the real manual suggestion source and preserves the ordinary draft", async () => {
 const api = setup(); renderWithProviders(<Harness/>);
 await waitFor(() => expect(api.suggestions).toHaveLength(1));
 expect(api.transcriptions()).toBe(1); expect(api.suggestions[0]).toMatchObject({ sourceMessageId: messageId, expectedModeRevision: 7 });
 expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("Borrador conservado");
});
it("transcribes in a read-only Manual chat without requesting or sending a suggestion", async () => {
 const api = setup(); renderWithProviders(<Harness canSend={false}/>);
 await screen.findByText("Transcripción"); expect(api.transcriptions()).toBe(1); expect(api.suggestions).toEqual([]);
});
it("withdraws the entire read scope when the playback endpoint returns forbidden", async () => {
 setup(true); server.use(http.get("/api/whatsapp/chats/:id/messages/:messageId/audio", () => HttpResponse.json({ code: "Authorization.Forbidden" }, { status: 403 })));
 renderWithProviders(<Harness canSend={false}/>); await userEvent.click(await screen.findByRole("button", { name: "Escuchar audio" }));
 await waitFor(() => expect(screen.queryByText("Quiero registrar una visita")).not.toBeInTheDocument());
 expect(screen.queryByRole("heading", { name: "Juan" })).not.toBeInTheDocument();
 await waitFor(() => expect(readClient.getQueryCache().findAll({ queryKey: chatKey }).every(query => query.state.data === undefined)).toBe(true));
});
