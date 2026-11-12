import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { getThread } from "./chat";

// VC1-A (task 26): several loads from a spreadsheet. The notice of the loads brings «Por qué lo propuso» in `spreadsheetRows`: the rows it
// recognized of each form, the ones it sent, the ones it passed to the team and the repeated ones, with the response they are already in
// or the row of the same spreadsheet they repeat. It names forms, rows and response numbers, never a value of a response: like the reasons
// of AS4, everyone with whatsapp.read sees it, and the assistant's explanation keeps its shape. A load is the form card of its `form`, as
// today. Every new field is absent when it does not apply: today's answers keep their shape. Synthetic bodies until the joint export.
afterEach(resetHttpClient);
const id = (n: number) => "019abcde-1000-7000-8000-" + String(n).padStart(12, "0");
const form = { definitionId: id(10), versionId: id(11), versionNumber: 2, name: { es: "Cobranzas" }, culture: "es" };
const contact = { id: "chat-1", profileName: "Marta Ruiz", phoneNumber: null, mode: "Assistant", modeRevision: 3, lastInboundAtUtc: "2026-11-11T20:30:00Z", lastInboundSequence: 7, unreadCount: 0, preview: "Planilla" };
const spreadsheet = { audio: null, quickReplies: null, assistant: null, origin: "Conversation", id: id(1), direction: "Inbound", kind: "Spreadsheet", body: "Las cobranzas de esta semana",
  spreadsheetName: "cobranzas-semana.xlsx", occurredAtUtc: "2026-11-11T20:30:00Z", inboundSequence: 7, operatorUserId: null, status: null, errorCode: null };
const notice = { audio: null, quickReplies: null, assistant: null, origin: "Assistant", id: id(2), direction: "Outbound", kind: "Text", occurredAtUtc: "2026-11-11T20:30:05Z", inboundSequence: 0,
  operatorUserId: null, status: "Read", errorCode: null,
  body: "Recibí una planilla con 7 filas de «Cobranzas». Te preparé un formulario para cada una de las 3 primeras: revisalos y confirmalos. Las otras 4 se las pasé a una persona del equipo." };
const load = { audio: null, quickReplies: null, assistant: null, origin: "Assistant", id: id(3), direction: "Outbound", kind: "Flow", form, occurredAtUtc: "2026-11-11T20:30:06Z", inboundSequence: 0,
  operatorUserId: null, status: "Delivered", errorCode: null, body: "1 de 3 · $95.000 · Ferretería Norte" };
const queued = { quickReplies: null, assistant: null, origin: "Assistant", id: id(4), requestId: id(5), kind: "Flow", form, requestedAtUtc: "2026-11-11T20:30:07Z", operatorUserId: null, waMessageId: null,
  state: "Pending", body: "3 de 3 · $132.400 · Distribuidora Sur" };
// The notice while it waits to go out.
const queuedNotice = { quickReplies: null, assistant: null, origin: "Assistant", id: id(6), requestId: id(7), kind: "Text", requestedAtUtc: "2026-11-11T20:30:05Z", operatorUserId: null, waMessageId: null,
  state: "Pending", body: notice.body };
const thread = { assistantAvailability: { state: "available" }, assistantSuggestion: null, contact, messages: [spreadsheet, notice, load], outgoing: [queued], beforeAtUtc: null, beforeId: null, canReadFormRecords: true };
const row = (number: number, sheet: string | null = null) => ({ sheet, number });
const rows = { recognized: [{ form: "Cobranzas", count: 7 }], sent: [row(2), row(3), row(4)], forTeam: [row(5), row(6), row(7), row(8)], repeated: [] };
const readThread = async (body: Record<string, unknown>) => { server.use(http.get("/api/whatsapp/chats/chat-1/messages", () => HttpResponse.json(body))); return getThread("chat-1"); };

