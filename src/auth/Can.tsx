import type { ReactNode } from "react";
import { usePermissions } from "./usePermissions";

/// Muestra a sus hijos solo si el usuario tiene el permiso.
///
/// Con `/api/me` caído esconde igual, y está bien: acá se ocultan acciones sueltas dentro de una pantalla
/// que ya cargó, así que ocultar de más no deja a nadie trabado. El error y su reintento los muestra la
/// pantalla (`ProtectedRoute`, el menú lateral), que es donde sí hay que explicar qué pasó.
export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const { has, isPending } = usePermissions();

  return !isPending && has(permission) ? <>{children}</> : null;
}
