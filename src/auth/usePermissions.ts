import { useCurrentUser } from "./useCurrentUser";

export type PermissionRequirement = string | readonly string[];

/// Los permisos del front son solo para la experiencia de uso: quien decide es el backend.
/// Un fallo de /api/me (isError) no es lo mismo que no tener el permiso: sin esto, ProtectedRoute no puede
/// distinguirlos y termina mostrando "no tenés permiso" cuando en realidad se cayó el servidor.
export function usePermissions() {
  const { data, isPending, isError, error, refetch } = useCurrentUser();
  const permissions = data?.permissions ?? [];

  return {
    isPending,
    isError,
    error,
    refetch,
    permissions,
    has: (requirement: PermissionRequirement) => typeof requirement === "string"
      ? permissions.includes(requirement)
      : requirement.some(permission => permissions.includes(permission)),
  };
}
