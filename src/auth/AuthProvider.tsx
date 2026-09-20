import { useLayoutEffect, type ReactNode } from "react";
import { AuthProvider as OidcProvider, useAuth, type AuthContextProps } from "react-oidc-context";
import { authConfig } from "./authConfig";
import { configureHttpClient } from "@/shared/api/httpClient";
import i18n from "@/shared/i18n";

/// Sesión actual. useAuth devuelve un objeto nuevo en cada cambio de estado (incluso mientras corre una
/// renovación), así que el cliente HTTP la lee de acá en lugar de reconfigurarse en cada cambio: no hay
/// configuraciones viejas compitiendo con las nuevas y el token siempre es el último.
let session: AuthContextProps | undefined;

// El cliente HTTP se configura una sola vez, al importar este módulo y no en un efecto: los efectos de los
// hijos corren antes que los del padre, así que con un efecto la primera petición saldría sin token ni idioma.
configureHttpClient({
  getAccessToken: () => session?.user?.access_token,
  getLanguage: () => i18n.language,
  renewSession: async () => (await session?.signinSilent())?.access_token,
  onSessionExpired: () => void session?.removeUser(),
});

/// Limpia code y state de la URL después del callback, como pide react-oidc-context.
function onSigninCallback(): void {
  globalThis.history.replaceState({}, document.title, globalThis.location.pathname);
}

/// Publica la sesión para el cliente HTTP.
function HttpClientBridge({ children }: { children: ReactNode }) {
  const auth = useAuth();

  // useLayoutEffect y no useEffect: corre en el commit, antes de los efectos pasivos de los hijos, así que
  // la primera consulta de un hijo ya sale con el token.
  useLayoutEffect(() => {
    session = auth;

    return () => {
      session = undefined;
    };
  }, [auth]);

  return <>{children}</>;
}

export function AppAuthProvider({ children }: { children: ReactNode }) {
  return (
    <OidcProvider {...authConfig} onSigninCallback={onSigninCallback}>
      <HttpClientBridge>{children}</HttpClientBridge>
    </OidcProvider>
  );
}
