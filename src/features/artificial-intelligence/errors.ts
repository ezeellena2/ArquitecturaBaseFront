import { ApiError } from "@/shared/api/ApiError";
import type { TFunction } from "i18next";
import { errorFeedback } from "@/shared/api/errorFeedback";
export function aiErrorMessage(error: unknown, t: TFunction<"artificialIntelligence">): string {
    if (error instanceof ApiError && error.code?.startsWith("Ai.Provider.")) return t(`providerErrors.${error.code.split(".").at(-1)}`);
    const feedback = errorFeedback(error);
    return feedback.network ? t("common:errors.network") : error instanceof ApiError && error.status >= 500
        ? t("common:errors.unexpected", { traceId: feedback.traceId ?? "?" }) : feedback.detail ?? t("common:states.error");
}
