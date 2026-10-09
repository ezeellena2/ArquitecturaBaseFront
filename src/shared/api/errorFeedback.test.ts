import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import { errorFeedback } from "./errorFeedback";

describe("errorFeedback", () => {
  it("distinguishes cancellation, server waiting and public access errors", () => {
    expect(errorFeedback(new DOMException("Aborted", "AbortError")).kind).toBe("cancelled");
    expect(errorFeedback(new ApiError(429, { retryAfter: 60 }))).toMatchObject({ kind: "wait", retryAfterSeconds: 60 });
    expect(errorFeedback(new ApiError(401, { code: "Auth.LoginCode.Invalid" }), { publicAccess: true }).kind).toBe("error");
    expect(errorFeedback(new ApiError(403, { code: "Auth.Account.Disabled" }), { publicAccess: true }).kind).toBe("error");
  });
  it("requires checking an uncertain write before retrying", () => {
    expect(errorFeedback(ApiError.network(), { writing: true }).kind).toBe("uncertain");
    expect(errorFeedback(new ApiError(500, { traceId: "abc" }), { writing: true })).toMatchObject({ kind: "uncertain", traceId: "abc" });
  });
  it("keeps visible field validation out of operational notifications", () => {
    expect(errorFeedback(new ApiError(400, { errors: { defaultCulture: ["Revisá el idioma"] } }), { fields: ["defaultCulture"] }))
      .toMatchObject({ kind: "fields", fields: { defaultCulture: ["Revisá el idioma"] } });
    expect(errorFeedback(new ApiError(400, { errors: { unknown: ["Invalid"] } }), { fields: ["defaultCulture"] }).kind).toBe("error");
  });
  it("distinguishes session, permission and revision recovery", () => {
    expect(errorFeedback(new ApiError(401, {})).kind).toBe("session");
    expect(errorFeedback(new ApiError(403, {})).kind).toBe("forbidden");
    expect(errorFeedback(new ApiError(409, { code: "Settings.System.RevisionConflict" }), { conflictCodes: ["Settings.System.RevisionConflict"] }).kind).toBe("conflict");
  });
});
