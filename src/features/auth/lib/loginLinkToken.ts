/// El enlace que manda el bot trae el token en el fragmento (`/ingresar#t=…`), que el navegador no le manda al
/// servidor: no queda en los logs, en el historial del servidor ni en el `Referer`. Del lado del SPA, se lee al abrir
/// la página (y cuando llega otro enlace a la misma pestaña), se saca de la barra y queda solo en memoria. Nunca va a
/// una query, a `localStorage` o `sessionStorage`, a un log ni a un mensaje de error.

/// El token del fragmento de la barra, o undefined si no hay (o si vino vacío, que para la pantalla es lo mismo).
export function loginLinkTokenFromAddress(): string | undefined {
  const token = new URLSearchParams(globalThis.location.hash.slice(1)).get("t");

  return token ? token : undefined;
}

/// Saca el fragmento de la barra reemplazando la entrada del historial, sin sumar otra: volver atrás no lo trae de
/// vuelta. Conserva el `history.state`, que es donde el router guarda la suya.
export function removeFragmentFromAddress(): void {
  if (globalThis.location.hash === "") {
    return;
  }

  const { pathname, search } = globalThis.location;
  globalThis.history.replaceState(globalThis.history.state, "", `${pathname}${search}`);
}
