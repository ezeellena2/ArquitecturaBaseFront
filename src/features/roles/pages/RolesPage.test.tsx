import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";
import { currentUser } from "@/test/mocks/handlers";
import { queryClient } from "@/shared/api/queryClient";
import { server } from "@/test/mocks/server";

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

const permissionGroups = [
  {
    area: "users",
    name: "Usuarios",
    permissions: [
      { code: "users.read", name: "Ver usuarios" },
      { code: "users.manage", name: "Administrar usuarios" },
    ],
  },
  {
    area: "settings",
    name: "Configuración",
    permissions: [{ code: "settings.manage", name: "Cambiar la configuración" }],
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

  it("shows the backend's message, with the count, when the role still has users", async () => {
    const toastError = vi.spyOn(toast, "error");
    server.use(
      ...managerHandlers(),
      http.delete("/api/roles/r2", () =>
        HttpResponse.json(
          { status: 409, code: "Roles.Role.HasUsers", detail: "4 usuarios todavía tienen este rol." },
          { status: 409 },
        ),
      ),
    );

    renderRouteWithProviders("/roles");

    await userEvent.click(await screen.findByRole("button", { name: "Eliminar el rol Soporte" }));
    await userEvent.click(await screen.findByRole("button", { name: "Eliminar" }));

    // La excepción a decidir el texto por el código: solo el backend sabe cuántos son.
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("4 usuarios todavía tienen este rol."));
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
