import { useEffect, useState } from "react";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import { server } from "@/test/mocks/server";
import * as notifications from "@/shared/ui/notifications";
import { ChatThread } from "./ChatThread";
import type { ChatDraft } from "./ChatComposer";

// AS4 in Atención manual: the suggestion can be a text. «Usar como borrador» puts it in the composer and discards the suggestion by
// its route; nothing goes out on its own and it never replaces what the operator wrote.
const chatId = "019abcde-1000-7000-8000-000000000010";
const sourceMessageId = "019abcde-1000-7000-8000-000000000004";
const requestId = "019abcde-1000-7000-8000-000000000003";
const text = "Sí: al interior enviamos por transporte, a cargo del cliente.\nEn CABA y GBA entregamos nosotros.";
const ready = { requestId, sourceMessageId, state: "Ready", proposal: null, outgoing: null,
  textProposal: { text, caseSource: "Fallback", caseTitle: null, used: ["La pregunta frecuente «¿Hacen envíos o entregas?»", "La zona de entrega"] } };
let discards: number; let sends: number; let windowOpen: boolean;
let draftState: ChatDraft;
function Harness({ initial = "" }: { initial?: string }) {
  const [draft, setDraft] = useState<ChatDraft>({ body: initial });
  useEffect(() => { draftState = draft; }, [draft]);
  return <ChatThread id={chatId} actor="operator" readPermissions={["whatsapp.read", "whatsapp.send"]} canSend canConfigureAssistant={false} draft={draft} updateDraft={setDraft} onBack={() => {}} />;
}
beforeEach(() => {
  discards = 0; sends = 0; windowOpen = true;
  server.use(http.get("/api/whatsapp/chats/:id/messages", () => HttpResponse.json({ assistantAvailability: { state: "available" }, assistantSuggestion: { requestId, sourceMessageId, state: "Ready" },
      contact: { id: chatId, profileName: "Ana", phoneNumber: "+54 9 351 555-1234", mode: "Manual", modeRevision: 4, lastInboundAtUtc: windowOpen ? new Date().toISOString() : "2026-10-01T12:00:00Z", lastInboundSequence: 1, unreadCount: 0, preview: "¿Hacen envíos a Córdoba?",
        linkedAccount: { userId: "recipient", displayName: "Ana", email: null, isActive: true }, formEligibility: { status: "Eligible", recipientCulture: "es", recipientContextRevision: "context" } },
      messages: [{ audio: null, quickReplies: null, id: sourceMessageId, direction: "Inbound", kind: "Text", body: "¿Hacen envíos a Córdoba?", occurredAtUtc: windowOpen ? new Date().toISOString() : "2026-10-01T12:00:00Z", inboundSequence: 1, operatorUserId: null, status: null, errorCode: null, origin: "Conversation", assistant: null }],
      outgoing: [], beforeAtUtc: null, beforeId: null, canReadFormRecords: true })),
    http.put("/api/whatsapp/chats/:id/read", () => new HttpResponse(null, { status: 204 })),
    http.get("/api/whatsapp/chats/:id/assistant-suggestions/:requestId", () => HttpResponse.json(ready)),
    http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", () => { discards++; return HttpResponse.json({ ...ready, state: "Discarded", textProposal: undefined }); }),
    http.post("/api/whatsapp/chats/:id/messages", () => { sends++; return HttpResponse.json({}, { status: 500 }); }));
});
afterEach(() => vi.restoreAllMocks());
const card = async () => screen.findByRole("region", { name: "Sugerencia de respuesta" });
const valueOf = (scope: HTMLElement, label: string) => within(scope).queryByText(label, { selector: "dt" })?.nextElementSibling ?? null;
function held() { let release!: () => void; const answer = new Promise<void>(resolve => { release = resolve; }); return { answer, release: () => act(async () => release()) }; }

