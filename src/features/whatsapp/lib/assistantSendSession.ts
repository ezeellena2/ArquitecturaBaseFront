import type { AssistantProposal } from "../api/assistant";
export interface AssistantSendAttempt { readonly requestId: string; readonly includedFieldIds: readonly string[] }
export function freezeAssistantSend(proposal: AssistantProposal, selected: readonly string[], requestId: string): AssistantSendAttempt {
  const includedFieldIds = proposal.fields.filter(field => selected.includes(field.fieldId)).map(field => field.fieldId);
  return Object.freeze({ requestId, includedFieldIds: Object.freeze(includedFieldIds) });
}
