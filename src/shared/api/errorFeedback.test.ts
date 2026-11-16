import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import { errorFeedback, operationalErrorMessage, readErrorMessage } from "./errorFeedback";

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

it("preserves the default review recovery and lets internal configuration retry explicitly",()=>{
  const t=(key:string)=>key;
  expect(operationalErrorMessage(ApiError.network(),t)).toBe("common:errors.writeUncertain");
  expect(operationalErrorMessage(ApiError.network(),t,"save")).toBe("common:errors.saveRetry");
  expect(operationalErrorMessage(new ApiError(500,{code:"General.Unexpected",traceId:"abc"}),t,"save")).toBe("common:errors.saveRetry");
});

// N9: un 5xx que no armó la Api (el 502 o el 504 del ingress, o un cuerpo que no es ProblemDetails) no trae código ni
// referencia que informar, y el texto lo dice sin «?». Con una referencia, se sigue pidiendo informarla.
it("explains a 5xx without a code from the API instead of asking to report a missing reference",()=>{
  const t=(key:string)=>key;
  expect(readErrorMessage(new ApiError(502,{}),t)).toBe("common:errors.unavailable");
  expect(readErrorMessage(new ApiError(504,{title:"Gateway Timeout"}),t)).toBe("common:errors.unavailable");
  expect(readErrorMessage(new ApiError(500,{code:"General.Unexpected",traceId:"abc"}),t)).toBe("common:errors.unexpected");
  expect(readErrorMessage(new ApiError(500,{traceId:"abc"}),t)).toBe("common:errors.unexpected");
  expect(operationalErrorMessage(new ApiError(502,{}),t)).toBe("common:errors.unavailableWrite");
  expect(operationalErrorMessage(new ApiError(503,{}),t,"save")).toBe("common:errors.unavailableSave");
  expect(operationalErrorMessage(new ApiError(500,{code:"General.Unexpected",traceId:"abc"}),t,"save")).toBe("common:errors.saveRetry");
});
