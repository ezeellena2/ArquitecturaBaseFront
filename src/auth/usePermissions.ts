import { useCurrentUser } from "./useCurrentUser";

/// Los permisos del front son solo para la experiencia de uso: quien decide es el backend.
export function usePermissions() {
  const { data, isPending } = useCurrentUser();
  const permissions = data?.permissions ?? [];

  return {
    isPending,
    permissions,
    has: (permission: string) => permissions.includes(permission),
  };
}
