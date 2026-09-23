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

  it("labels the permissions block of the dialog", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo rol" }));

    // Sin esto el diálogo saltaba de "Descripción" a un bloque con "Usuarios" y "Configuración" sin decir en
    // ningún lado que eso son los permisos del rol.
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Permisos")).toBeInTheDocument();
  });

  it("keeps each area as a named group even though its visible label is another element", async () => {
    // El punto delicado del diseño: estilar un `<legend>` obliga a trucos frágiles, así que el legend queda
    // oculto para la vista y la banda visible va aparte, con `aria-hidden`. Si alguien "limpia" ese legend
    // oculto, las cajas de permisos se quedan sin nombre accesible y este test se pone en rojo.
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo rol" }));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("group", { name: "Usuarios" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Configuración" })).toBeInTheDocument();
    // Y la casilla sigue viviendo adentro de su grupo, no suelta en el formulario.
    expect(
      within(within(dialog).getByRole("group", { name: "Configuración" })).getByRole("checkbox", {
        name: "Cambiar la configuración",
      }),
    ).toBeInTheDocument();
  });

  it("says how many permissions are picked, and updates as they are picked", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo rol" }));

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText("Ningún permiso elegido")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("checkbox", { name: "Ver usuarios" }));

    expect(within(dialog).getByText("1 permiso elegido")).toBeInTheDocument();
  });

  it("edits over the freshest role, not the one the listing had cached", async () => {
    const updates: unknown[] = [];
    let supportPermissions = ["users.read"];
    server.use(
      http.get("/api/me", () => HttpResponse.json(manager)),
      http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
      http.get("/api/roles", () => HttpResponse.json([roles[0], { ...roles[1], permissions: supportPermissions }])),
      http.put("/api/roles/r2", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/roles");
    await screen.findByRole("table");

    // Otro administrador le agrega un permiso mientras este listado ya está en caché.
    supportPermissions = ["users.read", "users.manage"];

    await userEvent.click(screen.getByRole("button", { name: "Editar el rol Soporte" }));

    const usersGroup = await screen.findByRole("group", { name: "Usuarios" });
    await waitFor(() =>
      expect(within(usersGroup).getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked(),
    );

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // El PUT reemplaza la lista entera: guardando sobre el snapshot viejo, ese permiso se borraba sin aviso.
    await waitFor(() =>
      expect(updates).toEqual([
        { name: "Soporte", description: "Mira usuarios y nada más.", permissions: ["users.read", "users.manage"] },
      ]),
    );
  });

  it("marks the system roles and does not offer to edit or delete them", async () => {
    server.use(...managerHandlers());

    renderRouteWithProviders("/roles");

    expect(await screen.findByText("Del sistema")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar el rol Admin" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Eliminar el rol Admin" })).not.toBeInTheDocument();
    // El de verdad editable sí está, para que el test no pase por no haberse dibujado nada.
    expect(screen.getByRole("button", { name: "Editar el rol Soporte" })).toBeInTheDocument();
  });

  it("creates a role with the permissions grouped by area", async () => {
    const created: unknown[] = [];
    server.use(
      ...managerHandlers(),
      http.post("/api/roles", async ({ request }) => {
        created.push(await request.json());

        return HttpResponse.json("0199a0c0-0000-7000-8000-000000000002");
      }),
    );

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Nuevo rol" }));

    const usersGroup = await screen.findByRole("group", { name: "Usuarios" });
    expect(within(usersGroup).getByRole("checkbox", { name: "Ver usuarios" })).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), "Auditoría");
    await userEvent.click(within(usersGroup).getByRole("checkbox", { name: "Ver usuarios" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(created).toEqual([{ name: "Auditoría", description: null, permissions: ["users.read"] }]),
    );
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

    expect(screen.queryByRole("button", { name: "Nuevo rol" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Editar el rol Soporte" })).not.toBeInTheDocument();
  });
});
