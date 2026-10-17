import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatMessage, Outgoing } from "../api/chat";
import { buildTimeline } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";

const operation = (state: Outgoing["state"], operatorUserId = "me"): Outgoing => ({ quickReplies: null, assistant: null, origin: "Conversation" as const,
  id: "operation", requestId: "request", state, operatorUserId, body: "Texto para recuperar",
  requestedAtUtc: "2026-10-02T12:00:00Z", waMessageId: null,
});
const message = (status: string | null): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation" as const,
  id: "message", status, body: "Mensaje del historial", direction: "Outbound", kind: "Text",
  occurredAtUtc: "2026-10-02T02:00:00Z", inboundSequence: 0, operatorUserId: null, errorCode: null,
});
async function setup(messages: ChatMessage[], outgoing: Outgoing[], canSend = true, canReuse = true) {
  const onReview = vi.fn();
  const onReuse = vi.fn();
  await act(async () => { renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline(messages, outgoing)} actor="me" timeZone="America/Argentina/Buenos_Aires"
    canSend={canSend} canReuse={canReuse} reviewing={false} onReview={onReview} onReuse={onReuse}
    atBottom onAtBottomChange={vi.fn()} hasOlder={false} loadingOlder={false} historyError={false} loadOlder={vi.fn()} />); });
  return { onReview, onReuse };
}

