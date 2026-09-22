import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";

export interface UserListItem {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly createdAtUtc: string;
  /// Ordenados por nombre desde el backend: la tabla los muestra y dos cargas tienen que verse igual.
  readonly roles: readonly string[];
}

/// El detalle que devuelve `GET /api/users/{id}`. Hoy es exactamente lo mismo que una fila del listado, pero
/// el nombre se queda: son dos contratos distintos del backend y nada obliga a que sigan coincidiendo.
export type UserDetail = UserListItem;

/// Lo que el backend sabe filtrar (`UserListRequest`). Los tres viajan como están en la URL.
export interface UserFilters {
  readonly isActive?: string;
  readonly role?: string;
  readonly createdWithinDays?: string;
}

export type UserFilterKey = keyof UserFilters;

/// Las claves de filtro, en el orden en que se muestran y en que se listan los chips. Viven acá, al lado del
/// tipo que las declara, y no en el componente de la barra: las usa también la pantalla.
export const userFilterKeys: readonly UserFilterKey[] = ["isActive", "role", "createdWithinDays"];

export interface UsersQuery extends UserFilters {
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: string;
  readonly search?: string;
}

/// Lo que devuelve `GET /api/users/filter-counts`: cuántos traería cada opción con los demás filtros puestos
/// e ignorando el propio. Por eso el número de "Inactivos" sigue estando cuando se está mirando activos.
export interface UserFilterCounts {
  readonly status: { readonly all: number; readonly active: number; readonly inactive: number };
  readonly roles: readonly { readonly name: string; readonly count: number }[];
  readonly createdWithin: readonly { readonly days: number; readonly count: number }[];
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

/// Cuelga del mismo prefijo que el listado: una mutación que invalida `usersQueryKeyRoot` se lleva también
/// los conteos, que describen a ese listado y se quedarían mintiendo.
export const userFilterCountsQueryKey = (filters: UserFilters & { readonly search?: string }) =>
  ["users", "filter-counts", filters] as const;

export const userQueryKey = (id: string) => ["user", id] as const;

/// Solo lo que está puesto: un parámetro vacío no es "sin filtro" para el backend, que contesta 400 a un
/// `role=` sin valor a propósito.
function appendFilters(params: URLSearchParams, filters: UserFilters & { readonly search?: string }) {
  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }
}

export function fetchUsers(query: UsersQuery): Promise<PagedResult<UserListItem>> {
  const params = new URLSearchParams({ page: String(query.page), pageSize: String(query.pageSize) });

  if (query.sort) {
    params.set("sort", query.sort);
  }

  appendFilters(params, {
    search: query.search,
    isActive: query.isActive,
    role: query.role,
    createdWithinDays: query.createdWithinDays,
  });

  return api.get<PagedResult<UserListItem>>(`/api/users?${params.toString()}`);
}

export function fetchUserFilterCounts(
  filters: UserFilters & { readonly search?: string },
): Promise<UserFilterCounts> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const query = params.toString();

  return api.get<UserFilterCounts>(`/api/users/filter-counts${query ? `?${query}` : ""}`);
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
