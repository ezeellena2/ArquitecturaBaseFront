import type { ApiError } from "./ApiError";

/// Firma mínima que hace falta de `t`, sin acoplar el tipo exacto de react-i18next. Sirve la de cualquier
/// namespace: las claves de acá van con `common:` adelante.
type Translate = (key: string, options?: Record<string, unknown>) => string;

/// Los errores de pedir y de verificar un código de un solo uso. Los comparten el ingreso (`/login` y
/// `/login/codigo`) y el perfil, que con el mismo código comprueba que un número o un correo es de quien lo agrega:
/// el backend responde los mismos códigos en los dos lugares.
///
/// El front decide por el `code`, que es estable, nunca por el texto. Casi todos ya vienen traducidos del servidor
/// (vencido, ya usado, sin intentos, demasiados pedidos) y se muestran con su `detail`. Lo que se decide acá es
/// **dónde** va cada uno.

/// El mensaje de un pedido que no prosperó, arriba del botón: el `detail` del servidor, o uno propio si no hubo
/// respuesta.
export function codeRequestErrorMessage(error: ApiError, t: Translate): string {
  if (error.isNetworkError) {
    return t("common:errors.network");
  }

  return error.detail ?? t("common:errors.generic");
}

/// Lo que el servidor le reprocha al número, que va debajo del campo y no arriba del botón. `Users.Phone.Invalid`
/// y `Auth.WhatsApp.CountryNotSupported` llegan sin `errors` (los arma el caso de uso, no la validación): se atan
/// al campo por el código. Los de la validación ("number" y "country") sí vienen por campo. Undefined si el error
/// no es del número.
export function phoneFieldError(error: ApiError, t: Translate): string | undefined {
  switch (error.code) {
    // El mismo texto que el número vacío: para quien lo escribió, es el mismo problema.
    case "Users.Phone.Invalid":
      return t("common:phone.invalid");
    case "Auth.WhatsApp.CountryNotSupported":
      return error.detail ?? t("common:phone.countryNotSupported");
    default:
      return error.errors?.number?.[0] ?? error.errors?.country?.[0];
  }
}

/// El código escrito no era el correcto: las casillas se marcan en error. Uno vencido o ya usado no se marca,
/// porque no se equivocó al escribirlo.
export function isWrongCodeError(error: ApiError): boolean {
  return error.code === "Auth.LoginCode.Invalid";
}

/// Los intentos que le quedan al código, si el servidor los dijo. `attemptsLeft` es una extensión del
/// ProblemDetails: no tiene un getter propio en `ApiError`.
export function attemptsLeftOf(error: ApiError): number | undefined {
  const value = error.problem.attemptsLeft;

  return typeof value === "number" ? value : undefined;
}

/// El mensaje de una verificación que falló. Una validación trae el porqué en `errors` (el formato del código, o
/// el correo y el número a la vez, en `errors.phone`), y su `detail` genérico ("Revisá los campos marcados") no
/// tendría un campo marcado al que mirar.
export function verifyCodeErrorMessage(error: ApiError, t: Translate): string {
  const fieldMessage = error.errors?.code?.[0] ?? error.errors?.phone?.[0] ?? error.errors?.email?.[0];

  return fieldMessage ?? codeRequestErrorMessage(error, t);
}
