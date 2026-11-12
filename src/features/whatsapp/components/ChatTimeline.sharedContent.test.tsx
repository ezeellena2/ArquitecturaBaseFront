import { act, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import i18n from "@/shared/i18n";
import { renderWithProviders } from "@/test/utils/renderWithProviders";
import type { ChatMessage, Outgoing } from "../api/chat";
import type { ChatFormMetadata } from "../api/formMetadata";
import type { FormReply } from "../api/formReplies";
import { buildTimeline } from "../lib/timeline";
import { ChatTimeline } from "./ChatTimeline";

const form: ChatFormMetadata = { definitionId: "0199b0c0-0000-7000-8000-000000000001", versionId: "0199b0c0-0000-7000-8000-000000000002", versionNumber: 1,
  name: { es: "Registrar entrega", en: "Record delivery" }, culture: "es" };
const at = (minute: number) => "2026-11-12T13:0" + minute + ":00Z";
const message = (overrides: Partial<ChatMessage>): ChatMessage => ({ audio: null, quickReplies: null, assistant: null, origin: "Conversation",
  id: "contact", status: null, body: null, direction: "Inbound", kind: "Contact", occurredAtUtc: at(0), inboundSequence: 1,
  operatorUserId: null, errorCode: null, ...overrides });
const card = { name: "Raúl Medina", phones: ["+54 9 341 555-0199", "+54 9 341 555-0142"] };
const sent = message({ id: "sent", direction: "Outbound", kind: "Flow", form, operatorUserId: "me", status: "Read", occurredAtUtc: at(0),
  body: "Completá el formulario «Registrar entrega»." });
const resent = message({ id: "resent", direction: "Outbound", kind: "Flow", form, operatorUserId: "me", status: "Read", occurredAtUtc: at(2),
  body: "Puse el contacto en «Recibió» y «Teléfono de quien recibe». Revisá el formulario «Registrar entrega» y confirmalo.",
  prefill: [{ label: "Dirección de entrega", value: "Av. San Martín 1450, Rosario" }, { label: "Recibió", value: "Raúl Medina" },
    { label: "Teléfono de quien recibe", value: "+54 9 341 555-0199" }] });
const second: FormReply = { state: "Rejected", definitionId: form.definitionId, versionId: form.versionId, versionNumber: 1, name: "Registrar entrega",
  recordId: null, number: null, values: null, rejectionCode: "Forms.Record.ReplayConflict", savedNumber: "ENT-000031" };

async function timeline(messages: ChatMessage[], outgoing: Outgoing[] = [], formValuesRevoked = false) {
  await act(async () => { renderWithProviders(<ChatTimeline contactId="chat-1" readOwner="test" onAudioForbidden={vi.fn()} items={buildTimeline(messages, outgoing)} actor="me"
    timeZone="America/Argentina/Buenos_Aires" canSend canReuse onReview={vi.fn()} onReuse={vi.fn()} atBottom onAtBottomChange={vi.fn()} hasOlder={false}
    loadingOlder={false} historyError={false} loadOlder={vi.fn()} formValuesRevoked={formValuesRevoked} />); });
}
// The bubble's own text, apart from what it shows: a contact says everything in its card, never «Mensaje de otro tipo».
const ownText = (bubble: HTMLElement) => bubble.querySelector(".message-bubble > p")?.textContent;
const lines = (element: HTMLElement) => [...element.querySelectorAll("p")].map(line => line.textContent);

beforeAll(async () => { await i18n.loadNamespaces("whatsapp"); await i18n.loadLanguages(["es", "en"]); });
afterEach(async () => { await i18n.changeLanguage("es"); });

// W3 (UC3 and UC4): a contact the person shares is its first card, like a location of W1-A: the person icon, the name in bold and the
// phones below, one per line, each group whole: one that does not fit breaks only at its spaces. It is a message of the chat whether
// or not it completed a form.
describe("a contact shared by WhatsApp in the chat", () => {
  it("shows its name and its phones below, one per line, named «Contacto: {nombre}»", async () => {
    await timeline([message({ contact: card })]);

    const contact = screen.getByRole("region", { name: "Contacto: Raúl Medina" });
    expect(lines(contact)).toEqual(["Raúl Medina", "+54 9 341 555-0199", "+54 9 341 555-0142"]);
    expect(within(contact).getByText("Raúl Medina")).toHaveClass("font-semibold");
    for (const [phone, group] of [[card.phones[0], "555-0199"], [card.phones[1], "555-0142"]]) {
      const line = within(contact).getByText(group).closest("p");
      expect(within(contact).getByText(group)).toHaveClass("whitespace-nowrap");
      expect(line).toHaveTextContent(phone);
      expect(line).not.toHaveClass("whitespace-nowrap");
    }
    expect(ownText(screen.getByRole("article"))).toBe("");
    expect(screen.queryByText(/^Mensaje /)).not.toBeInTheDocument();
  });

  it("keeps each group of a long phone whole, so it can only break at its spaces", async () => {
    await timeline([message({ contact: { name: "Depósito Norte", phones: ["+54 9 (0341) 15-555-0177"] } })]);

    const contact = screen.getByRole("region", { name: "Contacto: Depósito Norte" });
    expect(lines(contact)).toEqual(["Depósito Norte", "+54 9 (0341) 15-555-0177"]);
    expect(within(contact).getByText("15-555-0177")).toHaveClass("whitespace-nowrap");
  });

  it("shows a contact without a name and without a phone as «Contacto» alone", async () => {
    await timeline([message({ contact: { name: null, phones: [] } })]);

    expect(lines(screen.getByRole("region", { name: "Contacto" }))).toEqual(["Contacto"]);
    expect(ownText(screen.getByRole("article"))).toBe("");
  });

  // A card without a name is titled «Contacto», as a photo without a file name is «Foto»; one without a phone shows its name alone.
  it("titles a contact without a name «Contacto» and shows a contact without a phone with its name alone", async () => {
    await timeline([message({ id: "unnamed", occurredAtUtc: at(0), contact: { name: null, phones: ["+54 9 341 555-0303"] } }),
      message({ id: "no-phone", occurredAtUtc: at(1), contact: { name: "Recepción", phones: [] } })]);

    expect(lines(screen.getByRole("region", { name: "Contacto" }))).toEqual(["Contacto", "+54 9 341 555-0303"]);
    expect(lines(screen.getByRole("region", { name: "Contacto: Recepción" }))).toEqual(["Recepción"]);
    expect(screen.getAllByRole("article").map(ownText)).toEqual(["", ""]);
  });

  it("says a contact whose content expired is a contact message", async () => {
    await timeline([message({})]);

    expect(ownText(screen.getByRole("article"))).toBe("Mensaje de contacto");
    expect(screen.queryByRole("region", { name: /^Contacto/ })).not.toBeInTheDocument();
  });
});

// W3 (UC2 and UC3): the form that comes back is the same send, a card like the first one, with «Prellenado con» in it: each question
// with what went into it, read like the values of a response (two columns from 640 px and, in the celular, each value under its
// question). Only while the values of the responses can be read.
describe("the resend of a form", () => {
  it("shows «Prellenado con» in its card, with each question and its value, and nothing in the first send", async () => {
    await timeline([sent, message({ contact: card, occurredAtUtc: at(1) }), resent],
      [{ quickReplies: null, assistant: null, origin: "Conversation", id: "again", requestId: "again", kind: "Flow", form, operatorUserId: "me", waMessageId: null,
        state: "Pending", requestedAtUtc: at(3), body: "Puse tu ubicación en «Dirección de entrega». Revisá el formulario «Registrar entrega» y confirmalo.",
        prefill: [{ label: "Dirección de entrega", value: "-32.947102, -60.638955" }] }]);

    const [first, , resend, pending] = screen.getAllByRole("article");
    expect(within(first).queryByText("Prellenado con")).not.toBeInTheDocument();
    const prefilled = within(resend).getByRole("group", { name: "Prellenado con" });
    expect([...prefilled.querySelectorAll("dt")].map(term => term.textContent)).toEqual(["Dirección de entrega", "Recibió", "Teléfono de quien recibe"]);
    expect([...prefilled.querySelectorAll("dd")].map(value => value.textContent)).toEqual(["Av. San Martín 1450, Rosario", "Raúl Medina", "+54 9 341 555-0199"]);
    for (const row of prefilled.querySelectorAll("dl > div")) expect(row).toHaveClass("grid-cols-1", "sm:grid-cols-2");
    expect(within(prefilled).getByText("555-0199")).toHaveClass("whitespace-nowrap");
    expect(within(resend).getByText("Registrar entrega").compareDocumentPosition(prefilled)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(within(resend).getByText("Vos ·")).toBeInTheDocument();
    expect(within(pending).getByRole("group", { name: "Prellenado con" })).toHaveTextContent("Dirección de entrega-32.947102, -60.638955");
    expect(screen.queryByText("Por qué lo mandó")).not.toBeInTheDocument();
  });

  it("drops «Prellenado con» when the values of the responses can no longer be read", async () => {
    await timeline([resent], [], true);

    expect(screen.getByText("Registrar entrega")).toBeInTheDocument();
    expect(screen.queryByText("Prellenado con")).not.toBeInTheDocument();
    expect(screen.queryByText("Raúl Medina")).not.toBeInTheDocument();
  });

  // The card exists only with valid sealed metadata (`readFormMetadata`): without it there is no card to put «Prellenado con» in.
  it("draws no «Prellenado con» on a form whose sealed metadata is not valid", async () => {
    await timeline([{ ...resent, form: { ...form, culture: "fr" } as unknown as ChatFormMetadata }]);

    expect(ownText(screen.getByRole("article"))).toBe(resent.body);
    expect(screen.queryByText("Prellenado con")).not.toBeInTheDocument();
    expect(screen.queryByText("Raúl Medina")).not.toBeInTheDocument();
  });

  // The resend goes with the sender of the send: the assistant's says «Asistente», and «Por qué lo mandó» stays in the first one.
  it("shows the assistant's resend by «Asistente», with «Prellenado con» and without «Por qué lo mandó»", async () => {
    await timeline([{ ...resent, origin: "Assistant", operatorUserId: null }]);

    const resend = screen.getByRole("article");
    expect(within(resend).getByText("Asistente ·")).toBeInTheDocument();
    expect(within(resend).getByRole("group", { name: "Prellenado con" })).toHaveTextContent("Raúl Medina");
    expect(within(resend).queryByText("Por qué lo mandó")).not.toBeInTheDocument();
  });
});

// W3 (UC5): a send keeps one response; the second one is not saved and the chat says which one was kept.
it("says the second response of a send was not saved, with the number of the one that was kept", async () => {
  await timeline([message({ id: "second", kind: "FlowReply", purpose: "Business", formReply: second })]);

  const reply = screen.getByRole("group", { name: "Respuesta del formulario Registrar entrega" });
  expect(reply).toHaveTextContent("No se guardó: el envío ya tiene su respuesta, ENT-000031.");
  // The number moves whole to the next line: it never breaks at its hyphen («ENT-» / «000031»).
  expect(within(reply).getByText("ENT-000031.")).toHaveClass("inline-block");
});

it("says it in English", async () => {
  await act(async () => { await i18n.changeLanguage("en"); });
  await timeline([message({ id: "contact", occurredAtUtc: at(0), contact: card }), message({ id: "unnamed", occurredAtUtc: at(1), contact: { name: null, phones: ["+54 9 341 555-0303"] } }),
    message({ id: "expired", occurredAtUtc: at(2) }), { ...resent, occurredAtUtc: at(3) },
    message({ id: "second", kind: "FlowReply", purpose: "Business", occurredAtUtc: at(4), formReply: { ...second, name: "Record delivery" } })]);

  expect(screen.getByRole("region", { name: "Contact: Raúl Medina" })).toBeInTheDocument();
  expect(lines(screen.getByRole("region", { name: "Contact" }))).toEqual(["Contact", "+54 9 341 555-0303"]);
  expect(screen.getAllByRole("article").map(ownText)[2]).toBe("contact message");
  expect(screen.getByRole("group", { name: "Prefilled with" })).toBeInTheDocument();
  expect(screen.getByRole("group", { name: "Form reply Record delivery" })).toHaveTextContent("Not saved: the send already has its response, ENT-000031.");
});
