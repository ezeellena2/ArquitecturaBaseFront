import { ApiError } from "./ApiError";

export function errorFeedback(error: unknown, options: { writing?: boolean; publicAccess?: boolean; fields?: readonly string[]; conflictCodes?: readonly string[] } = {}) {
  const apiError = error instanceof ApiError ? error : undefined;
  const fields = Object.fromEntries(Object.entries(apiError?.errors ?? {}).filter(([key]) => options.fields?.includes(key)));
  const unmatchedFields = Object.keys(apiError?.errors ?? {}).some((key) => !options.fields?.includes(key));
  const kind = typeof error === "object" && error !== null && "name" in error && error.name === "AbortError" ? "cancelled"
    : apiError?.status === 429 ? "wait"
    : apiError?.status === 401 && !options.publicAccess ? "session"
    : apiError?.status === 403 && !options.publicAccess ? "forbidden"
    : apiError?.code && options.conflictCodes?.includes(apiError.code) ? "conflict"
    : Object.keys(fields).length > 0 && !unmatchedFields ? "fields"
    : options.writing && (!apiError || apiError.isNetworkError || apiError.status >= 500) ? "uncertain"
    : "error";
  return { kind, fields, detail: apiError?.detail, traceId: apiError?.traceId, retryAfterSeconds: apiError?.retryAfterSeconds, network: apiError?.isNetworkError ?? false };
}

export function operationalErrorMessage(error: unknown, t: (key: string, options?: Record<string, unknown>) => string, recovery: "review" | "save" = "review"): string {
  const feedback = errorFeedback(error, { writing: true });
  if (feedback.kind === "uncertain") return t(recovery === "save" ? "common:errors.saveRetry" : "common:errors.writeUncertain", { traceId: feedback.traceId ?? "?" });
  return feedback.detail ?? t("common:states.error");
}

export function readErrorMessage(error: unknown, t: (key: string, options?: Record<string, unknown>) => string): string {
  const feedback = errorFeedback(error);
  return feedback.network ? t("common:errors.network")
    : error instanceof ApiError && error.status >= 500 ? t("common:errors.unexpected", { traceId: feedback.traceId ?? "?" })
    : feedback.detail ?? t("common:states.error");
}
