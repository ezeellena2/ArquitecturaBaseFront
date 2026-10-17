import { responseDetailFixture, responseFormId, responseRecordId, responseSecondId } from "./responseFixtures";
// Synthetic historical data; captured HTTP bytes are qualified separately.
export function assistedResponseFixture() {
 const detail = responseDetailFixture();
 return { ...detail, assistance: {
  senderKind: "Manual" as const, operator: { userId: detail.actor.userId, displayName: "Luz Operadora" }, reason: "Se informó una entrega y quedó pendiente su cobro.",
  suggestion: { originRecordId: responseSecondId, suggestionId: "0199a0c0-0000-7000-8000-000000000090", mode: "Always" as const },
  values: [
   { proposed: { ...detail.values[0], value: "7" }, included: true, changed: true, mapped: true },
   { proposed: { ...detail.values[1], value: "Texto propuesto histórico" }, included: false, changed: false, mapped: false },
   { proposed: detail.values[4], included: true, changed: false, mapped: true },
  ],
 }, chain: [
  { id: responseSecondId, definitionId: responseFormId, originRecordId: null, number: "TEST-000001", name: "Entrega histórica", submittedAtUtc: "2026-10-16T11:00:00Z" },
  { id: responseRecordId, definitionId: responseFormId, originRecordId: responseSecondId, number: detail.number, name: detail.name, submittedAtUtc: detail.submittedAtUtc },
 ] };
}
