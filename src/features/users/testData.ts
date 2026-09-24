import { HttpResponse, http } from "msw";
import type { UserDetail, UserListItem } from "./api/users";
import type { CurrentUser } from "@/auth/useCurrentUser";
import { currentUser } from "@/test/mocks/handlers";

/// Los datos de los tests de `/usuarios`: el listado, el alta y la edición. Viven al lado de la feature, y no en
/// `test/mocks`, porque solo los usan estos tests.

/// Solo con correo, como las cuentas de antes de WhatsApp.
export const ana: UserListItem = {
  id: "1",
  email: "ana@example.com",
  phoneNumber: null,
  phoneNumberConfirmed: false,
  formattedPhoneNumber: null,
  displayName: "Ana",
  isActive: true,
  createdAtUtc: "2026-09-18T12:00:00Z",
  roles: ["Admin"],
};

export const beto: UserListItem = {
  ...ana,
  id: "2",
  email: "beto@example.com",
  displayName: null,
  isActive: false,
  createdAtUtc: "2026-09-18T13:00:00Z",
  roles: [],
};

/// Con correo y con WhatsApp: la fila muestra el correo y, al lado, el ícono del teléfono.
export const carla: UserListItem = {
  ...ana,
  id: "5",
  email: "carla@example.com",
  phoneNumber: "+5491155554444",
  phoneNumberConfirmed: true,
  formattedPhoneNumber: "+54 9 11 5555-4444",
  displayName: "Carla Paz",
  roles: ["User"],
};

/// Sin correo, con el número verificado: una cuenta que creó el bot.
export const juan: UserListItem = {
  ...ana,
  id: "3",
  email: null,
  phoneNumber: "+5491123456789",
  phoneNumberConfirmed: true,
  formattedPhoneNumber: "+54 9 11 2345-6789",
  displayName: "Juan Gómez",
  roles: ["User"],
};

/// Sin correo, con un número que cargó un admin y con el que todavía no entró.
export const laura: UserListItem = {
  ...ana,
  id: "4",
  email: null,
  phoneNumber: "+5493515551234",
  phoneNumberConfirmed: false,
  formattedPhoneNumber: "+54 9 351 555-1234",
  displayName: "Laura Ríos",
  roles: ["User"],
};

export function pageOf(items: readonly UserListItem[]) {
  return {
    items,
    page: 1,
    pageSize: 20,
    totalCount: items.length,
    totalPages: items.length === 0 ? 0 : 1,
    hasPrevious: false,
    hasNext: false,
  };
}

/// El detalle de una fila: lo mismo, más si el correo está verificado y la última invitación.
export function detailOf(user: UserListItem, overrides: Partial<UserDetail> = {}): UserDetail {
  return { ...user, emailConfirmed: user.email !== null, lastInvitation: null, ...overrides };
}

/// El perfil de quien sí puede administrar. El handler por defecto solo trae "users.read".
export const admin: CurrentUser = { ...currentUser, permissions: ["users.read", "users.manage", "roles.read"] };

export const roles = [
  { id: "r1", name: "Admin", description: "Puede hacer todo.", isSystemRole: true, userCount: 1, permissions: [] },
  { id: "r2", name: "User", description: null, isSystemRole: true, userCount: 3, permissions: [] },
];

export const counts = {
  status: { all: 2, active: 1, inactive: 1 },
  roles: [
    { name: "Admin", count: 1 },
    { name: "Soporte", count: 0 },
    { name: "User", count: 1 },
  ],
  createdWithin: [
    { days: 7, count: 0 },
    { days: 30, count: 2 },
  ],
};

/// El arnés corre con `onUnhandledRequest: "error"`: cada test declara todo lo que su pantalla va a pedir. Los medios
/// de ingreso los pone el handler por defecto, con WhatsApp apagado.
export function adminHandlers(items: readonly UserListItem[] = [ana, beto]) {
  return [
    http.get("/api/me", () => HttpResponse.json(admin)),
    http.get("/api/users", () => HttpResponse.json(pageOf(items))),
    http.get("/api/roles", () => HttpResponse.json(roles)),
    http.get("/api/users/filter-counts", () => HttpResponse.json(counts)),
  ];
}
