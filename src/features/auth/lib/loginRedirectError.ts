/// Cuando el ingreso con Google falla, el backend manda a `/login?error=<código>` **sin** `returnUrl`
/// (`ExternalLoginEndpoints`). Sin `returnUrl`, `/login` no puede mostrar el formulario: arranca el redirect de OIDC
/// y el servidor vuelve a mandar a `/login`, esta vez con el `returnUrl` y sin el error. El redirect es una
/// navegación completa del navegador, así que lo único que cruza del otro lado es lo que quede guardado en la
/// pestaña: por eso el código viaja en `sessionStorage`, con clave propia, como la marca de reintento de
/// `CallbackPage`. Es solo el código del error: ni un dato de la persona ni un token.
const storageKey = "arquitecturabase.login-error";

export function carryLoginRedirectError(code: string): void {
  try {
    globalThis.sessionStorage.setItem(storageKey, code);
  } catch {
    // Modo privado u otra restricción: el ingreso arranca igual, sin el mensaje.
  }
}

/// Solo lee: el render tiene que ser puro. Lo borra `forgetLoginRedirectError`, desde un efecto.
export function carriedLoginRedirectError(): string | undefined {
  try {
    return globalThis.sessionStorage.getItem(storageKey) ?? undefined;
  } catch {
    return undefined;
  }
}

/// Se muestra una vez: una recarga o una visita más tarde a `/login` ya no lo tienen que mostrar.
export function forgetLoginRedirectError(): void {
  try {
    globalThis.sessionStorage.removeItem(storageKey);
  } catch {
    // Nada que borrar si tampoco se pudo guardar.
  }
}
