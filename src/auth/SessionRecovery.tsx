import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "react-oidc-context";
import { Outlet } from "react-router";
import { Spinner } from "@/shared/ui/Spinner";

/// Recupera la sesión al arrancar, antes de que nadie concluya que no hay.
///
/// Los tokens viven solo en memoria (`authConfig`), así que al recargar la página el SPA arranca sin nada,
/// pero el servidor todavía tiene su cookie de sesión. `signinSilent` la canjea en un iframe con
/// `prompt=none`: recupera la sesión sin sacar al usuario de la pantalla donde estaba ni tocar la URL.
///
/// Mientras eso corre no se monta nada abajo. Si `ProtectedRoute` llegara a ver el estado intermedio (sin
/// sesión) mandaría a `/login`, que sin `returnUrl` dispara un `signinRedirect`: el navegador se va entero a
/// `/connect/authorize` y vuelve. Esas son las tres navegaciones que se veían al apretar F5.
///
/// Va afuera de `ProtectedRoute` y solo en la rama que necesita sesión (ver `app/routes.tsx`): las pantallas
/// del ingreso (`AuthLayout`) no tienen nada que recuperar. En `/login` el servidor ya dijo que no hay
/// sesión, en `/login/codigo` el ingreso está a mitad de camino y del canje de `/auth/callback` se encarga la
/// propia pantalla. Que el árbol de rutas decida es más barato que comparar la URL a mano, y de paso ninguna
/// de esas tres pantallas paga la espera del iframe.
export function SessionRecovery() {
  const { t } = useTranslation();
  const auth = useAuth();
  // La decisión se toma en el primer render y no en el efecto: para cuando corriera el efecto, los hijos ya
  // estarían montados y `ProtectedRoute` ya habría redirigido. Si ya hay usuario en memoria (una navegación
  // normal adentro del SPA), no hay nada que recuperar.
  const [isRecovering, setIsRecovering] = useState(() => !auth.user);
  // Un ref y no un estado: tiene que sobrevivir al doble montaje de StrictMode sin disparar un segundo
  // intento. Es el mismo recaudo que toma react-oidc-context con su propia inicialización.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!isRecovering || hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;

    // Salga bien o mal, se sigue: si no había sesión en el servidor esto termina en `login_required` y de ahí
    // se encarga `ProtectedRoute`, que manda a `/login` igual que hasta ahora. El `catch` y el `finally` son
    // los que evitan que un fallo del iframe deje la aplicación trabada en la transición.
    void auth
      .signinSilent()
      .catch(() => undefined)
      .finally(() => setIsRecovering(false));
  }, [auth, isRecovering]);

  if (isRecovering) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center gap-3">
        <Spinner />
        <p className="text-sm font-medium text-[var(--color-content)]">{t("session.restoring")}</p>
      </div>
    );
  }

  return <Outlet />;
}
