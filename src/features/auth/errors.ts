import type { ApiError } from "@/shared/api/ApiError";

/// Firma mínima que necesitamos de `t` (la del namespace "auth"), sin acoplar el tipo exacto de react-i18next.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// El front decide por el `code`, que es estable, nunca por el texto. Lo que comparte con el perfil (los mensajes de
/// pedir y de verificar un código, y el error del número) vive en `shared/api/codeErrors`; acá queda lo que es solo
/// del ingreso: qué errores cortan el intento o la cuenta, el enlace del chat y el redirect de Google.

// Cortan el intento con este código, pero no el ingreso: se puede pedir otro.
const spentCodeCodes = new Set(["Auth.Account.LockedOut", "Auth.LoginCode.TooManyAttempts"]);

// Cortan el ingreso: ni verificar de nuevo ni pedir otro código lo cambia. Un reintento, además, reemplazaría el
// mensaje por "El código ya se usó", porque el código correcto ya se gastó al responder esto.
const closedAccountCodes = new Set(["Auth.Account.NotInvited", "Auth.Account.Disabled", "Auth.Account.NotRegistered", "Auth.Account.AlreadyRegistered"]);

export function isSpentCodeError(error: ApiError): boolean {
  return error.code !== undefined && spentCodeCodes.has(error.code);
}

export function isClosedAccountError(error: ApiError): boolean {
  return error.code !== undefined && closedAccountCodes.has(error.code);
}

/// El mensaje de `/login?error=<código>`, donde manda el servidor cuando falla el ingreso con Google
/// (`ExternalLoginEndpoints`). Es una navegación, no un ProblemDetails: llega solo el código, sin texto, así que
/// los textos son propios. Un código que no se conoce tiene uno genérico.
export function loginRedirectErrorMessage(code: string, t: Translate): string {
  switch (code) {
    case "Auth.Account.NotRegistered":
      return t("login.errors.notRegistered");
    case "Auth.Account.AlreadyRegistered":
      return t("login.errors.alreadyRegistered");
    case "Auth.Account.NotInvited":
      return t("login.errors.notInvited");
    case "Auth.Account.Disabled":
      return t("login.errors.disabled");
    case "Auth.Account.LockedOut":
      return t("login.errors.lockedOut");
    case "Auth.ExternalLogin.Failed":
      return t("login.errors.googleFailed");
    case "Auth.ExternalLogin.EmailNotVerified":
      return t("login.errors.googleEmailNotVerified");
    case "Auth.ExternalLogin.AccountEmailNotConfirmed":
      return t("login.errors.accountEmailNotConfirmed");
    default:
      return t("login.errors.unknown");
  }
}
