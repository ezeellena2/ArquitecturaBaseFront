/// Ruta del endpoint de autorización del servidor. Es la misma constante que `ReturnUrls.AuthorizePath`.
const authorizePath = "/connect/authorize";

/// El único `returnUrl` que sirve es el pedido de autorización que arma el servidor cuando falta la sesión
/// (sección 5.2). Cualquier otro valor —una URL tipeada a mano, un favorito viejo, un link compartido sin la
/// query— lo rechaza `ReturnUrls.IsAuthorizeRequest` del backend al verificar el código, así que para el
/// front es lo mismo que no tener ninguno: el ingreso arranca de nuevo y el servidor manda el que va.
/// La regla se repite acá a propósito, con el mismo criterio que la del backend.
export function authorizeReturnUrl(value: string | null): string | undefined {
  if (value === null || !value.startsWith(authorizePath)) {
    return undefined;
  }

  // Después de la ruta solo puede venir la query: `/connect/authorizely` no es el endpoint de autorización.
  const rest = value.slice(authorizePath.length);

  if (rest !== "" && !rest.startsWith("?")) {
    return undefined;
  }

  // Los caracteres de control también los rechaza el backend.
  return /\p{Cc}/u.test(value) ? undefined : value;
}

/// El `/login` al que hay que volver. Sin un `returnUrl` válido va sin query, que es lo que dispara el
/// redirect de OIDC en `LoginPage` y reinicia el ingreso.
export function loginPathFor(returnUrl: string | undefined): string {
  return returnUrl === undefined ? "/login" : `/login?returnUrl=${encodeURIComponent(returnUrl)}`;
}

/// El `/login/codigo` al que se pasa después de pedir el código, con el mismo `returnUrl`, tal cual.
export function loginCodePathFor(returnUrl: string): string {
  return `/login/codigo?returnUrl=${encodeURIComponent(returnUrl)}`;
}
