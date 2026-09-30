import { api } from "@/shared/api/httpClient";
import type { PagedResult } from "@/shared/api/pagedResult";

/// Una fila de `GET /api/users`. Una cuenta puede no tener correo (la creó el bot, o un admin con el número), y
/// entonces se la nombra por el número.
export interface UserListItem {
  readonly id: string;
  readonly email: string | null;
  /// En E.164 ("+5491123456789"). No se muestra nunca: para eso está `formattedPhoneNumber`.
  readonly phoneNumber: string | null;
  /// False mientras la persona no entró con ese número: es lo que cargó un admin, o un invitado que no respondió.
  readonly phoneNumberConfirmed: boolean;
  /// El número para mostrar ("+54 9 11 2345-6789"), como lo agrupa el backend para su país. Null sin número.
  readonly formattedPhoneNumber: string | null;
  readonly displayName: string | null;
  readonly isActive: boolean;
  readonly createdAtUtc: string;
  /// Ordenados por nombre desde el backend: la tabla los muestra y dos cargas tienen que verse igual.
  readonly roles: readonly string[];
}

/// Por dónde sale una invitación (`UserInvitationChannel` del backend, que viaja por su nombre).
export type InvitationChannel = "Email" | "WhatsApp";

/// Cómo va una invitación. Por WhatsApp, cualquiera de estos; por correo, solo `Failed`, si la cola no la tomó.
export type InvitationDeliveryStatus = "Pending" | "Sent" | "Delivered" | "Read" | "Failed";

/// La última invitación que se le mandó a la cuenta: la franja de abajo de los medios de ingreso en la edición (tablero
/// "Editar usuario · B", puntos 1 y 4). `deliveryStatus` es null por un correo que salió, que no tiene estado que
/// seguir, y `Failed` por uno que la cola no tomó (`LastInvitation` del backend).
export interface LastInvitation {
  readonly channel: InvitationChannel;
  readonly sentAtUtc: string;
  readonly deliveryStatus: InvitationDeliveryStatus | null;
}

/// Entre una invitación y la siguiente a la misma cuenta hay que esperar un minuto (`UserInvitation.ResendCooldown` del
/// backend, que si no responde 429 con `retryAfter`). También después de una que "No llegó": el backend no la cobra si
/// la cola no tomó el mensaje, pero sí si el que avisó la falla fue el webhook de Meta, y el detalle no los distingue.
export const invitationResendWaitSeconds = 60;

/// El detalle que devuelve `GET /api/users/{id}`: lo de la fila, más si el correo está verificado y la última
/// invitación. Es lo que usa el diálogo de edición.
export interface UserDetail extends UserListItem {
  readonly emailConfirmed: boolean;
  readonly lastInvitation: LastInvitation | null;
}

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

/// Un número como lo carga el admin: el país elegido y el número tal como se escribió. El que lo interpreta es el
/// servidor, con las mismas reglas que el ingreso (un celular de un país habilitado).
export interface PhoneInput {
  readonly country: string;
  readonly number: string;
}

/// `consent` es la confirmación del admin de que la persona aceptó recibir mensajes por WhatsApp. Por correo va en
/// false: no se pide.
export interface InvitationRequest {
  readonly channel: InvitationChannel;
  readonly consent: boolean;
}

/// `POST /api/users`: un correo, un número o los dos (sin ninguno, `Users.Identity.Required`), y, si se pide, una
/// invitación. Lo que no se cargó va en null.
export interface CreateUserBody {
  readonly email: string | null;
  readonly phone: PhoneInput | null;
  readonly displayName: string | null;
  readonly roles: readonly string[];
  readonly invitation: InvitationRequest | null;
}

/// `PUT /api/users/{id}` reemplaza el nombre y los roles: mandar solo los roles le borraría el nombre a la persona. El
/// correo y el número son opcionales y solo se mandan si se agregaron: ausentes, no cambian. Lo que se agrega queda
/// sin verificar hasta que la persona entra con eso.
export interface UpdateUserBody {
  readonly displayName: string | null;
  readonly roles: readonly string[];
  readonly email?: string;
  readonly phone?: PhoneInput;
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

/// 204: le saca el número, suelta su chat y cierra sus sesiones (el caso del teléfono perdido o robado). 409
/// `Users.User.LastLoginMethod` si el admin se lo quiere sacar a sí mismo y no tiene otro medio de ingreso.
export function unlinkUserPhone(id: string): Promise<void> {
  return api.delete<void>(`/api/users/${id}/whatsapp`);
}

/// 202: la invitación sale en segundo plano. Por WhatsApp, `consent` es la confirmación del admin; por correo va en
/// false. 429 `Users.Invitation.TooManyRequests` con `retryAfter` si pasó menos de un minuto desde la anterior.
export function sendInvitation(id: string, body: InvitationRequest): Promise<void> {
  return api.post<void>(`/api/users/${id}/invitation`, body);
}

export function setUserActive(id: string, isActive: boolean): Promise<void> {
  return api.post<void>(`/api/users/${id}/${isActive ? "activate" : "deactivate"}`);
}

export function deleteUser(id: string): Promise<void> {
  return api.delete<void>(`/api/users/${id}`);
}
