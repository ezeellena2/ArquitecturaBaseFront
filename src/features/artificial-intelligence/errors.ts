import { ApiError } from "@/shared/api/ApiError";
import type { TFunction } from "i18next";
import { errorFeedback } from "@/shared/api/errorFeedback";
// I7: the saved key cannot be decrypted (a restore without its ring key). It is not the server failing: replacing the key fixes it.
export const isCredentialUnavailable = (error: unknown) => error instanceof ApiError && error.code === "Ai.Connection.CredentialUnavailable";
// I3, review: the conversation no longer exists (another tab deleted it, or the purge did once everything in it expired). Retrying does not
// bring it back.
export const isConversationGone = (error: unknown) =>
    error instanceof ApiError && error.status === 404 && error.code === "Ai.Assistant.NotFound";
export function aiErrorMessage(error: unknown, t: TFunction<"artificialIntelligence">): string {
    if (isCredentialUnavailable(error)) return t("credentialUnavailable");
    if (error instanceof ApiError && error.code?.startsWith("Ai.Provider.")) return t(`providerErrors.${error.code.split(".").at(-1)}`);
    const feedback = errorFeedback(error);
    return feedback.network ? t("common:errors.network") : error instanceof ApiError && error.status >= 500
        ? t("common:errors.unexpected", { traceId: feedback.traceId ?? "?" }) : feedback.detail ?? t("common:states.error");
}
