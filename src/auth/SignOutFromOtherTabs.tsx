import { Outlet } from "react-router";
import { useSignOutFromOtherTabs } from "./useSignOut";

/// La raíz de todas las rutas (`app/routes.tsx`): escucha el cierre de sesión de otra pestaña (N12) en cualquier
/// pantalla, también en `/sin-permiso`, en la 404 y en el error de una rama, que quedan afuera de `SessionRecovery`.
/// No tiene límite de error propio: el de cada rama se dibuja adentro de este `Outlet`, así que un error no cierra el
/// canal. En las pantallas del ingreso no hace nada: sin sesión en memoria el aviso se ignora.
export function SignOutFromOtherTabs() {
  useSignOutFromOtherTabs();

  return <Outlet />;
}
