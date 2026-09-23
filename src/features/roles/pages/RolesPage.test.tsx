import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";
import type { PermissionGroup } from "../api/roles";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

const roles = [
  {
    id: "r1",
    name: "Admin",
    description: "Puede hacer todo.",
    isSystemRole: true,
    userCount: 1,
    permissions: ["users.read", "users.manage"],
  },
  {
    id: "r3",
    name: "User",
    description: "Lo que tiene cualquier cuenta.",
    isSystemRole: true,
    userCount: 2,
    permissions: [],
  },
  {
    id: "r2",
    name: "Soporte",
    description: "Mira usuarios y nada más.",
    isSystemRole: false,
    userCount: 4,
    permissions: ["users.read"],
  },
];

const permissionGroups: PermissionGroup[] = [
  {
    area: "users",
    name: "Usuarios",
    permissions: [
      { code: "users.read", name: "Ver usuarios", description: "El listado y el detalle de cada cuenta." },
      {
        code: "users.manage",
        name: "Administrar usuarios",
        description: "Dar de alta, editar, desactivar y eliminar cuentas.",
      },
    ],
  },
  {
    area: "settings",
    name: "Configuración",
    permissions: [
      {
        code: "settings.manage",
        name: "Cambiar la configuración",
        description: "El modo de registro y los ajustes del sistema.",
      },
    ],
  },
];

const manager = { ...currentUser, permissions: ["roles.read", "roles.manage"] };

/// El arnés corre con `onUnhandledRequest: "error"`: cada test declara todo lo que su pantalla va a pedir.
function managerHandlers() {
  return [
    http.get("/api/me", () => HttpResponse.json(manager)),
    http.get("/api/roles", () => HttpResponse.json(roles)),
    http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
  ];
}

describe("RolesPage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows each role with how many users it has", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    const table = await screen.findByRole("table");
    expect(within(table).getByText("Soporte")).toBeInTheDocument();
    expect(within(table).getByText("Mira usuarios y nada más.")).toBeInTheDocument();
    expect(within(table).getByText("4")).toBeInTheDocument();
  });

  it("says the number of permissions in singular when there is only one", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    const table = await screen.findByRole("table");
    // Soporte tiene un permiso. Sin las formas `_one`/`_other`, i18next cae a la clave base y escribe
    // "1 permisos".
    expect(within(table).getByText("1 permiso")).toBeInTheDocument();
    expect(within(table).getByText("2 permisos")).toBeInTheDocument();
  });

  it("links the new role action to its own screen", async () => {
    server.use(...managerHandlers());

    const { router } = renderRouteWithProviders("/roles");

    const newRole = await screen.findByRole("link", { name: "Nuevo rol" });
    expect(newRole).toHaveAttribute("href", "/roles/nuevo");

    await userEvent.click(newRole);

    expect(await screen.findByRole("heading", { level: 1, name: "Nuevo rol" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/nuevo");
  });

  it("takes each role to its own screen from Editar", async () => {
    server.use(...managerHandlers());

    const { router } = renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Editar el rol Soporte" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Editar el rol Soporte" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/r2");
  });

  it("marks the system roles and lets Admin be viewed, not edited nor deleted", async () => {
    server.use(...managerHandlers());

    const { router } = renderRouteWithProviders("/roles");

    const table = await screen.findByRole("table");
    expect(within(table).getAllByText("Del sistema")).toHaveLength(2);
    expect(within(table).queryByRole("button", { name: "Editar el rol Admin" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Eliminar el rol Admin" })).not.toBeInTheDocument();

    // Admin no se cambia, pero se puede mirar: su pantalla es de solo lectura.
    await userEvent.click(within(table).getByRole("button", { name: "Ver el rol Admin" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Admin" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/r1");
  });

  it("lets User be edited but not deleted", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    const table = await screen.findByRole("table");
    expect(within(table).getByRole("button", { name: "Editar el rol User" })).toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Eliminar el rol User" })).not.toBeInTheDocument();
    expect(within(table).queryByRole("button", { name: "Ver el rol User" })).not.toBeInTheDocument();
    // El que no es del sistema sí se elimina, para que el test no pase por no haberse dibujado nada.
    expect(within(table).getByRole("button", { name: "Eliminar el rol Soporte" })).toBeInTheDocument();
  });

  it("says how many users still have the role, taking the count from the backend", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      ...managerHandlers(),
      // El backend manda el número como extensión del ProblemDetails (RoleErrors.HasUsers), no en el detail:
      // el detail del resx es genérico. El texto con el número lo arma el front con ese dato.
      http.delete("/api/roles/r2", () =>
        HttpResponse.json(
          {
            status: 409,
            code: "Roles.Role.HasUsers",
            detail: "El rol tiene usuarios asignados. Reasignalos antes de borrarlo.",
            userCount: 4,
          },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar el rol Soporte" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Todavía hay 4 usuarios con este rol. Reasignalos antes de borrarlos."),
    );
  });

  it("says it in singular when only one user has the role", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      ...managerHandlers(),
      http.delete("/api/roles/r2", () =>
        HttpResponse.json(
          {
            status: 409,
            code: "Roles.Role.HasUsers",
            detail: "El rol tiene usuarios asignados. Reasignalos antes de borrarlo.",
            userCount: 1,
          },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar el rol Soporte" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Todavía hay 1 usuario con este rol. Reasignalo antes de borrarlo."),
    );
  });

  it("falls back to the backend's text when the count did not come", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      ...managerHandlers(),
      http.delete("/api/roles/r2", () =>
        HttpResponse.json(
          { status: 409, code: "Roles.Role.HasUsers", detail: "El rol tiene usuarios asignados." },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar el rol Soporte" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(toastError).toHaveBeenCalledWith("El rol tiene usuarios asignados."));
  });

  it("hides the create and edit actions without roles.manage", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["roles.read"] })),
      http.get("/api/roles", () => HttpResponse.json(roles)),
    );

    renderRouteWithProviders("/roles");

    await screen.findByRole("table");

    // Es un enlace: buscarlo como botón pasaría siempre, con el permiso o sin él.
    expect(screen.queryByRole("link", { name: "Nuevo rol" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar el rol Soporte" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar el rol User" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver el rol Admin" })).not.toBeInTheDocument();
  });
});
