import { expect, it } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@/test/mocks/server";
import { fetchRuleHistory, readRuleSet } from "./rules";
import { newRuleAction } from "../rules";
const definitionId = "0199a0c0-0000-7000-8000-000000000010";
it("accepts the initial empty rule set and optional translated message", () => {
  expect(readRuleSet({ id: null, definitionId, revision: 0, originalCulture: "es", rules: [], createdAtUtc: null, author: null }).revision).toBe(0);
  expect(readRuleSet({ id: crypto.randomUUID(), definitionId, revision: 1, originalCulture: "es", rules: [{ id: crypto.randomUUID(), event: "Received", conditions: [], actions: [{ ...newRuleAction("NotifyAuthor"), text: { es: "Recibimos {número}." } }] }], createdAtUtc: "2026-10-16T12:00:00Z", author: { userId: crypto.randomUUID(), displayName: "Ana" } }).rules[0].actions[0].text).toEqual({ es: "Recibimos {número}." });
});
it("rejects an unsupported rule contract without retaining private text", () => {
  const privateText = "private action text";
  expect(() => readRuleSet({ rules: [{ text: privateText }] })).toThrow("Invalid form rules contract.");
  try { readRuleSet({ rules: [{ text: privateText }] }); } catch (error) { expect(JSON.stringify(error)).not.toContain(privateText); }
});

const changes = { addedRules: 1, updatedRules: 2, removedRules: 0, orderChanged: true };
function historyRow(value: unknown) { return { items: [{ id: definitionId, revision: 2, createdAtUtc: "2026-10-17T12:00:00Z", author: null, hasApproval: false, changes: value }], page: 1, pageSize: 10, totalCount: 1, totalPages: 1, hasPrevious: false, hasNext: false }; }
it("reads the required rule history summary from its public contract", async () => {
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json(historyRow(changes))));
  expect((await fetchRuleHistory(definitionId, 1)).items[0].changes).toEqual(changes);
});
it.each([undefined, null, { ...changes, addedRules: -1 }, { ...changes, updatedRules: 1.5 }, { addedRules: 0, updatedRules: 0, removedRules: 0 }])("rejects incomplete or invalid rule history changes %j without compatibility defaults", async value => {
  server.use(http.get("/api/forms/definitions/:id/rules/revisions", () => HttpResponse.json(historyRow(value))));
  await expect(fetchRuleHistory(definitionId, 1)).rejects.toThrow("Invalid form rules contract.");
});