it("shows the suggested text whole, with its case and what it used, and no form to review", async () => {
  renderWithProviders(<Harness />);
  const suggestion = await card();
  expect(within(suggestion).getByText("El asistente sugiere responder")).toBeInTheDocument();
  expect(within(suggestion).getByText((_, node) => node?.tagName === "P" && node.textContent === text)).toBeInTheDocument();
  expect(valueOf(suggestion, "Caso")).toHaveTextContent(/^Cualquier otra cosa$/);
  expect(within(valueOf(suggestion, "Usó") as HTMLElement).getAllByRole("listitem")).toHaveLength(2);
  expect(within(suggestion).queryByRole("button", { name: "Revisar y enviar" })).not.toBeInTheDocument();
  expect(within(suggestion).getByRole("button", { name: "No, gracias" })).toBeEnabled();
});
it("puts the text in the composer, discards the suggestion by its route and sends nothing", async () => {
  renderWithProviders(<Harness />);
  await userEvent.click(within(await card()).getByRole("button", { name: "Usar como borrador" }));
  const reply = screen.getByLabelText("Respuesta al cliente");
  expect(reply).toHaveValue(text);
  expect(reply).toHaveFocus();
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sugerencia de respuesta" })).not.toBeInTheDocument());
  expect(discards).toBe(1);
  expect(sends).toBe(0);
  expect(draftState.attempt).toBeUndefined();
  expect(screen.getByRole("button", { name: "Enviar" })).toBeEnabled();
});
it("shows that it works while the suggestion is discarded, with the text already in the composer", async () => {
  const wait = held();
  server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", async () => { discards++; await wait.answer; return HttpResponse.json({ ...ready, state: "Discarded", textProposal: undefined }); }));
  renderWithProviders(<Harness />);
  await userEvent.click(within(await card()).getByRole("button", { name: "Usar como borrador" }));
  try {
    const working = await screen.findByRole("button", { name: "Pasando al borrador…" });
    expect(working).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "No, gracias" })).toBeDisabled();
    expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue(text);
  } finally { await wait.release(); }
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sugerencia de respuesta" })).not.toBeInTheDocument());
});
it("never replaces what the operator wrote: the button says why it is off and the click does nothing", async () => {
  renderWithProviders(<Harness initial="Hola Ana, ya te digo" />);
  const use = within(await card()).getByRole("button", { name: "Usar como borrador" });
  expect(use).toHaveAttribute("aria-disabled", "true");
  expect(use).toHaveAccessibleDescription("Ya hay una respuesta escrita.");
  fireEvent.click(use);
  expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("Hola Ana, ya te digo");
  expect(discards).toBe(0);
});
it("says why the text cannot go to a composer that cannot be used", async () => {
  windowOpen = false;
  renderWithProviders(<Harness />);
  const use = within(await card()).getByRole("button", { name: "Usar como borrador" });
  expect(use).toHaveAccessibleDescription("Pasaron 24 horas desde el último mensaje del cliente.");
  expect(discards).toBe(0);
});
it("discards with «No, gracias» without touching the composer", async () => {
  renderWithProviders(<Harness initial="Mi borrador" />);
  await userEvent.click(within(await card()).getByRole("button", { name: "No, gracias" }));
  await waitFor(() => expect(screen.queryByRole("region", { name: "Sugerencia de respuesta" })).not.toBeInTheDocument());
  expect(discards).toBe(1);
  expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue("Mi borrador");
});
it("keeps the text in the composer and the suggestion in sight when the discard fails", async () => {
  const notify = vi.spyOn(notifications, "notify");
  server.use(http.post("/api/whatsapp/chats/:id/assistant-suggestions/:requestId/discard", () => { discards++; return HttpResponse.json({ status: 500, traceId: "trace" }, { status: 500 }); }));
  renderWithProviders(<Harness />);
  await userEvent.click(within(await card()).getByRole("button", { name: "Usar como borrador" }));
  await waitFor(() => expect(notify).toHaveBeenCalledWith(expect.objectContaining({ kind: "error" })));
  expect(screen.getByLabelText("Respuesta al cliente")).toHaveValue(text);
  const suggestion = await card();
  expect(within(suggestion).getByRole("button", { name: "Usar como borrador" })).toHaveAccessibleDescription("Ya hay una respuesta escrita.");
  expect(sends).toBe(0);
});
