import { api } from "@/shared/api/httpClient";

/// Un permiso del catálogo (`GET /api/permissions`): el código estable, y su nombre y su descripción ya
/// traducidos por el backend.
export interface PermissionItem {
  readonly code: string;
  readonly name: string;
  readonly description: string;
}

/// Los permisos agrupados por área (el prefijo del código: users, roles, settings), que es como se eligen
/// los de un rol.
export interface PermissionGroup {
  readonly area: string;
  readonly name: string;
  readonly permissions: readonly PermissionItem[];
}

/// Los largos que acepta el backend (`ValidationRules.RoleNameMaxLength` y `RoleDescriptionMaxLength`): el
/// campo no deja pasarse, en vez de dejar escribir de más y que lo rechace el servidor.
export const roleNameMaxLength = 64;
export const roleDescriptionMaxLength = 256;

export interface RoleBody {
  readonly name: string;
  readonly description: string | null;
  readonly permissions: readonly string[];
}

export const permissionsQueryKey = ["permissions"] as const;

export function fetchPermissions(): Promise<readonly PermissionGroup[]> {
  return api.get<readonly PermissionGroup[]>("/api/permissions");
}

/// Devuelve el id del rol nuevo: el handler es `ICommand<Guid>` y `ToHttpResult` responde 200 con el valor.
export function createRole(body: RoleBody): Promise<string> {
  return api.post<string>("/api/roles", body);
}

export function updateRole(id: string, body: RoleBody): Promise<void> {
  return api.put<void>(`/api/roles/${id}`, body);
}

export function deleteRole(id: string): Promise<void> {
  return api.delete<void>(`/api/roles/${id}`);
}
