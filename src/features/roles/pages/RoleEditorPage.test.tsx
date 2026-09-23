import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PermissionGroup } from "../api/roles";
import { queryClient } from "@/shared/api/queryClient";
import { rolesQueryKey, type RoleListItem } from "@/shared/api/roles";
import { currentUser } from "@/test/mocks/handlers";
import { server } from "@/test/mocks/server";
import { renderRouteWithProviders } from "@/test/utils/renderWithProviders";

vi.mock("react-oidc-context", async () => {
  const actual = await vi.importActual<typeof import("react-oidc-context")>("react-oidc-context");

  return { ...actual, useAuth: () => ({ isAuthenticated: true, isLoading: false, user: { access_token: "t" } }) };
});

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
    area: "roles",
    name: "Roles",
    permissions: [
      { code: "roles.read", name: "Ver roles", description: "Los roles y qué permisos da cada uno." },
      { code: "roles.manage", name: "Administrar roles", description: "Crear, editar y eliminar roles." },
    ],
  },
  {
    area: "settings",
    name: "Configuración",
    permissions: [
      {
        code: "settings.manage",
        name: "Administrar la configuración",
        description: "El modo de registro y los ajustes del sistema.",
      },
    ],
  },
];

const admin: RoleListItem = {
  id: "r1",
  name: "Admin",
  description: "Puede hacer todo.",
  isSystemRole: true,
  userCount: 1,
  permissions: ["users.read", "users.manage", "roles.read", "roles.manage", "settings.manage"],
};

const user: RoleListItem = {
  id: "r2",
  name: "User",
  description: "Lo que tiene cualquier cuenta.",
  isSystemRole: true,
  userCount: 2,
  permissions: [],
};

const support: RoleListItem = {
  id: "r3",
  name: "Soporte",
  description: "Atiende a los usuarios y revisa sus cuentas.",
  isSystemRole: false,
  userCount: 4,
  permissions: ["users.read", "users.manage", "roles.read"],
};

const audit: RoleListItem = {
  id: "r4",
  name: "Auditoría",
  description: null,
  isSystemRole: false,
  userCount: 0,
  permissions: ["settings.manage"],
};

const roles = [admin, user, support, audit];

const manager = { ...currentUser, permissions: ["users.read", "roles.read", "roles.manage"] };

/// El arnés corre con `onUnhandledRequest: "error"`: cada test declara todo lo que su pantalla va a pedir.
/// Volver al listado también pide los roles, así que el handler está siempre.
function editorHandlers(roleList: readonly RoleListItem[] = roles) {
  return [
    http.get("/api/me", () => HttpResponse.json(manager)),
    http.get("/api/roles", () => HttpResponse.json(roleList)),
    http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
  ];
}

function pageTitle() {
  return screen.getByRole("heading", { level: 1 });
}

/// El último nivel de las migas: la página actual.
function currentCrumb() {
  const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i })).getAllByRole("listitem");

  return crumbs.find((item) => item.getAttribute("aria-current") === "page");
}

async function renderSupport() {
  const rendered = renderRouteWithProviders("/roles/r3");
  expect(await screen.findByRole("heading", { level: 1, name: "Editar el rol Soporte" })).toBeInTheDocument();

  return rendered;
}

