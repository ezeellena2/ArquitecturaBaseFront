import { z } from "zod";

/**
 * The import of the spreadsheet a Home proposal mapped (IA2, IA4), as the catalog page receives it: the turn's request and the
 * proposal. It travels in the navigation state, never in the address, except WhatsApp's link, which the page then cleans.
 */
export interface AssistantImportRequest { readonly requestId: string; readonly proposalId: string }
/** With the spreadsheet's name and rows when the opener knows them (the card or the pending import), for the dialog's origin. */
export interface AssistantImportSource extends AssistantImportRequest { readonly fileName?: string; readonly rowCount?: number }
const navigationState = z.object({ assistantImport: z.strictObject({
  requestId: z.uuid(), proposalId: z.uuid(), fileName: z.string().min(1).optional(), rowCount: z.number().int().nonnegative().optional(),
}) });
export const assistantImportState = (source: AssistantImportSource) => ({ assistantImport: source });
export function readAssistantImportState(state: unknown): AssistantImportSource | null {
  const parsed = navigationState.safeParse(state);
  return parsed.success ? parsed.data.assistantImport : null;
}
/** The navigation state without the import, once the page opened it: what other owners keep there stays. */
export function withoutAssistantImport(state: unknown): Record<string, unknown> | null {
  if (!state || typeof state !== "object") return null;
  const { assistantImport: _taken, ...rest } = state as Record<string, unknown>;
  return Object.keys(rest).length ? rest : null;
}
// WhatsApp's link, `/catalogos/{id}?pedido={requestId:N}&propuesta={proposalId:N}`: each identifier as 32 digits.
const compact = /^[0-9a-f]{32}$/i;
const dashed = (value: string) => [value.slice(0, 8), value.slice(8, 12), value.slice(12, 16), value.slice(16, 20), value.slice(20)].join("-").toLowerCase();
export function readAssistantImportQuery(query: URLSearchParams): AssistantImportSource | null {
  const requestId = query.get("pedido"), proposalId = query.get("propuesta");
  return requestId && proposalId && compact.test(requestId) && compact.test(proposalId) ? { requestId: dashed(requestId), proposalId: dashed(proposalId) } : null;
}
