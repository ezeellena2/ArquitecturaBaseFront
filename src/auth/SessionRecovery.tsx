import { useEffect, useRef, useState } from "react";
import { useAuth } from "react-oidc-context";
import { Outlet } from "react-router";
import { SessionRecoveryContext } from "./sessionRecoveryStatus";

/// Recupera la sesión al arrancar, antes de que nadie concluya que no hay.
///
/// Los tokens viven solo en memoria (`authConfig`), así que al recargar la página el SPA arranca sin nada,
/// pero el servidor todavía tiene su cookie de sesión. `signinSilent` la canjea en un iframe con
/// `prompt=none`: recupera la sesión sin sacar al usuario de la pantalla donde estaba ni tocar la URL.
///
/// Mientras eso corre, los hijos se montan igual: la estructura (barra lateral, barra de arriba, contenido)
/// aparece de entrada y cada pantalla muestra bloques de carga donde todavía no hay datos, como cualquier
/// aplicación con sesión. Lo único que hace falta es avisar que la recuperación está en curso, para que
/// `ProtectedRoute` no lea "no hay sesión en memoria" como una respuesta y mande a `/login`: sin ese aviso,
/// `/login` sin `returnUrl` dispara un `signinRedirect` y el navegador se va entero a `/connect/authorize` y
/// vuelve. Esas eran las tres navegaciones que se veían al apretar F5.
///
/// Va afuera de `ProtectedRoute` y solo en la rama que necesita sesión (ver `app/routes.tsx`): las pantallas
/// del ingreso (`AuthLayout`) no tienen nada que recuperar. En `/login` el servidor ya dijo que no hay
/// sesión, en `/login/codigo` el ingreso está a mitad de camino y del canje de `/auth/callback` se encarga la
/// propia pantalla. Que el árbol de rutas decida es más barato que comparar la URL a mano.
export function SessionRecovery() {
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
    // los que evitan que un fallo del iframe deje la aplicación esperando para siempre.
    void auth
      .signinSilent()
      .catch(() => undefined)
      .finally(() => setIsRecovering(false));
  }, [auth, isRecovering]);

  return (
    <SessionRecoveryContext.Provider value={isRecovering}>
      <Outlet />
    </SessionRecoveryContext.Provider>
  );
}
