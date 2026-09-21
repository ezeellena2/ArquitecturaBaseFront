import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";

export interface UserListItem {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly createdAtUtc: string;
}

/// El detalle que devuelve `GET /api/users/{id}`: lo mismo que el listado, más los roles.
export interface UserDetail extends UserListItem {
  readonly roles: readonly string[];
}

export interface UsersQuery {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly search?: string;
}

export interface CreateUserBody {
  readonly email: string;
  readonly displayName: string | null;
  readonly roles: readonly string[];
}

/// `PUT /api/users/{id}` reemplaza los dos campos: mandar solo los roles le borraría el nombre a la persona.
export interface UpdateUserBody {
  readonly displayName: string | null;
  readonly roles: readonly string[];
}

/// Prefijo de todas las consultas del listado: es lo que invalidan las mutaciones, sin importar la página,
/// el orden ni la búsqueda que tenga puesta la pantalla.
export const usersQueryKeyRoot = ["users"] as const;

export const usersQueryKey = (query: UsersQuery) => ["users", query] as const;

export const userQueryKey = (id: string) => ["user", id] as const;

export function fetchUsers(query: UsersQuery): Promise<PagedResult<UserListItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });

  if (query.sort) {
    params.set("sort", query.sort);
  }

  if (query.search) {
    params.set("search", query.search);
  }

  return api.get<PagedResult<UserListItem>>(`/api/users?${params.toString()}`);
}

export function fetchUser(id: string): Promise<UserDetail> {
  return api.get<UserDetail>(`/api/users/${id}`);
}

/// Devuelve el id del usuario nuevo: el handler es `ICommand<Guid>` y `ToHttpResult` responde 200 con el valor.
export function createUser(body: CreateUserBody): Promise<string> {
  return api.post<string>("/api/users", body);
}

export function updateUser(id: string, body: UpdateUserBody): Promise<void> {
  return api.put<void>(`/api/users/${id}`, body);
}

export function setUserActive(id: string, isActive: boolean): Promise<void> {
  return api.post<void>(`/api/users/${id}/${isActive ? "activate" : "deactivate"}`);
}

export function deleteUser(id: string): Promise<void> {
  return api.delete<void>(`/api/users/${id}`);
}
