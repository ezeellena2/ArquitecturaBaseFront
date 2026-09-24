import { describe, expect, it } from "vitest";
import { ApiError } from "./ApiError";
import {
  attemptsLeftOf,
  codeRequestErrorMessage,
  isWrongCodeError,
  phoneFieldError,
  verifyCodeErrorMessage,
} from "./codeErrors";
import i18n from "@/shared/i18n";

// La `t` de cualquier namespace sirve: las claves de acá van con "common:" adelante.
const t = i18n.getFixedT("es", "profile");

function problem(status: number, body: Record<string, unknown>): ApiError {
  return new ApiError(status, body);
}

describe("codeRequestErrorMessage", () => {
  it("is the detail the server sent", () => {
    expect(codeRequestErrorMessage(problem(429, { detail: "Pediste demasiados códigos." }), t)).toBe(
      "Pediste demasiados códigos.",
    );
  });

  it("says there was no connection when the request did not get an answer", () => {
    expect(codeRequestErrorMessage(ApiError.network(), t)).toBe("No pudimos conectarnos. Revisá tu conexión.");
  });

  it("has a text of its own when the server sent none", () => {
    expect(codeRequestErrorMessage(problem(500, {}), t)).toBe("Ocurrió un error. Probá de nuevo en un momento.");
  });
});

describe("phoneFieldError", () => {
  it("ties an invalid number to the field, with the same text as an empty one", () => {
    expect(phoneFieldError(problem(400, { code: "Users.Phone.Invalid", detail: "El número no es válido." }), t)).toBe(
      "Ingresá un número de celular válido.",
    );
  });

  it("ties a country that is not allowed to the field", () => {
    expect(
      phoneFieldError(problem(400, { code: "Auth.WhatsApp.CountryNotSupported", detail: "No a ese país." }), t),
    ).toBe("No a ese país.");
    expect(phoneFieldError(problem(400, { code: "Auth.WhatsApp.CountryNotSupported" }), t)).toBe(
      "Todavía no mandamos códigos a números de ese país.",
    );
  });

  it("takes what the validation said about the number or the country", () => {
    expect(phoneFieldError(problem(400, { code: "Validation.Failed", errors: { number: ["Muy largo."] } }), t)).toBe(
      "Muy largo.",
    );
    expect(phoneFieldError(problem(400, { code: "Validation.Failed", errors: { country: ["País raro."] } }), t)).toBe(
      "País raro.",
    );
  });

  it("is undefined when the error is not about the number", () => {
    expect(phoneFieldError(problem(429, { code: "Auth.LoginCode.TooManyRequests" }), t)).toBeUndefined();
  });
});

describe("verifyCodeErrorMessage", () => {
  it("prefers what the validation said about a field over its generic detail", () => {
    expect(
      verifyCodeErrorMessage(
        problem(400, { code: "Validation.Failed", detail: "Revisá los campos.", errors: { code: ["Son 6 dígitos."] } }),
        t,
      ),
    ).toBe("Son 6 dígitos.");
  });

  it("is the detail of any other error", () => {
    expect(verifyCodeErrorMessage(problem(400, { code: "Auth.LoginCode.Expired", detail: "El código venció." }), t)).toBe(
      "El código venció.",
    );
  });
});

describe("isWrongCodeError", () => {
  it("is only the code that was typed wrong", () => {
    expect(isWrongCodeError(problem(400, { code: "Auth.LoginCode.Invalid" }))).toBe(true);
    expect(isWrongCodeError(problem(400, { code: "Auth.LoginCode.Expired" }))).toBe(false);
  });
});

describe("attemptsLeftOf", () => {
  it("reads the attempts left from the problem", () => {
    expect(attemptsLeftOf(problem(400, { code: "Auth.LoginCode.Invalid", attemptsLeft: 3 }))).toBe(3);
    expect(attemptsLeftOf(problem(400, { code: "Auth.LoginCode.Expired" }))).toBeUndefined();
  });
});