describe("RoleEditorPage", () => {
  beforeEach(() => {
    queryClient.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a role, says so and goes back to the listing", async () => {
    const toastSuccess = vi.spyOn(toast, "success");
    const created: unknown[] = [];
    server.use(
      ...editorHandlers(),
      http.post("/api/roles", async ({ request }) => {
        created.push(await request.json());

        return HttpResponse.json("0199a0c0-0000-7000-8000-000000000002");
      }),
    );

    const { router } = renderRouteWithProviders("/roles/nuevo");

    expect(await screen.findByRole("heading", { level: 1, name: "Nuevo rol" })).toBeInTheDocument();

    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre" }), "  Mesa de ayuda  ");
    await userEvent.type(screen.getByRole("textbox", { name: "Descripción" }), " Atiende a los usuarios. ");
    // En un rol nuevo arranca abierta la primera área.
    await userEvent.click(screen.getByRole("checkbox", { name: "Ver usuarios" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(created).toEqual([
        { name: "Mesa de ayuda", description: "Atiende a los usuarios.", permissions: ["users.read"] },
      ]),
    );
    expect(await screen.findByRole("heading", { level: 1, name: "Roles y permisos" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
    expect(toastSuccess).toHaveBeenCalledWith("Creamos el rol.");
    // Lo guardado ya no se pierde: volver al listado no pregunta nada.
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("sends no description when it is left blank", async () => {
    const created: unknown[] = [];
    server.use(
      ...editorHandlers(),
      http.post("/api/roles", async ({ request }) => {
        created.push(await request.json());

        return HttpResponse.json("0199a0c0-0000-7000-8000-000000000002");
      }),
    );

    renderRouteWithProviders("/roles/nuevo");

    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre" }), "Mesa de ayuda");
    await userEvent.type(screen.getByRole("textbox", { name: "Descripción" }), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(created).toEqual([{ name: "Mesa de ayuda", description: null, permissions: [] }]));
  });

  it("seeds the form with the role it just asked for, not the one in the cache", async () => {
    const updates: unknown[] = [];
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r3", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );
    // El listado quedó en caché antes de que otro administrador le agregara "Administrar usuarios" a Soporte.
    queryClient.setQueryData(rolesQueryKey, [{ ...support, permissions: ["users.read", "roles.read"] }]);

    renderRouteWithProviders("/roles/r3");

    const usersGroup = await screen.findByRole("group", { name: "Usuarios" });
    expect(within(usersGroup).getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();

    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // El PUT reemplaza la lista entera: guardando sobre lo que había en caché, ese permiso se borraba sin aviso.
    await waitFor(() =>
      expect(updates).toEqual([
        {
          name: "Soporte 2",
          description: "Atiende a los usuarios y revisa sus cuentas.",
          permissions: ["users.read", "users.manage", "roles.read"],
        },
      ]),
    );
  });

  it("does not seed from the listing's cache when asking for the role again fails", async () => {
    const updates: unknown[] = [];
    let requests = 0;
    server.use(
      http.get("/api/me", () => HttpResponse.json(manager)),
      http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
      http.get("/api/roles", () => {
        requests += 1;

        // El listado llegó antes de que otro administrador le agregara "Administrar usuarios" a Soporte; el pedido
        // del editor falla, y el de "Reintentar" ya trae lo nuevo.
        if (requests === 1) {
          return HttpResponse.json([admin, user, { ...support, permissions: ["users.read", "roles.read"] }, audit]);
        }

        return requests === 2
          ? HttpResponse.json(
              { status: 500, code: "General.Unexpected", detail: "Ocurrió un error.", traceId: "0HN7-Z" },
              { status: 500 },
            )
          : HttpResponse.json(roles);
      }),
      http.put("/api/roles/r3", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    // El camino de todos los días: el listado deja los roles en caché y "Editar" abre la pantalla.
    const { router } = renderRouteWithProviders("/roles");
    await userEvent.click(await screen.findByRole("button", { name: "Editar el rol Soporte" }));

    // Sembrar con lo que había en caché sería guardar encima de una lista de permisos vieja: el PUT la reemplaza
    // entera y "Administrar usuarios" se borraba sin aviso.
    expect(await screen.findByText("No pudimos cargar el rol")).toBeInTheDocument();
    expect(screen.getByText("Código para reportar: 0HN7-Z")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles/r3");

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    const usersGroup = await screen.findByRole("group", { name: "Usuarios" });
    expect(within(usersGroup).getByRole("checkbox", { name: "Administrar usuarios" })).toBeChecked();

    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), " 2");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updates).toEqual([
        {
          name: "Soporte 2",
          description: "Atiende a los usuarios y revisa sus cuentas.",
          permissions: ["users.read", "users.manage", "roles.read"],
        },
      ]),
    );
  });

  it("shows the no-permission page when asking for the role again is forbidden, even with the listing cached", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json(manager)),
      http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
      http.get("/api/roles", () =>
        HttpResponse.json({ status: 403, code: "Http.Forbidden", detail: "No tenés permiso." }, { status: 403 }),
      ),
    );
    queryClient.setQueryData(rolesQueryKey, roles);

    renderRouteWithProviders("/roles/r3");

    expect(await screen.findByText("No tenés permiso")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Nombre" })).not.toBeInTheDocument();
  });

  it("does not send a permission the catalog no longer declares", async () => {
    // Sacado del catálogo del backend pero todavía guardado en el rol: no tiene casilla ni chip, así que no hay
    // forma de quitarlo, y si viaja en el PUT el backend rechaza el rol entero.
    const updates: unknown[] = [];
    server.use(
      ...editorHandlers([admin, user, { ...support, permissions: [...support.permissions, "reports.export"] }, audit]),
      http.put("/api/roles/r3", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    await renderSupport();

    // Tampoco cuenta como un cambio: la pantalla arranca sin nada que guardar.
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updates).toEqual([
        {
          name: "Soporte",
          description: "Atiende a los usuarios y revisa sus cuentas.",
          permissions: ["users.read", "users.manage", "roles.read", "roles.manage"],
        },
      ]),
    );
  });

  it("asks for a name before saving, and typing one takes the error away", async () => {
    const created = vi.fn();
    server.use(
      ...editorHandlers(),
      http.post("/api/roles", () => {
        created();

        return HttpResponse.json("0199a0c0-0000-7000-8000-000000000002");
      }),
    );

    renderRouteWithProviders("/roles/nuevo");

    await userEvent.click(await screen.findByRole("button", { name: "Guardar" }));

    const name = screen.getByRole("textbox", { name: "Nombre" });
    expect(await screen.findByText("Poné un nombre.")).toBeInTheDocument();
    expect(name).toHaveAccessibleDescription("Poné un nombre.");
    expect(created).not.toHaveBeenCalled();

    await userEvent.type(name, "M");

    expect(screen.queryByText("Poné un nombre.")).not.toBeInTheDocument();
    expect(name).not.toHaveAttribute("aria-invalid");
  });

  it("puts a repeated name under the field and keeps what was picked", async () => {
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r3", () =>
        HttpResponse.json(
          { status: 409, code: "Roles.Role.AlreadyExists", detail: "Ya existe un rol con ese nombre." },
          { status: 409 },
        ),
      ),
    );

    await renderSupport();

    const name = screen.getByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);
    await userEvent.type(name, "Auditoría");
    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    // El texto es el del front, elegido por el código, y va debajo del nombre, no arriba del formulario.
    expect(await screen.findByText("Ya hay un rol con ese nombre.")).toBeInTheDocument();
    expect(name).toHaveAccessibleDescription("Ya hay un rol con ese nombre.");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("checkbox", { name: "Administrar roles" })).toBeChecked();
    expect(name).toHaveValue("Auditoría");
  });

  it("puts a validation error of the name under the field", async () => {
    server.use(
      ...editorHandlers(),
      http.post("/api/roles", () =>
        HttpResponse.json(
          {
            status: 400,
            code: "Validation.Failed",
            detail: "Revisá los datos.",
            errors: { name: ["El nombre no puede tener más de 256 caracteres."] },
          },
          { status: 400 },
        ),
      ),
    );

    renderRouteWithProviders("/roles/nuevo");

    await userEvent.type(await screen.findByRole("textbox", { name: "Nombre" }), "Mesa de ayuda");
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("textbox", { name: "Nombre" })).toHaveAccessibleDescription(
      "El nombre no puede tener más de 256 caracteres.",
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("puts any other error above the two columns", async () => {
    server.use(
      ...editorHandlers(),
      // Otro administrador lo borró mientras esta pantalla estaba abierta.
      http.put("/api/roles/r3", () =>
        HttpResponse.json({ status: 404, code: "Roles.Role.NotFound", detail: "No encontramos el rol." }, { status: 404 }),
      ),
    );

    await renderSupport();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No encontramos el rol.");
    expect(screen.getByRole("textbox", { name: "Nombre" })).not.toHaveAccessibleDescription();
  });

  it("says it is saving and does not let the button be pressed twice", async () => {
    let release: (() => void) | undefined;
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r3", async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { router } = await renderSupport();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();
    // La pantalla no se tapa: lo escrito sigue a la vista.
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Soporte");

    await waitFor(() => expect(release).toBeDefined());
    release?.();

    await waitFor(() => expect(router.state.location.pathname).toBe("/roles"));
  });

  it("does not ask while it saves, and a save that ends after leaving does not bring you back", async () => {
    const toastSuccess = vi.spyOn(toast, "success");
    let release: (() => void) | undefined;
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r3", async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });

        return new HttpResponse(null, { status: 204 });
      }),
    );

    const { router } = await renderSupport();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();

    // Lo cambiado ya salió: preguntar si se descarta "lo que no se guardó" no sería cierto.
    const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i }));
    await userEvent.click(crumbs.getByRole("link", { name: "Inicio" }));

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await waitFor(() => expect(release).toBeDefined());
    release?.();

    // El guardado termina y lo avisa, pero la persona ya eligió a dónde ir: no se la lleva al listado.
    await waitFor(() => expect(toastSuccess).toHaveBeenCalledWith("Guardamos los cambios."));
    await waitFor(() => expect(queryClient.isMutating()).toBe(0));
    await waitFor(() => expect(router.state.navigation.state).toBe("idle"));
    expect(router.state.location.pathname).toBe("/");
  });

  it("tells what went wrong when a save fails after leaving the screen", async () => {
    const toastError = vi.spyOn(toast, "error");
    let release: (() => void) | undefined;
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r3", async () => {
        await new Promise<void>((resolve) => {
          release = resolve;
        });

        return HttpResponse.json(
          { status: 409, code: "Roles.Role.AlreadyExists", detail: "Ya existe un rol con ese nombre." },
          { status: 409 },
        );
      }),
    );

    const { router } = await renderSupport();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));
    expect(await screen.findByRole("button", { name: "Guardando…" })).toBeDisabled();

    const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i }));
    await userEvent.click(crumbs.getByRole("link", { name: "Inicio" }));
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));

    await waitFor(() => expect(release).toBeDefined());
    release?.();

    // La pantalla ya no está para mostrarlo debajo del nombre, y sin aviso la persona creería que se guardó.
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("Ya hay un rol con ese nombre."));
  });

  it("follows the typed name in the title and the crumbs", async () => {
    server.use(...editorHandlers());

    await renderSupport();

    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Soporte"));

    const name = screen.getByRole("textbox", { name: "Nombre" });
    await userEvent.clear(name);

    expect(pageTitle()).toHaveTextContent("Editar el rol sin nombre");
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Rol"));

    await userEvent.type(name, "  Mesa de ayuda ");

    expect(pageTitle()).toHaveTextContent("Editar el rol Mesa de ayuda");
    await waitFor(() => expect(currentCrumb()).toHaveTextContent("Mesa de ayuda"));
  });

  it("says there are unsaved changes, until they are undone", async () => {
    server.use(...editorHandlers());

    await renderSupport();

    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();

    // Volver a lo que estaba no es un cambio, aunque se haya tocado.
    await userEvent.click(screen.getByRole("checkbox", { name: "Administrar roles" }));
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Descripción" }), "!");
    expect(screen.getByText("Cambios sin guardar")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox", { name: "Descripción" }), "{Backspace}");
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });

  it("goes straight back to the listing on Cancel when there is nothing to lose", async () => {
    server.use(...editorHandlers());

    const { router } = await renderSupport();

    await userEvent.click(screen.getByRole("link", { name: "Cancelar" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Roles y permisos" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
  });

  it("asks before throwing changes away: keep editing stays, discard goes back", async () => {
    server.use(...editorHandlers());

    const { router } = await renderSupport();

    await userEvent.type(screen.getByRole("textbox", { name: "Nombre" }), " 2");
    await userEvent.click(screen.getByRole("link", { name: "Cancelar" }));

    const dialog = await screen.findByRole("dialog", { name: "¿Descartar los cambios?" });
    expect(dialog).toHaveAccessibleDescription("Lo que cambiaste en este rol no se guardó.");

    await userEvent.click(within(dialog).getByRole("button", { name: "Seguir editando" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(router.state.location.pathname).toBe("/roles/r3");
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Soporte 2");

    // La flecha de la banda también pasa por la guarda.
    await userEvent.click(screen.getByRole("link", { name: "Volver a Roles y permisos" }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "¿Descartar los cambios?" })).getByRole("button", {
        name: "Descartar",
      }),
    );

    expect(await screen.findByRole("heading", { level: 1, name: "Roles y permisos" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
  });

  it("says the role no longer exists, and its button goes back to the listing", async () => {
    server.use(...editorHandlers([admin, user, audit]));

    const { router } = renderRouteWithProviders("/roles/r3");

    expect(await screen.findByText("Este rol ya no existe")).toBeInTheDocument();
    expect(screen.getByText("Alguien lo borró, o el link que abriste es de antes.")).toBeInTheDocument();
    // No hay nada que reintentar: el rol no va a volver.
    expect(screen.queryByRole("button", { name: "Reintentar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();

    // Hay dos enlaces con ese nombre: la flecha de la banda y el botón del estado, que es el que tiene texto.
    const back = screen
      .getAllByRole("link", { name: "Volver a Roles y permisos" })
      .find((link) => link.textContent === "Volver a Roles y permisos");
    expect(back).toBeDefined();
    await userEvent.click(back as HTMLElement);

    expect(await screen.findByRole("heading", { level: 1, name: "Roles y permisos" })).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/roles");
  });

  it("shows the code to report a failed load, and Retry asks again", async () => {
    let requests = 0;
    server.use(
      http.get("/api/me", () => HttpResponse.json(manager)),
      http.get("/api/permissions", () => HttpResponse.json(permissionGroups)),
      http.get("/api/roles", () => {
        requests += 1;

        return requests === 1
          ? HttpResponse.json(
              { status: 500, code: "General.Unexpected", detail: "Ocurrió un error.", traceId: "0HN7-A2" },
              { status: 500 },
            )
          : HttpResponse.json(roles);
      }),
    );

    renderRouteWithProviders("/roles/r3");

    expect(await screen.findByText("No pudimos cargar el rol")).toBeInTheDocument();
    expect(screen.getByText("Código para reportar: 0HN7-A2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Editar el rol Soporte" })).toBeInTheDocument();
    expect(requests).toBe(2);
  });

  it("shows the catalog failing the same way", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json(manager)),
      http.get("/api/permissions", () =>
        HttpResponse.json({ status: 500, code: "General.Unexpected", traceId: "0HN7-B3" }, { status: 500 }),
      ),
    );

    renderRouteWithProviders("/roles/nuevo");

    expect(await screen.findByText("No pudimos cargar el rol")).toBeInTheDocument();
    expect(screen.getByText("Código para reportar: 0HN7-B3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("shows Admin read-only, with every permission and no way to save", async () => {
    server.use(...editorHandlers());

    renderRouteWithProviders("/roles/r1");

    expect(await screen.findByRole("heading", { level: 1, name: "Admin" })).toBeInTheDocument();
    expect(screen.getByText("Del sistema")).toBeInTheDocument();
    expect(screen.getByText("Todos los permisos")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Guardar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cancelar" })).not.toBeInTheDocument();

    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveAttribute("readonly");
    expect(screen.getByRole("textbox", { name: "Descripción" })).toHaveAttribute("readonly");

    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(5);
    for (const checkbox of checkboxes) {
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    }
    expect(screen.queryByRole("button", { name: /^Elegir todos|^Quitar todos/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Quitar Ver usuarios" })).not.toBeInTheDocument();
  });

  it("shows the name of User read-only, and saves a change of its permissions", async () => {
    const updates: unknown[] = [];
    server.use(
      ...editorHandlers(),
      http.put("/api/roles/r2", async ({ request }) => {
        updates.push(await request.json());

        return new HttpResponse(null, { status: 204 });
      }),
    );

    renderRouteWithProviders("/roles/r2");

    const name = await screen.findByRole("textbox", { name: "Nombre" });
    expect(name).toHaveValue("User");
    expect(name).toHaveAttribute("readonly");
    expect(name).toHaveAccessibleDescription("Los roles del sistema no cambian de nombre.");
    expect(screen.getByText("Del sistema")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: "Ver usuarios" }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(updates).toEqual([
        { name: "User", description: "Lo que tiene cualquier cuenta.", permissions: ["users.read"] },
      ]),
    );
  });

  it("sends whoever lacks roles.manage to the no-permission screen", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json({ ...currentUser, permissions: ["roles.read"] })));

    const { router } = renderRouteWithProviders("/roles/nuevo");

    expect(await screen.findByText("No tenés permiso")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sin-permiso");
  });

  it("puts the role in the crumbs, under its section, and opens its group in the menu", async () => {
    server.use(...editorHandlers());

    await renderSupport();

    const crumbs = within(screen.getByRole("navigation", { name: /migas de pan/i }));
    await waitFor(() =>
      expect(crumbs.getAllByRole("listitem").map((item) => item.textContent)).toEqual([
        "Inicio",
        "Gestión de usuarios",
        "Roles y permisos",
        "Soporte",
      ]),
    );
    expect(crumbs.getByRole("link", { name: "Roles y permisos" })).toHaveAttribute("href", "/roles");

    const sidebar = within(screen.getByRole("complementary"));
    expect(sidebar.getByRole("button", { name: /gestión de usuarios/i })).toHaveAttribute("aria-expanded", "true");
    expect(sidebar.getByRole("link", { name: /roles y permisos/i })).toHaveAttribute("aria-current", "page");
  });

  it("shows the next role when moving from one role's screen to another's", async () => {
    server.use(...editorHandlers());

    const { router } = await renderSupport();

    // La misma ruta con otro id: sin remontar, la pantalla se quedaba con lo sembrado del rol anterior.
    await act(() => router.navigate("/roles/r4"));

    expect(await screen.findByRole("heading", { level: 1, name: "Editar el rol Auditoría" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nombre" })).toHaveValue("Auditoría");
    expect(
      within(screen.getByRole("group", { name: "Configuración" })).getByRole("checkbox", {
        name: "Administrar la configuración",
      }),
    ).toBeChecked();
    expect(screen.queryByText("Cambios sin guardar")).not.toBeInTheDocument();
  });
});
