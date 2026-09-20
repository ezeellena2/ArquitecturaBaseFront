import type { ReactNode } from "react";
import { usePermissions } from "./usePermissions";

/// Muestra a sus hijos solo si el usuario tiene el permiso.
export function Can({ permission, children }: { permission: string; children: ReactNode }) {
  const { has, isPending } = usePermissions();

  return !isPending && has(permission) ? <>{children}</> : null;
}
