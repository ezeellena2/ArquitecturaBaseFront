import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import { errorFeedback } from "./errorFeedback";

describe("errorFeedback", () => {
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
