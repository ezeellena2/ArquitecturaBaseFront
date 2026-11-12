import { expect, it } from "vitest";
import { responseDetailSchema } from "./responses";
import { responseDetailFixture } from "@/test/responseFixtures";

// W3: the activity of a response that went by WhatsApp says which questions the location or the contact the person shared
// completed (the labels of the version) and that the form was sent again. Today's history keeps its shape: the location of W1-A
// comes without questions. Synthetic bodies until the joint export brings the backend's.
const detail = responseDetailFixture();
const at = (minute: number) => "2026-10-16T12:0" + minute + ":00Z";
const sent = { kind: "Sent", atUtc: at(0), actor: detail.actor };
const location = { kind: "LocationReceived", atUtc: at(1), actor: null, questions: ["Dirección de entrega"] };
const contact = { kind: "ContactReceived", atUtc: at(3), actor: null, questions: ["Recibió", "Teléfono de quien recibe"] };
const again = { kind: "SentAgain", atUtc: at(2), actor: null };
const withHistory = (history: unknown[]) => ({ ...detail, history });

it("keeps today's history, also the location of W1-A without questions", () => {
  const history = [{ kind: "LocationRequested", atUtc: at(0), actor: null }, { kind: "LocationReceived", atUtc: at(1), actor: null }, ...detail.history];
  expect(responseDetailSchema.parse(withHistory(history)).history).toEqual(history);
});
it("reads the location and the contact with the questions they completed, and the form sent again", () => {
  const history = [sent, location, again, contact, { ...again, atUtc: at(4), actor: detail.actor }];
  expect(responseDetailSchema.parse(withHistory(history)).history).toEqual(history);
});
it("reads a contact that completed only the question it brought", () => {
  const history = [sent, { ...contact, questions: ["Teléfono de quien recibe"] }];
  expect(responseDetailSchema.parse(withHistory(history)).history).toEqual(history);
});
it.each([
  { ...contact, kind: "ContactShared" },
  { ...contact, questions: undefined },
  { ...contact, questions: null },
  { ...contact, questions: [] },
  { ...contact, questions: ["Recibió", "Teléfono de quien recibe", "Dirección de entrega"] },
  { ...contact, questions: [""] },
  { ...contact, questions: [5] },
  { ...contact, phones: ["PRIVATE"] },
  { ...location, questions: null },
  { ...location, questions: [] },
  { ...location, questions: ["Dirección de entrega", "Referencia"] },
  { ...location, value: "PRIVATE" },
  { ...again, questions: ["Dirección de entrega"] },
  { ...sent, questions: ["Dirección de entrega"] },
  { ...again, actor: undefined },
])("rejects a history event out of its contract %#", event => {
  expect(responseDetailSchema.safeParse(withHistory([sent, event])).success).toBe(false);
});
