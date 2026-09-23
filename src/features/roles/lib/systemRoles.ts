import type { RoleListItem } from "@/shared/api/roles";

/// El rol del sistema que tiene todos los permisos. Refleja `SystemRoles.Admin` del backend (Domain): si allá
/// cambia el nombre, cambia acá. El listado no manda otra marca que `isSystemRole`, y User también la tiene.
export const ADMIN_ROLE_NAME = "Admin";

/// Admin no se renombra y sus permisos no se tocan: su pantalla es de solo lectura. User, el otro rol del
/// sistema, sí elige permisos. Se mira `isSystemRole` además del nombre, porque un nombre solo no alcanza para
/// decir que es el del sistema.
export function isAdminRole(role: Pick<RoleListItem, "name" | "isSystemRole">): boolean {
  return role.isSystemRole && role.name === ADMIN_ROLE_NAME;
}
