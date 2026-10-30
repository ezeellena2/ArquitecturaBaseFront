import type { EntryDraft } from "./entryForm";

// «Pantalla completa» takes what the panel loaded to the page. It stays in memory, once, for the same owner and form:
// never in the URL, the history state or storage.
let handoff: { key: string; draft: EntryDraft } | null = null;

export function handOverEntryDraft(owner: string, formId: string, draft: EntryDraft): void {
  handoff = { key: owner + ":" + formId, draft };
}

export function takeEntryDraft(owner: string, formId: string): EntryDraft | undefined {
  const taken = handoff?.key === owner + ":" + formId ? handoff.draft : undefined;
  handoff = null;
  return taken;
}
