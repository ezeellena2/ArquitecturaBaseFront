import { ApiError } from "@/shared/api/ApiError";
import { api } from "@/shared/api/httpClient";
import { rolesQueryKey, type RoleListItem } from "@/shared/api/roles";

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

/// Un rol (`GET /api/roles/{id}`), el mismo objeto que un ítem del listado. Cuelga del prefijo del listado
/// (`rolesQueryKey`), así que invalidar los roles después de guardar también invalida cada rol.
export const roleQueryKey = (id: string) => [...rolesQueryKey, id] as const;

/// El rol, o null si no existe: el backend responde 404 (`Roles.Role.NotFound`, o el de la ruta si el id no es un
/// Guid), y el editor lo muestra como "Este rol ya no existe". Es un resultado y no un error: así no hay nada que
/// reintentar ni un aviso que repita lo que la pantalla ya dice.
export async function fetchRole(id: string): Promise<RoleListItem | null> {
  try {
    return await api.get<RoleListItem>(`/api/roles/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    throw error;
  }
}

export function fetchPermissions(): Promise<readonly PermissionGroup[]> {
  return api.get<readonly PermissionGroup[]>("/api/permissions");
}

/// Devuelve el id del rol nuevo: el backend responde 201 con el id en el cuerpo y el `Location` apuntando a
/// `GET /api/roles/{id}`.
export function createRole(body: RoleBody): Promise<string> {
  return api.post<string>("/api/roles", body);
}

export function updateRole(id: string, body: RoleBody): Promise<void> {
  return api.put<void>(`/api/roles/${id}`, body);
}

export function deleteRole(id: string): Promise<void> {
  return api.delete<void>(`/api/roles/${id}`);
}
