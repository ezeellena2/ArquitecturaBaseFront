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
const closedAccountCodes = new Set(["Auth.Account.NotInvited", "Auth.Account.Disabled"]);

export function isSpentCodeError(error: ApiError): boolean {
  return error.code !== undefined && spentCodeCodes.has(error.code);
}

export function isClosedAccountError(error: ApiError): boolean {
  return error.code !== undefined && closedAccountCodes.has(error.code);
}

/// Qué hace `/ingresar` con un enlace que el servidor no aceptó, en la vista previa o en el canje:
/// - `invalid`: el enlace ya no sirve. Vencido, usado, invalidado o inventado responden lo mismo, a propósito, y la
///   pantalla tampoco los distingue.
/// - `disabled` y `lockedOut`: el enlace era bueno, pero la cuenta no puede entrar. El servidor lo dice recién en el
///   canje, y el enlace ya quedó gastado: reintentar no sirve, hace falta otro.
/// - `retry`: nada de eso (el límite de pedidos, la red, un error inesperado). Pasa, y se puede volver a intentar.
export type LoginLinkFailure = "invalid" | "disabled" | "lockedOut" | "retry";

export function loginLinkFailureOf(error: ApiError): LoginLinkFailure {
  switch (error.code) {
    case "Auth.LoginLink.Invalid":
      return "invalid";
    // El único campo es el token: uno sin la forma de un token (no son 43 caracteres base64url) es un enlace cortado
    // o tocado a mano. Para quien lo abrió, tampoco sirve.
    case "Validation.Failed":
      return "invalid";
    case "Auth.Account.Disabled":
      return "disabled";
    // Es un 429, pero no el del límite de pedidos: el canje ya gastó el enlace, así que esperar no alcanza.
    case "Auth.Account.LockedOut":
      return "lockedOut";
    default:
      return "retry";
  }
}

/// El mensaje de `/login?error=<código>`, donde manda el servidor cuando falla el ingreso con Google
/// (`ExternalLoginEndpoints`). Es una navegación, no un ProblemDetails: llega solo el código, sin texto, así que
/// los textos son propios. Un código que no se conoce tiene uno genérico.
export function loginRedirectErrorMessage(code: string, t: Translate): string {
  switch (code) {
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
    default:
      return t("login.errors.unknown");
  }
}
