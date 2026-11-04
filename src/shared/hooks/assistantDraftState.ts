// A request begun on another screen for a new Home conversation (IA4): it travels in the navigation state, never in the URL,
// and Home leaves it in its composer without sending it.
const key = "assistantDraft";
export const assistantDraftState = (text: string) => ({ [key]: text });
export function readAssistantDraft(state: unknown): string | null {
  const value = typeof state === "object" && state !== null ? (state as Record<string, unknown>)[key] : undefined;
  return typeof value === "string" && value.trim() ? value : null;
}
/** Whether a screen may offer «Armar con la IA»: Home assistant installed and allowed for this person. */
export const canAskAssistant = (installedFeatures: readonly string[] | undefined, permissions: readonly string[] | undefined) =>
  !!installedFeatures?.includes("assistant") && !!permissions?.includes("ai.assistant.use");
