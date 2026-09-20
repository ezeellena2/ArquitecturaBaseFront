import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./ApiError";
import { applyApiErrorToForm } from "./formErrors";

describe("applyApiErrorToForm", () => {
  it("sets one error per field and returns true", () => {
    const setError = vi.fn();
    const error = new ApiError(400, {
      code: "Validation.Failed",
      errors: { email: ["Ingresá un correo válido."], code: ["Ingresá el código."] },
    });

    expect(applyApiErrorToForm(error, setError)).toBe(true);
    expect(setError).toHaveBeenCalledWith("email", { type: "server", message: "Ingresá un correo válido." });
    expect(setError).toHaveBeenCalledWith("code", { type: "server", message: "Ingresá el código." });
  });

  it("returns false when the error is not a validation problem", () => {
    const setError = vi.fn();

    expect(applyApiErrorToForm(new ApiError(429, { code: "Auth.LoginCode.ResendTooSoon" }), setError)).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
