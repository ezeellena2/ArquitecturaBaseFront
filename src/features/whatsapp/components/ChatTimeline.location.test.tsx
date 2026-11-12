import { act, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatMessage } from "../api/chat";
import type { ChatFormMetadata } from "../api/formMetadata";
import { buildTimeline } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";
import { LocationRequestCard } from "./LocationRequestCard";

const form = (location?: ChatFormMetadata["location"]): ChatFormMetadata => ({ definitionId: "0199b0c0-0000-7000-8000-000000000001",
  versionId: "0199b0c0-0000-7000-8000-000000000002", versionNumber: 1, name: { es: "Registro de visita" }, culture: "es", location });
const message = (overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation",
  id: "message", status: "Delivered", body: null, direction: "Inbound", kind: "Text", occurredAtUtc: "2026-11-11T15:00:00Z", inboundSequence: 0,
  operatorUserId: null, errorCode: null, ...overrides });

async function timeline(messages: ChatMessage[]) {
  await act(async () => { renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline(messages, [])} actor="me"
    timeZone="America/Argentina/Buenos_Aires" canSend canReuse onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false}
    loadingOlder={false} historyError={false} loadOlder={vi.fn()} />); });
}

// W1-A: the location request is a card with the pin and its state, and the location that arrives is its point with the map link.
describe("a location by WhatsApp in the chat", () => {
  it("shows the request with its text and the card of its state, and the location that arrives with its point and its map link", async () => {
    await timeline([
      message({ id: "request", direction: "Outbound", kind: "LocationRequest", operatorUserId: "me", occurredAtUtc: "2026-11-11T15:00:00Z",
        body: "Para completar «Registro de visita», mandanos tu ubicación.", form: form({ state: "Received", expiresAtUtc: "2026-11-12T15:00:00Z" }) }),
      message({ id: "point", kind: "Location", occurredAtUtc: "2026-11-11T15:02:00Z", location: { latitude: -34.603722, longitude: -58.381592 } }),
    ]);

    expect(screen.getByText("Para completar «Registro de visita», mandanos tu ubicación.")).toBeInTheDocument();
    const card = screen.getByRole("group", { name: "Pedido de ubicación" });
    expect(within(card).getByText("Registro de visita")).toBeInTheDocument();
    expect(within(card).getByText("Ubicación recibida")).toBeInTheDocument();
    expect(screen.getByText("-34.603722, -58.381592")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver en el mapa" })).toHaveAttribute("href", "https://www.google.com/maps?q=-34.603722,-58.381592");
    expect(screen.queryByText(/^Mensaje /)).not.toBeInTheDocument();
  });

  // The assistant also sends forms with a location (2026-11-11): its request is the same card, by «Asistente», with «Por qué lo
  // mandó» once; the Flow that follows the location comes without it.
  it("shows the assistant's request with its author and why it sent it, and the Flow that follows without repeating it", async () => {
    const assistant = { reason: "Pidió registrar la visita a Ferretería Sur.", proposedFields: [{ fieldId: "0199b0c0-0000-7000-8000-000000000003",
      label: "Cliente visitado", displayValue: "Ferretería Sur" }] };
    await timeline([
      message({ id: "request", direction: "Outbound", kind: "LocationRequest", origin: "Assistant", occurredAtUtc: "2026-11-11T15:00:00Z", assistant,
        body: "Para completar «Registro de visita», mandanos tu ubicación.", form: form({ state: "Received", expiresAtUtc: "2026-11-12T15:00:00Z" }) }),
      message({ id: "point", kind: "Location", occurredAtUtc: "2026-11-11T15:02:00Z", location: { latitude: -34.603722, longitude: -58.381592 } }),
      message({ id: "flow", direction: "Outbound", kind: "Flow", origin: "Assistant", occurredAtUtc: "2026-11-11T15:02:01Z",
        body: "Completá el formulario «Registro de visita».", form: form() }),
    ]);

    expect(within(screen.getByRole("group", { name: "Pedido de ubicación" })).getByText("Ubicación recibida")).toBeInTheDocument();
    expect(screen.getAllByText("Asistente ·")).toHaveLength(2);
    expect(screen.getAllByText("Por qué lo mandó")).toHaveLength(1);
    expect(screen.getByText("Pidió registrar la visita a Ferretería Sur.")).toBeInTheDocument();
  });

  it("says a location whose point was cleared is a location message", async () => {
    await timeline([message({ kind: "Location" })]);

    expect(screen.getByText("Mensaje de ubicación")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver en el mapa" })).not.toBeInTheDocument();
  });

  it.each([
    [{ state: "Requested" as const, expiresAtUtc: "2026-11-12T15:00:00Z" }, "Esperando la ubicación"],
    [{ state: "Requested" as const, expiresAtUtc: "2026-11-11T14:00:00Z" }, "Venció sin la ubicación"],
    [{ state: "Skipped" as const, expiresAtUtc: "2026-11-12T15:00:00Z" }, "Siguió sin la ubicación"],
  ])("says how the send of the request stands: %o", async (location, text) => {
    await act(async () => { renderWithProviders(<LocationRequestCard form={form(location)} nowUtc={Date.parse("2026-11-11T15:00:00Z")} />); });

    expect(within(screen.getByRole("group", { name: "Pedido de ubicación" })).getByText(text)).toBeInTheDocument();
  });
});
