import { ApiError } from "./ApiError";

export function errorFeedback(error: unknown, options: { writing?: boolean; fields?: readonly string[]; conflictCodes?: readonly string[] } = {}) {
  const apiError = error instanceof ApiError ? error : undefined;
  const fields = Object.fromEntries(Object.entries(apiError?.errors ?? {}).filter(([key]) => options.fields?.includes(key)));
  const unmatchedFields = Object.keys(apiError?.errors ?? {}).some((key) => !options.fields?.includes(key));
  const kind = apiError?.status === 401 ? "session"
    : apiError?.status === 403 ? "forbidden"
    : apiError?.code && options.conflictCodes?.includes(apiError.code) ? "conflict"
    : Object.keys(fields).length > 0 && !unmatchedFields ? "fields"
    : options.writing && (!apiError || apiError.isNetworkError || apiError.status >= 500) ? "uncertain"
    : "error";
  return { kind, fields, detail: apiError?.detail, traceId: apiError?.traceId, network: apiError?.isNetworkError ?? false };
}
