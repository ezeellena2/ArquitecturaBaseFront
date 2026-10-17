import { afterEach, expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { resetHttpClient } from "@/shared/api/httpClient";
import { parseAssistantSuggestion, requestAssistantSuggestion, getAssistantSuggestion, discardAssistantSuggestion, sendAssistantSuggestion } from "./assistant";
const contact = "019abcde-1000-7000-8000-000000000010";
const requestId = "019abcde-1000-7000-8000-000000000003";
const sourceMessageId = "019abcde-1000-7000-8000-000000000004";
const fieldId = "019abcde-1000-7000-8000-000000000005";
const proposal = { proposalId: "019abcde-1000-7000-8000-000000000006", definitionId: "019abcde-1000-7000-8000-000000000001", versionId: "019abcde-1000-7000-8000-000000000002", versionNumber: 2, name: "Visita", culture: "es", reason: "Pidió registrar la visita", fields: [{ fieldId, label: "Cliente", displayValue: "Ana" }] };
const ready = { requestId, sourceMessageId, state: "Ready", proposal, outgoing: null };
const outgoing = { quickReplies: null, id: "019abcde-1000-7000-8000-000000000007", requestId: "019abcde-1000-7000-8000-000000000008", operatorUserId: "019abcde-1000-7000-8000-000000000009", body: "Completá el formulario", requestedAtUtc: "2026-10-17T12:00:00Z", state: "Pending", waMessageId: null, kind: "Flow", origin: "Conversation", assistant: { reason: proposal.reason, proposedFields: proposal.fields }, form: { definitionId: proposal.definitionId, versionId: proposal.versionId, versionNumber: 2, name: { es: "Visita", en: "Visit" }, culture: "es" }, recoveryPath: null };
it("reads a ready display-only proposal and accepts the server's shared request identity", () => {
  expect(parseAssistantSuggestion(ready, contact, { sourceMessageId })).toEqual(ready);
});
it("recovers the accepted shared receipt without attributing it to the current operator", () => {
  const sent = { ...ready, state: "Sent", proposal: null, outgoing };
  expect(parseAssistantSuggestion(sent, contact, { requestId, sourceMessageId })).toEqual(sent);
});
it.each(["Pending", "NoReply", "Blocked", "Discarded"])("reads %s without inventing a form or canonical values", state => {
  const body = { ...ready, state, proposal: null };
  expect(parseAssistantSuggestion(body, contact)).toEqual(body);
});
it.each([
  { ...ready, state: "Future" }, { ...ready, proposal: null }, { ...ready, outgoing },
  { ...ready, state: "Pending" }, { ...ready, state: "Sent", proposal: null },
  { ...ready, proposal: { ...proposal, fields: [{ ...proposal.fields[0], value: "PRIVATE_CANONICAL" }] } },
  { ...ready, proposal: { ...proposal, fields: [proposal.fields[0], proposal.fields[0]] } },
  { ...ready, proposal: { ...proposal, culture: "fr" } },
  { ...ready, state: "Sent", proposal: null, outgoing: { ...outgoing, origin: "Assistant" } },
  { ...ready, state: "Sent", proposal: null, outgoing: { ...outgoing, recoveryPath: "https://foreign.example/PRIVATE" } },
])("rejects an unsupported suggestion without retaining private response details %#", value => {
  let error: unknown; try { parseAssistantSuggestion(value, contact); } catch (caught) { error = caught; }
  expect(error).toBeInstanceOf(Error);
  expect(String(error)).toBe("Error: Unsupported assistant response.");
  expect(JSON.stringify(error)).not.toContain("PRIVATE");
});
it("rejects a response for another source or consulted request", () => {
  expect(() => parseAssistantSuggestion(ready, contact, { sourceMessageId: fieldId })).toThrow();
  expect(() => parseAssistantSuggestion(ready, contact, { requestId: fieldId })).toThrow();
});

afterEach(resetHttpClient);
it("uses only the owned request, read, discard and send routes with closed request bodies", async () => {
  const received: unknown[] = [];
  const base = "/api/whatsapp/chats/" + contact + "/assistant-suggestions";
  server.use(http.post(base, async ({ request }) => { received.push(await request.json()); return HttpResponse.json(ready, { status: 202 }); }), http.get(base + "/" + requestId, () => HttpResponse.json(ready)), http.post(base + "/" + requestId + "/discard", async ({ request }) => { received.push(await request.text()); return HttpResponse.json({ ...ready, state: "Discarded", proposal: null }); }), http.post(base + "/" + requestId + "/send", async ({ request }) => { received.push(await request.json()); return HttpResponse.json(outgoing, { status: 202 }); }));
  expect(await requestAssistantSuggestion(contact, { requestId, sourceMessageId, expectedModeRevision: 7 })).toEqual(ready);
  expect(await getAssistantSuggestion(contact, requestId)).toEqual(ready);
  expect((await discardAssistantSuggestion(contact, requestId)).state).toBe("Discarded");
  expect(await sendAssistantSuggestion(contact, requestId, { requestId: outgoing.requestId, includedFieldIds: [fieldId] })).toEqual(outgoing);
  expect(received).toEqual([{ requestId, sourceMessageId, expectedModeRevision: 7 }, "", { requestId: outgoing.requestId, includedFieldIds: [fieldId] }]);
});
