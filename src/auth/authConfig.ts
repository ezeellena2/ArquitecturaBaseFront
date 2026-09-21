import { InMemoryWebStorage, WebStorageStateStore, type UserManagerSettings } from "oidc-client-ts";

/// El SPA y la Api comparten origen (sección 5.1), así que el authority es el propio origen.
const origin = globalThis.location?.origin ?? "https://localhost:5173";

export const authConfig: UserManagerSettings = {
  authority: origin,
  client_id: "web",
  redirect_uri: `${origin}/auth/callback`,
  post_logout_redirect_uri: `${origin}/login`,
  silent_redirect_uri: `${origin}/silent-renew.html`,
  response_type: "code",
  scope: "openid profile email roles offline_access api",
  // Los tokens viven solo en memoria: al recargar, la sesión se recupera con la cookie del servidor.
  // Sin esto, oidc-client-ts los guardaría en sessionStorage.
  userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() }),
  // El stateStore va explícito porque el default de oidc-client-ts 3.5 es localStorage. Acá viaja el
  // code_verifier, que tiene que sobrevivir la ida y vuelta a /connect/authorize pero no la pestaña.
  // Nunca guarda tokens.
  stateStore: new WebStorageStateStore({ store: globalThis.sessionStorage }),
  // El cliente HTTP renueva una sola vez al recibir 401. Una renovación automática paralela podría reutilizar el
  // mismo refresh token rotativo y hacer que el servidor revoque toda la cadena.
  automaticSilentRenew: false,
  accessTokenExpiringNotificationTimeInSeconds: 60,
};