it("reads today's thread without the new fields and invents none", async () => {
  const read = await readThread(thread);
  expect(read.messages[1]).not.toHaveProperty("spreadsheetRows");
  expect(read.outgoing[0]).not.toHaveProperty("spreadsheetRows");
  expect(read.messages[1].assistant).toBeNull();
});
it("reads «Por qué lo propuso» of a spreadsheet in the notice, as a message and as an outgoing, apart from the assistant's explanation", async () => {
  const read = await readThread({ ...thread, messages: [spreadsheet, { ...notice, spreadsheetRows: rows }, load], outgoing: [{ ...queuedNotice, spreadsheetRows: rows }, queued] });
  expect(read.messages[1].spreadsheetRows).toEqual(rows);
  expect(read.messages[1].assistant).toBeNull();
  expect(read.outgoing[0].spreadsheetRows).toEqual(rows);
  expect(read.outgoing[1]).not.toHaveProperty("spreadsheetRows");
});
it("reads rows of two forms and of several sheets, the repeated ones with their response or the row they repeat, and none sent", async () => {
  const several = { recognized: [{ form: "Cobranzas", count: 4 }, { form: "Pagos a proveedores", count: 2 }], sent: [row(2, "Ventas"), row(3, "Ventas"), row(2, "Compras")],
    forTeam: [row(4, "Ventas")], repeated: [{ row: row(5, "Ventas"), recordNumber: "COB-000120", sameAs: null }, { row: row(3, "Compras"), recordNumber: null, sameAs: row(2, "Compras") }] };
  const allRepeated = { recognized: [{ form: "Cobranzas", count: 2 }], sent: [], forTeam: [], repeated: [{ row: row(2), recordNumber: "COB-000120", sameAs: null }, { row: row(3), recordNumber: "COB-000121", sameAs: null }] };
  // The row a repeated one repeats is listed: sent, for the team, or repeated itself.
  const repeatsListed = { recognized: [{ form: "Cobranzas", count: 4 }], sent: [], forTeam: [row(5)],
    repeated: [{ row: row(6), recordNumber: null, sameAs: row(5) }, { row: row(7), recordNumber: "COB-000120", sameAs: null }, { row: row(8), recordNumber: null, sameAs: row(7) }] };
  for (const value of [several, allRepeated, repeatsListed])
    expect((await readThread({ ...thread, messages: [spreadsheet, { ...notice, spreadsheetRows: value }] })).messages[1].spreadsheetRows).toEqual(value);
});
// Like the reasons of AS4, «Por qué lo propuso» is no value of a response: the private retreat (`withoutFormReplyValues`) does not touch it,
// so it is read, and validated, for every reader.
it.each([true, false, undefined])("keeps «Por qué lo propuso» for a reader with canReadFormRecords %s, and checks it", async canReadFormRecords => {
  const read = await readThread({ ...thread, canReadFormRecords, messages: [spreadsheet, { ...notice, spreadsheetRows: rows }, load], outgoing: [{ ...queuedNotice, spreadsheetRows: rows }, queued] });
  expect(read.messages[1].spreadsheetRows).toEqual(rows);
  expect(read.outgoing[0].spreadsheetRows).toEqual(rows);
  await expect(readThread({ ...thread, canReadFormRecords, messages: [spreadsheet, { ...notice, spreadsheetRows: { ...rows, recognized: [] } }] })).rejects.toThrow("Unsupported chat response.");
});
it("keeps the assistant's explanation as it was: the rows are not part of it", async () => {
  await expect(readThread({ ...thread, messages: [spreadsheet, { ...notice, assistant: { reason: "", proposedFields: [], rows } }] })).rejects.toThrow("Unsupported chat response.");
});
const repeated = (entry: Record<string, unknown>) => ({ ...rows, repeated: [{ row: row(9), recordNumber: "COB-000120", sameAs: null, ...entry }] });
it.each<[string, unknown]>([
  ["null rows", null],
  ["rows that are a list", [row(2)]],
  ["rows without the ones for the team", { recognized: rows.recognized, sent: rows.sent, repeated: [] }],
  ["rows with an unknown member", { ...rows, unfit: [row(9)] }],
  ["no form recognized", { ...rows, recognized: [] }],
  ["a form recognized without rows", { ...rows, recognized: [{ form: "Cobranzas", count: 0 }] }],
  ["a form recognized without its name", { ...rows, recognized: [{ form: "", count: 7 }] }],
  ["a form recognized with an unknown member", { ...rows, recognized: [{ form: "Cobranzas", count: 7, definitionId: id(10) }] }],
  ["four rows sent", { ...rows, sent: [row(2), row(3), row(4), row(5)], forTeam: [row(6)] }],
  ["a row sent and for the team", { ...rows, forTeam: [row(4), row(5)] }],
  ["the same row twice for the team", { ...rows, forTeam: [row(5), row(5)] }],
  ["a repeated row also sent", repeated({ row: row(2) })],
  ["a repeated row with a response and a row", repeated({ sameAs: row(2) })],
  ["a repeated row with neither a response nor a row", repeated({ recordNumber: null })],
  ["a repeated row that repeats itself", repeated({ recordNumber: null, sameAs: row(9) })],
  ["a repeated row that repeats a row it does not list", repeated({ recordNumber: null, sameAs: row(12) })],
  ["a response number out of its format", repeated({ recordNumber: "120" })],
  ["a repeated row with an unknown member", repeated({ field: "Recibo" })],
  ["rows of a book with one sheet and of one with several", { ...rows, sent: [row(2), row(3, "Ventas")], forTeam: [row(4, "Compras")] }],
  ["a repeated row of another sheet", repeated({ row: row(9, "Ventas") })],
  ["a row with an empty sheet", { ...rows, forTeam: [row(5, "")] }],
  ["a row zero", { ...rows, forTeam: [row(0)] }],
  ["a row with an unknown member", { ...rows, forTeam: [{ ...row(5), column: "A" }] }],
])("rejects «Por qué lo propuso» with %s, in a message and in an outgoing", async (_case, spreadsheetRows) => {
  await expect(readThread({ ...thread, messages: [spreadsheet, { ...notice, spreadsheetRows }] })).rejects.toThrow("Unsupported chat response.");
  await expect(readThread({ ...thread, outgoing: [{ ...queuedNotice, spreadsheetRows }] })).rejects.toThrow("Unsupported chat response.");
});
