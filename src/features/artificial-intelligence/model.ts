import type { AiConnection, AiProvider, AiSaveRequest, CredentialChange } from "./api/aiConnection";
// RC1-A: the days to keep Home conversations are edited as text, so the box can be empty while typing; they are checked on save.
export interface AiDraft { provider: AiProvider; model: string; enabled: boolean; credentialChange: CredentialChange; apiKey: string; replacing: boolean; retentionDays: string }
export const draftFrom = (current: AiConnection): AiDraft => ({ provider: current.provider, model: current.model, enabled: current.enabled, credentialChange: "Keep", apiKey: "", replacing: false,
    retentionDays: String(current.conversationRetentionDays) });
/// RC1-A: whole days from one to the installation's ceiling, as the server checks them.
export const retentionValid = (draft: AiDraft, current: AiConnection) => {
    const days = Number(draft.retentionDays.trim());
    return draft.retentionDays.trim() !== "" && Number.isInteger(days) && days >= 1 && days <= current.conversationRetentionCeilingDays;
};
export const hasCredential = (draft: AiDraft, current: AiConnection) => draft.credentialChange === "Replace" ? draft.apiKey.length > 0 : draft.credentialChange === "Keep" && current.hasCredential && draft.provider === current.provider;
export const dirty = (draft: AiDraft, current: AiConnection) => draft.provider !== current.provider || draft.model.trim() !== current.model || draft.enabled !== current.enabled
    || draft.replacing || draft.apiKey !== "" || (draft.credentialChange === "Remove" && current.hasCredential) || draft.retentionDays.trim() !== String(current.conversationRetentionDays);
export const changeProvider = (draft: AiDraft, provider: AiProvider): AiDraft => ({ ...draft, provider, model: "", enabled: false, credentialChange: "Remove", apiKey: "", replacing: false });
export const saveRequest = (draft: AiDraft, revision: number, requestId: string): AiSaveRequest => ({ provider: draft.provider, model: draft.model.trim(), enabled: draft.credentialChange === "Remove" ? false : draft.enabled,
    credentialChange: draft.credentialChange, apiKey: draft.credentialChange === "Replace" ? draft.apiKey : null, expectedRevision: revision, requestId,
    conversationRetentionDays: Number(draft.retentionDays.trim()) });
export function mergeReview(draft: AiDraft, baseline: AiConnection, current: AiConnection): AiDraft {
    return { ...draftFrom(current),
        provider: draft.provider !== baseline.provider || draft.credentialChange === "Replace" ? draft.provider : current.provider,
        model: draft.model !== baseline.model || draft.credentialChange === "Replace" ? draft.model : current.model,
        enabled: draft.enabled !== baseline.enabled ? draft.enabled : current.enabled,
        credentialChange: draft.credentialChange, apiKey: draft.apiKey, replacing: draft.replacing,
        retentionDays: draft.retentionDays.trim() !== String(baseline.conversationRetentionDays) ? draft.retentionDays : String(current.conversationRetentionDays),
    };
}
