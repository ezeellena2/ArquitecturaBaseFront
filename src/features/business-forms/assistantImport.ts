import { z } from "zod";

/**
 * The import of the spreadsheet a Home proposal mapped (IA2, IA4), as the catalog page receives it: the turn's request and the
 * proposal. It travels in the navigation state, never in the address.
 */
export interface AssistantImportRequest { readonly requestId: string; readonly proposalId: string }
const navigationState = z.object({ assistantImport: z.strictObject({ requestId: z.uuid(), proposalId: z.uuid() }) });
export const assistantImportState = (request: AssistantImportRequest) => ({ assistantImport: request });
export function readAssistantImportState(state: unknown): AssistantImportRequest | null {
  const parsed = navigationState.safeParse(state);
  return parsed.success ? parsed.data.assistantImport : null;
}
