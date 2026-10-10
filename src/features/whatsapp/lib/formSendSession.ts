import type { ChatFormOption, RecipientCulture } from "../api/forms";

export interface FormMessageRequest { requestId: string; definitionId: string; versionId: string; expectedModeRevision: number; expectedRecipientContextRevision: string; message: string }
export interface FormSendDraft { message: string; selection?: ChatFormOption; recipientCulture: RecipientCulture; recipientContextRevision: string; modeRevision: number; touched?: boolean; attempt?: Readonly<FormMessageRequest>; notStored?: boolean; blocked?: "recipientChanged" | "formUnavailable" | "forbidden" }

export function freezeFormMessage(draft: FormSendDraft, requestId: string): Readonly<FormMessageRequest> {
  if (!draft.selection) throw new Error("A form selection is required before freezing the request.");
  return Object.freeze({ requestId, definitionId: draft.selection.definitionId, versionId: draft.selection.versionId, expectedModeRevision: draft.modeRevision, expectedRecipientContextRevision: draft.recipientContextRevision, message: draft.message });
}
export function recipientChanged(draft: FormSendDraft, revision: string | null | undefined, culture: RecipientCulture | null | undefined) { return draft.recipientContextRevision !== revision || draft.recipientCulture !== culture; }
export function selectedVersionChanged(selection: ChatFormOption, page: readonly ChatFormOption[]) { return page.some(option => option.definitionId === selection.definitionId && option.versionId !== selection.versionId); }
export function formOptionKey(option: ChatFormOption) { return option.definitionId + ":" + option.versionId; }
