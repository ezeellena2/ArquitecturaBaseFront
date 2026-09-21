import { api } from "@/shared/api/httpClient";

/// Un permiso del catálogo (`GET /api/permissions`): el código estable y su nombre ya traducido por el backend.
export interface PermissionItem {
  readonly code: string;
  readonly name: string;
}

/// Los permisos agrupados por área (el prefijo del código: users, roles, settings), como los muestra el
/// diálogo de rol.
export interface PermissionGroup {
  readonly area: string;
  readonly name: string;
  readonly permissions: readonly PermissionItem[];
}

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