describe("ChatTimeline", () => {
  it("uses access metadata without showing or recovering the retained secret", async () => {
    const access = Object.assign(message("Failed"), { purpose: "Access", accessEventKind: "SignInCode", body: "123456 https://example.test/#t=secret" });
    await setup([access], []);
    expect(screen.getByText("Código de ingreso enviado")).toBeInTheDocument();
    expect(screen.getByText("Acceso al sistema ·")).toBeInTheDocument();
    expect(screen.queryByText(/123456|#t=secret/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar este texto en el borrador" })).not.toBeInTheDocument();
    expect(screen.getByText("No se pudo enviar")).toBeInTheDocument();
  });
  it("keeps ordinary words in the business history without inferring access", async () => {
    await setup([Object.assign(message(null), { purpose: "Business", body: "Quiero entrar, mi código es un producto" })], []);
    expect(screen.getByText("Quiero entrar, mi código es un producto")).toBeInTheDocument();
  });
  it("shows localized dates and times with honest delivery and automatic authorship", async () => {
    await setup([message(null)], [operation("Reviewed")]);
    const items = screen.getAllByRole("article", { name: "Mensaje saliente" });
    expect(within(items[0]).getByText("Estado no informado")).toBeInTheDocument();
    expect(within(items[0]).getByText("Automático ·")).toBeInTheDocument();
    expect(within(items[0]).getByLabelText("1 oct 2026, 23:00")).toHaveTextContent("23:00");
    expect(screen.getByText("1 oct 2026")).toBeInTheDocument();
    expect(screen.getByText("2 oct 2026")).toBeInTheDocument();
    expect(within(items[1]).getByText("Revisado por el operador")).toBeInTheDocument();
    expect(screen.queryByText("Entregado")).not.toBeInTheDocument();
    expect(screen.queryByText("Leído")).not.toBeInTheDocument();
  });
  it("recovers a confirmed delivery failure into the draft without sending it", async () => {
    const { onReuse, onReview } = await setup([message("Failed")], []);
    await userEvent.click(screen.getByRole("button", { name: "Usar este texto en el borrador" }));
    expect(onReuse).toHaveBeenCalledExactlyOnceWith("Mensaje del historial");
    expect(onReview).not.toHaveBeenCalled();
  });
  it("preserves an existing draft by disabling recovery", async () => {
    const { onReuse } = await setup([], [operation("Failed")], true, false);
    expect(screen.getByRole("button", { name: "Usar este texto en el borrador" })).toBeDisabled();
    expect(onReuse).not.toHaveBeenCalled();
  });
  it("lets only the sender prepare an uncertain outcome for confirmation", async () => {
    const pending = operation("Uncertain");
    const { onReview } = await setup([], [pending]);
    await userEvent.click(screen.getByRole("button", { name: "Ya revisé el WhatsApp" }));
    expect(onReview).toHaveBeenCalledExactlyOnceWith(pending);
  });
  it("keeps another operator's uncertainty visible without offering its review", async () => {
    await setup([], [operation("Uncertain", "other")]);
    expect(screen.getByText("Envío sin confirmar")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ya revisé el WhatsApp" })).not.toBeInTheDocument();
  });
  it("keeps recovery and review unavailable in read-only mode", async () => {
    await setup([message("Failed")], [operation("Uncertain")], false);
    expect(screen.queryByRole("button", { name: "Ya revisé el WhatsApp" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar este texto en el borrador" })).not.toBeInTheDocument();
  });
  it("does not offer unavailable retained content as a draft", async () => {
    await setup([{ ...message("Failed"), body: null }], []);
    expect(screen.getByText("Texto no disponible")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Usar este texto en el borrador" })).not.toBeInTheDocument();
  });
});

const receivedReply: NonNullable<ChatMessage['formReply']> = { state: 'Completed', definitionId: 'definition-old', versionId: 'version-old', versionNumber: 1,
  name: 'Historical English form', recordId: 'record-a', number: 'VIS-000001', values: [
    { fieldId: 'bool', key: 'confirmed', type: 'boolean', label: 'Historical question', value: false },
    { fieldId: 'zero', key: 'returned', type: 'decimal', label: 'Historical quantity', value: '0' },
  ] };
it('presents an authorized received form inside the common bubble without exposing or reusing its raw body', async () => {
  await setup([{ ...message(null), direction: 'Inbound', kind: 'FlowReply', body: 'private raw reply', formReply: receivedReply }], []);
  expect(screen.getByText('Guardada como VIS-000001')).toBeInTheDocument();
  expect(screen.getByText('Historical English form')).toBeInTheDocument();
  expect(screen.getByText('No')).toBeInTheDocument();
  expect(screen.getByText('0')).toBeInTheDocument();
  expect(screen.queryByText('private raw reply')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Usar este texto en el borrador' })).not.toBeInTheDocument();
});
it('keeps the received receipt readable without answer permission', async () => {
  await setup([{ ...message(null), direction: 'Inbound', kind: 'FlowReply', formReply: { ...receivedReply, values: null } }], [], false);
  expect(screen.getByText('Guardada como VIS-000001')).toBeInTheDocument();
  expect(screen.getByText('No tenés permiso para ver las respuestas de este formulario.')).toBeInTheDocument();
  expect(screen.queryByText('Historical question')).not.toBeInTheDocument();
});
it('uses a quiet metadata-free fallback for a received invalid projection without claiming saved or rejected', async () => {
  await setup([{ ...message(null), direction: 'Inbound', kind: 'FlowReply', body: 'private raw reply', formReply: null }], []);
  expect(screen.getByText('No se pudieron mostrar las respuestas.')).toBeInTheDocument();
  expect(screen.queryByText('private raw reply')).not.toBeInTheDocument();
  expect(screen.queryByText(/Guardada como|No se guardó/)).not.toBeInTheDocument();
});

it("labels automatic form actions and never reuses or manually reviews them in chat",async ()=>{await setup([{...message("Failed"),origin:"FormAction",kind:"Document",body:"PDF sent after approval"}],[{...operation("Uncertain"),origin:"FormAction",operatorUserId:null}]);expect(screen.getAllByText("Acción del formulario")).toHaveLength(2);expect(screen.getAllByText("Automático ·")).toHaveLength(2);expect(screen.getByText("PDF sent after approval")).toBeInTheDocument();expect(screen.queryByRole("button",{name:"Usar este texto en el borrador"})).not.toBeInTheDocument();expect(screen.queryByRole("button",{name:"Ya revisé el WhatsApp"})).not.toBeInTheDocument();});
it("withdraws automatic captions immediately when form values are revoked",async()=>{await act(async()=>{renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline([{...message("Delivered"),origin:"FormAction",kind:"Document",body:"private receipt caption"}],[])} actor="me" canSend={false} canReuse={false} reviewing={false} onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false} loadingOlder={false} historyError={false} loadOlder={vi.fn()} formValuesRevoked/>);});expect(screen.getByText("Acción del formulario")).toBeInTheDocument();expect(screen.queryByText("private receipt caption")).not.toBeInTheDocument();});

it("shows Assistant author and keeps its automatic uncertainty and failure out of manual controls", async () => {
  const failed = { ...message("Failed"), origin: "Assistant" as const, body: "Pregunta del asistente" };
  const uncertain = { ...operation("Uncertain"), origin: "Assistant" as const, operatorUserId: null };
  const { onReview, onReuse } = await setup([failed], [uncertain]);
  expect(screen.getAllByText("Asistente ·")).toHaveLength(2);
  expect(screen.queryByRole("button", { name: "Usar este texto en el borrador" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Ya revisé el WhatsApp" })).not.toBeInTheDocument();
  expect(onReview).not.toHaveBeenCalled(); expect(onReuse).not.toHaveBeenCalled();
});

it("shows captured reasons and proposed display values without querying current assistant configuration", async () => {
  const captured = Object.assign(message("Sent"), { origin: "Assistant" as const, kind: "Flow", assistant: { reason: "Informó una visita terminada", proposedFields: [{ fieldId: "field", label: "Cliente", displayValue: "Pérez Hnos." }] } });
  await setup([captured], []);
  expect(screen.getByText("Por qué lo mandó")).toBeInTheDocument();
  expect(screen.getByText("Informó una visita terminada")).toBeInTheDocument();
  expect(screen.getByText("Pérez Hnos.")).toBeInTheDocument();
  expect(screen.getByText("Asistente ·")).toBeInTheDocument();
});

it("shows captured quick-reply choices as read-only history rather than operator send controls", async () => {
 const clarification = Object.assign(message("Sent"), { kind: "Interactive", body: "¿Visita o entrega?", origin: "Assistant" as const, quickReplies: ["Visita", "Entrega"] });
 await setup([clarification], []);
 const choices = screen.getByRole("list", { name: "Opciones de respuesta" });
 expect(within(choices).getAllByRole("listitem").map(item => item.textContent)).toEqual(["Visita", "Entrega"]);
 expect(within(choices).queryByRole("button")).not.toBeInTheDocument();
});
